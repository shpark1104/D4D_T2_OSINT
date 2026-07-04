const http = require("http");
const fs = require("fs");
const path = require("path");
const { host, port, stealthmole, llm } = require("./config");
const { extractIocsFromText, mergeIocs } = require("./iocExtractor");
const { extractIocsWithLlm } = require("./llmIocExtractor");
const { getSemanticHighlights } = require("./semanticHighlighter");
const stealthmoleClient = require("./stealthmoleClient");
const walletExplorer = require("./walletExplorer");
const sessionsStore = require("./sessions");

const PUBLIC_DIR = path.join(process.cwd(), "public");
const MAX_BATCH_QUERY_IOCS = 20;

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
    req.on("error", reject);
  });
}

function serializeSession(session) {
  const moduleCounts = {};
  for (const doc of session.documents.values()) {
    moduleCounts[doc.module] = (moduleCounts[doc.module] || 0) + 1;
  }
  return {
    id: session.id,
    title: session.title,
    createdAt: session.createdAt,
    messages: session.messages,
    iocs: session.iocs.map((ioc) => ({ ...ioc, queried: sessionsStore.isQueried(session, ioc) })),
    entities: session.entities,
    relationships: sessionsStore.listRelationships(session),
    documentCount: session.documents.size,
    moduleCounts
  };
}

// Best-effort heuristic used only for ad-hoc click/drag search terms that
// were not already classified as an IOC by the extractor.
function inferIocType(value) {
  const iocs = extractIocsFromText(value, "adhoc");
  if (iocs.length === 1 && iocs[0].value.length >= value.trim().length - 2) {
    return iocs[0].type;
  }
  return "keyword";
}

// Runs regex + LLM IOC extraction over new text/files and merges into the
// session's running IOC set (M2). StealthMole is deliberately NOT queried
// here - the analyst clicks or drags one IOC into the search field and runs a
// single lookup to control M3 queries instead of firing every extracted IOC at once.
async function runIntakePipeline(session, { text, files }) {
  const sources = [{ name: "message", content: text || "" }, ...files];

  const regexIocs = [];
  const llmIocs = [];
  const llmEntities = [];

  for (const source of sources) {
    if (!source.content) continue;
    regexIocs.push(...extractIocsFromText(source.content, source.name));
    if (llm.enabled) {
      const { iocs, entities } = await extractIocsWithLlm(source.content, source.name);
      llmIocs.push(...iocs);
      llmEntities.push(...entities);
    }
  }

  sessionsStore.setIocs(session, mergeIocs(session.iocs, regexIocs, llmIocs));
  sessionsStore.addEntities(session, llmEntities);
}

