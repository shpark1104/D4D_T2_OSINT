const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { port, stealthmole } = require("./config");

const PUBLIC_DIR = path.join(process.cwd(), "public");

function sendJson(res, status, data) {
  const body = JSON.stringify(data, null, 2);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(body);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {});
      } catch {
        reject(Object.assign(new Error("Invalid JSON body"), { status: 400 }));
      }
    });
  });
}

function extractIocs(text) {
  const source = String(text || "");
  const patterns = {
    ip: /\b(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\b/g,
    url: /\bhttps?:\/\/[^\s"'<>]+/gi,
    email: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    hash: /\b[a-fA-F0-9]{32,64}\b/g,
    cve: /\bCVE-\d{4}-\d{4,7}\b/gi
  };

  const seen = new Set();
  const iocs = [];
  for (const [type, regex] of Object.entries(patterns)) {
    for (const match of source.matchAll(regex)) {
      const value = match[0].replace(/[),.;\]}]+$/g, "");
      const key = `${type}:${value.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      iocs.push({ type, value });
    }
  }
  return iocs;
}

function inferIndicator(query) {
  if (/^https?:\/\//i.test(query)) return "url";
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(query)) return "email";
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(query)) return "ip";
  if (/^[a-fA-F0-9]{32,64}$/.test(query)) return "hash";
  return "domain";
}

function createJwt() {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      access_key: stealthmole.accessKey,
      nonce: crypto.randomUUID(),
      iat: Math.floor(Date.now() / 1000)
    })
  ).toString("base64url");
  const signature = crypto
    .createHmac("sha256", stealthmole.secretKey)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${signature}`;
}

async function stealthmoleSearch({ service = "cds", query }) {
  const normalizedService = String(service).toLowerCase();
  const indicator = inferIndicator(query);

  if (stealthmole.mockMode) {
    return {
      mock: true,
      request: { service: normalizedService, query, indicator },
      results: [
        {
          id: "mock-report-1",
          title: `${query} related CTI report`,
          service: normalizedService,
          summary: "Mock result. Replace this with live StealthMole response mapping.",
          content: `indicator=${query}\nservice=${normalizedService}\nsemantic_signal=credential access or C2 beacon candidate`
        }
      ]
    };
  }

  const asyncServices = new Set(["dt", "tt", "cdf"]);
  const pathName = asyncServices.has(normalizedService)
    ? `/${normalizedService}/search/${indicator}/target/all`
    : `/${normalizedService}/search`;
  const url = new URL(pathName, stealthmole.baseUrl);
  url.searchParams.set(asyncServices.has(normalizedService) ? "text" : "query", query);
  url.searchParams.set("limit", asyncServices.has(normalizedService) ? "100" : "50");

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${createJwt()}`,
      Accept: "application/json"
    }
  });
  const raw = await response.json();
  return { mock: false, request: { service: normalizedService, query, indicator }, raw, results: [] };
}

async function handleApi(req, res, pathname) {
  if (req.method === "GET" && pathname === "/api/health") {
    return sendJson(res, 200, { ok: true, mockMode: stealthmole.mockMode });
  }

  if (req.method === "POST" && pathname === "/api/incidents") {
    const body = await readJson(req);
    const text = [body.message, ...(body.files || []).map((file) => file.content)].filter(Boolean).join("\n");
    const iocs = extractIocs(text);
    return sendJson(res, 201, {
      id: crypto.randomUUID(),
      title: body.title || "New incident",
      message: body.message || "",
      files: body.files || [],
      iocs,
      entities: [],
      semanticHighlights: []
    });
  }

  if (req.method === "POST" && pathname === "/api/search") {
    const body = await readJson(req);
    const result = await stealthmoleSearch(body);
    return sendJson(res, 200, result);
  }

  if (req.method === "GET" && pathname === "/api/quotas") {
    return sendJson(res, 200, stealthmole.mockMode ? { CDS: { allowed: 1000, used: 0 } } : {});
  }

  return sendJson(res, 404, { detail: "API route not found" });
}

function serveStatic(res, pathname) {
  const filePath = path.join(PUBLIC_DIR, pathname === "/" ? "index.html" : pathname);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404);
      return res.end("Not found");
    }
    const type = filePath.endsWith(".css")
      ? "text/css"
      : filePath.endsWith(".js")
        ? "text/javascript"
        : "text/html";
    res.writeHead(200, { "Content-Type": `${type}; charset=utf-8` });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url.pathname);
    } else {
      serveStatic(res, url.pathname);
    }
  } catch (error) {
    sendJson(res, error.status || 500, { detail: error.message });
  }
});

server.listen(port, () => {
  console.log(`D4D CTI base running at http://localhost:${port}`);
  console.log(`StealthMole mode: ${stealthmole.mockMode ? "mock" : "live"}`);
});