async function handleApi(req, res, pathname, query) {
  if (req.method === "GET" && pathname === "/api/health") {
    return sendJson(res, 200, {
      ok: true,
      stealthmoleMock: stealthmole.mockMode,
      llmEnabled: llm.enabled
    });
  }

  if (req.method === "GET" && pathname === "/api/quotas") {
    const quotas = await stealthmoleClient.getQuotas();
    return sendJson(res, 200, quotas);
  }

  if (req.method === "GET" && pathname === "/api/wallet/btc/neighbors") {
    const address = query.get("address") || "";
    const limit = Number(query.get("limit") || 5);
    const neighbors = await walletExplorer.getBtcNeighbors(address, { limit });
    return sendJson(res, 200, neighbors);
  }

  if (req.method === "POST" && pathname === "/api/sessions") {
    const body = await readJson(req);
    const session = sessionsStore.createSession(body.title);
    return sendJson(res, 201, serializeSession(session));
  }

  const sessionMatch = pathname.match(/^\/api\/sessions\/([^/]+)(.*)$/);
  if (sessionMatch) {
    const sessionId = decodeURIComponent(sessionMatch[1]);
    const rest = sessionMatch[2];
    const session = sessionsStore.getSession(sessionId);
    if (!session) return sendJson(res, 404, { detail: "Session not found" });

    if (req.method === "GET" && rest === "") {
      return sendJson(res, 200, serializeSession(session));
    }

    if (req.method === "POST" && rest === "/messages") {
      const body = await readJson(req);
      const files = (body.files || []).map((file) => ({ name: file.name, content: file.content || "" }));
      sessionsStore.addMessage(session, { text: body.message, files });
      await runIntakePipeline(session, { text: body.message, files });
      return sendJson(res, 200, serializeSession(session));
    }

    if (req.method === "POST" && rest === "/semantic") {
      const body = await readJson(req);
      const text = String(body.text || "");
      const highlights = await getSemanticHighlights(text);
      return sendJson(res, 200, { enabled: llm.enabled, highlights });
    }

    if (req.method === "POST" && rest === "/relationships") {
      const body = await readJson(req);
      const targetIocs = Array.isArray(body.iocs)
        ? body.iocs
            .map((ioc) => ({ type: ioc.type || inferIocType(ioc.value || ""), value: String(ioc.value || "").trim() }))
            .filter((ioc) => ioc.value)
            .slice(0, MAX_BATCH_QUERY_IOCS)
        : [];
      const queryResultsByIoc = [];
      const unqueriedIocs = targetIocs.filter((ioc) => !sessionsStore.isQueried(session, ioc));

      for (const ioc of unqueriedIocs) {
        sessionsStore.markQueried(session, ioc);
        queryResultsByIoc.push(await stealthmoleClient.queryIoc(ioc));
      }
      if (queryResultsByIoc.length) {
        sessionsStore.addQueryResults(session, queryResultsByIoc);
      }

      const relationships = targetIocs.length ? sessionsStore.refreshRelationships(session, targetIocs) : [];
      return sendJson(res, 200, {
        queried: targetIocs,
        lookedUp: unqueriedIocs,
        lookupResults: queryResultsByIoc.flat(),
        relationships
      });
    }

    const relationshipMatch = rest.match(/^\/relationships\/([^/]+)$/);
    if (relationshipMatch && req.method === "PATCH") {
      const relationshipId = decodeURIComponent(relationshipMatch[1]);
      const body = await readJson(req);
      const updated = sessionsStore.updateRelationshipStatus(session, relationshipId, body.status);
      if (!updated) return sendJson(res, 404, { detail: "Relationship candidate not found" });
      return sendJson(res, 200, updated);
    }

    if (req.method === "POST" && rest === "/query") {
      const body = await readJson(req);
      let queryResultsByIoc;
      let targets;

      if (body.module) {
        // Manual search form: user picked a specific StealthMole module directly,
        // bypassing the IOC-type -> module routing table.
        const value = String(body.query || "").trim();
        if (!value) return sendJson(res, 400, { detail: "query is required" });
        const ioc = { type: inferIocType(value), value };
        targets = [ioc];
        sessionsStore.markQueried(session, ioc);
        let result;
        try {
          if (stealthmoleClient.ASYNC_MODULES.has(body.module)) {
            const route = stealthmoleClient.asyncRouteFor(ioc.type, body.module);
            const indicator = route?.indicator || "keyword";
            const queryText = route?.query ? route.query(value) : value;
            result = await stealthmoleClient.asyncSearchAll(indicator, queryText, {});
          } else {
            result = await stealthmoleClient.syncSearch(body.module, value, {});
          }
        } catch (error) {
          result = {
            module: body.module,
            results_count: 0,
            results: [],
            error: error.detail || error.message,
            queried_at: new Date().toISOString()
          };
        }
        queryResultsByIoc = [[{ ...result, query_ioc: { type: ioc.type, value } }]];
      } else {
        const rawIocs = Array.isArray(body.iocs) ? body.iocs : [];
        targets = (
          rawIocs.length
            ? rawIocs.map((item) => ({ type: item.type || inferIocType(item.value), value: item.value }))
            : [{ type: inferIocType(body.query || ""), value: body.query || "" }]
        ).slice(0, MAX_BATCH_QUERY_IOCS);

        queryResultsByIoc = await Promise.all(
          targets
            .filter((ioc) => ioc.value)
            .map(async (ioc) => {
              sessionsStore.markQueried(session, ioc);
              return stealthmoleClient.queryIoc(ioc);
            })
        );
      }

      sessionsStore.addQueryResults(session, queryResultsByIoc);
      return sendJson(res, 200, {
        queried: targets,
        results: queryResultsByIoc.flat()
      });
    }

    if (req.method === "GET" && rest === "/documents") {
      const listing = sessionsStore.listDocuments(session, {
        module: query.get("module") || undefined,
        sort: query.get("sort") || "recent",
        cursor: Number(query.get("cursor") || 0),
        limit: Number(query.get("limit") || 20)
      });
      return sendJson(res, 200, listing);
    }

    const docMatch = rest.match(/^\/documents\/([^/]+)(\/semantic)?$/);
    if (req.method === "GET" && docMatch) {
      const docId = decodeURIComponent(docMatch[1]);
      const doc = sessionsStore.getDocument(session, docId);
      if (!doc) return sendJson(res, 404, { detail: "Document not found" });

      if (docMatch[2]) {
        if (!doc.semanticHighlights) {
          doc.semanticHighlights = await getSemanticHighlights(doc.content);
        }
        return sendJson(res, 200, { enabled: llm.enabled, highlights: doc.semanticHighlights });
      }

      // TT search hits often carry a bare numeric value with no highlight
      // (see raw_response); drill down into /tt/node once, lazily, and cache
      // the enriched title/content on the document so re-opening it is free.
      if (doc.module === "tt" && !doc.nodeEnriched) {
        doc.nodeEnriched = true;
        const detail = await stealthmoleClient.getNodeDetail("tt", doc.raw_response?.id);
        if (detail) {
          doc.title = detail.title;
          doc.content = detail.content;
        }
      }

      const iocSpans = extractIocsFromText(doc.content, doc.id);
      return sendJson(res, 200, { ...doc, iocSpans });
    }

    return sendJson(res, 404, { detail: "API route not found" });
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

async function requestHandler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url.pathname, url.searchParams);
    } else {
      serveStatic(res, url.pathname);
    }
  } catch (error) {
    sendJson(res, error.status || 500, { detail: error.message });
  }
}

const server = http.createServer(requestHandler);

function startServer() {
  if (server.listening) return server;
  server.listen(port, host, () => {
    console.log(`D4D CTI base running at http://${host}:${port}`);
    console.log(`Local browser URL: http://localhost:${port}`);
    console.log(`StealthMole mode: ${stealthmole.mockMode ? "mock" : "live"}`);
    console.log(`LLM (OpenAI) mode: ${llm.enabled ? "enabled" : "disabled (no OPENAI_API_KEY)"}`);
  });
  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = {
  handleApi,
  requestHandler,
  server,
  startServer
};
