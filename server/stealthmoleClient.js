const crypto = require("crypto");
const { stealthmole } = require("./config");

// Hackathon scope only exposes these modules (dt / ub are excluded per the manual).
const SYNC_MODULES = new Set(["cl", "cb", "cds", "rm", "gm", "lm"]);
const ASYNC_MODULES = new Set(["tt"]);

// IOC type -> StealthMole module routing table.
const ROUTES = {
  ipv4: [{ module: "cds", kind: "sync", query: (v) => `ip:${v}` }],
  domain: [
    { module: "cl", kind: "sync", query: (v) => `domain:${v}` },
    { module: "cds", kind: "sync", query: (v) => `domain:${v}` },
    { module: "rm", kind: "sync", query: (v) => `domain:${v}` }
  ],
  url: [{ module: "cds", kind: "sync", query: (v) => `url:${v}` }],
  email: [
    { module: "cl", kind: "sync", query: (v) => `email:${v}` },
    { module: "cds", kind: "sync", query: (v) => `email:${v}` }
  ],
  md5: [{ module: "tt", kind: "async", indicator: "hash" }],
  sha1: [{ module: "tt", kind: "async", indicator: "hash" }],
  sha256: [{ module: "tt", kind: "async", indicator: "hash" }],
  btc_address: [{ module: "tt", kind: "async", indicator: "bitcoin" }],
  eth_address: [{ module: "tt", kind: "async", indicator: "ethereum" }],
  telegram: [{ module: "tt", kind: "async", indicator: "telegram" }],
  cve: [{ module: "tt", kind: "async", indicator: "cve" }],
  discord_id: [{ module: "tt", kind: "async", indicator: "discord" }],
  keyword: [
    { module: "tt", kind: "async", indicator: "keyword" },
    { module: "rm", kind: "sync", query: (v) => v },
    { module: "gm", kind: "sync", query: (v) => v },
    { module: "lm", kind: "sync", query: (v) => v }
  ]
};

function routesFor(iocType) {
  return ROUTES[iocType] || ROUTES.keyword;
}

// --- JWT (fresh per request; the API rejects a reused JWT with 401) ---
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

// --- Rate limiter: serialize calls with a minimum gap between requests ---
let requestQueue = Promise.resolve();
let lastRequestAt = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function throttled(fn) {
  const run = requestQueue.then(async () => {
    const wait = Math.max(0, lastRequestAt + stealthmole.minRequestIntervalMs - Date.now());
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();
    return fn();
  });
  requestQueue = run.then(
    () => {},
    () => {}
  );
  return run;
}

// --- Cache: module+query -> { data, expiresAt } ---
const cache = new Map();

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return hit.data;
}

function cacheSet(key, data) {
  cache.set(key, { data, expiresAt: Date.now() + stealthmole.cacheTtlMs });
}

async function apiFetch(pathname, params) {
  const url = new URL(pathname, stealthmole.baseUrl);
  for (const [key, value] of Object.entries(params || {})) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  return throttled(async () => {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${createJwt()}`,
        Accept: "application/json"
      }
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw Object.assign(new Error(body.detail || `StealthMole ${response.status}`), {
        status: response.status,
        detail: body.detail
      });
    }
    return body;
  });
}

function unixToIso(seconds) {
  if (!seconds && seconds !== 0) return null;
  return new Date(Number(seconds) * 1000).toISOString();
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function compactText(...parts) {
  return parts
    .filter((part) => part !== undefined && part !== null && String(part).trim() !== "")
    .map((part) => String(part).trim())
    .join(" | ");
}

function present(value) {
  return value ? "present" : "-";
}

function firstReadableLine(value, fallback) {
  const line = String(value || "")
    .split(/\r?\n/)
    .map((part) => part.trim())
    .find(Boolean);
  return (line || fallback || "(untitled)").slice(0, 140);
}

function targetLabel(target) {
  const labels = {
    "telegram.message": "Telegram message",
    "telegram.channel": "Telegram channel",
    "telegram.user": "Telegram user",
    "telegram.user-profile": "Telegram user profile",
    "telegram.channel-profile": "Telegram channel profile",
    cve: "CVE",
    hash: "Hash",
    bitcoin: "Bitcoin",
    ethereum: "Ethereum",
    discord: "Discord",
    image: "Image",
    document: "Document",
    exefile: "Executable file",
    otherfile: "Other file",
    compressed: "Compressed file"
  };
  return labels[target] || target || "Telegram Tracker";
}

function isTelegramIndicator(indicator) {
  return indicator === "telegram";
}

function isTelegramTarget(target) {
  return /^telegram(?:[.-]|$)/.test(String(target || ""));
}

function isTelegramMessageTarget(target) {
  return String(target || "").startsWith("telegram.message");
}

function isTelegramChannelTarget(target) {
  return String(target || "").startsWith("telegram.channel") || String(target || "").includes("channel");
}

function isTelegramUserTarget(target) {
  return String(target || "").startsWith("telegram.user") || String(target || "").includes("user");
}

function ttTargetPriority(target, indicator) {
  if (target === indicator) return 0;

  if (isTelegramIndicator(indicator)) {
    if (isTelegramMessageTarget(target)) return 0;
    if (isTelegramChannelTarget(target)) return 1;
    if (isTelegramUserTarget(target)) return 2;
    if (isTelegramTarget(target)) return 3;
    return 4;
  }

  if (!isTelegramTarget(target)) return 1;
  if (isTelegramMessageTarget(target)) return 2;
  if (isTelegramChannelTarget(target)) return 3;
  if (isTelegramUserTarget(target)) return 4;
  return 5;
}

function sortTtResults(a, b, indicator) {
  const targetA = a.raw_response?.__target;
  const targetB = b.raw_response?.__target;
  return (
    ttTargetPriority(targetA, indicator) - ttTargetPriority(targetB, indicator) ||
    new Date(b.timestamp || 0) - new Date(a.timestamp || 0) ||
    String(a.title || "").localeCompare(String(b.title || ""))
  );
}

function normalizeComparableText(value) {
  return stripHtml(value)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function isDirectTtMatch(item, queryText) {
  const query = normalizeComparableText(queryText);
  if (!query) return true;
  const fields = [item.highlight, item.value, item.metadata]
    .map(normalizeComparableText)
    .filter(Boolean);
  return fields.some((field) => field.includes(query));
}

function cleanDisplayValue(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^(n\/a|na|null|none|unknown|-+)$/i.test(text)) return "";
  return text;
}

function joinDisplayParts(parts) {
  return parts.map(cleanDisplayValue).filter(Boolean).join(" | ");
}

// Convert each module's native response shape into the unified result schema.
function normalizeItem(module, item) {
  switch (module) {
    case "cl":
      return {
        id: item.id,
        source_url: null,
        title: `Credential leak: ${item.email || item.domain || "unknown"}`,
        content: compactText(
          `domain=${item.domain || "-"}`,
          `email=${item.email || "-"}`,
          `password=${present(item.password)}`,
          `leaked_from=${item.leaked_from || "-"}`,
          `leaked_date=${item.leaked_date || "-"}`
        ),
        timestamp: item.leaked_date || null,
        forum_name: item.leaked_from || "Credential Lookout",
        author_alias: item.email || item.domain || null,
        indicators_tagged: [item.email, item.domain].filter(Boolean),
        raw_response: item
      };
    case "cb":
      return {
        id: item.id,
        source_url: null,
        title: `Combo leak: ${item.user || "unknown"}`,
        content: compactText(`user=${item.user || "-"}`, `password=${present(item.password)}`),
        timestamp: unixToIso(item.leakeddate),
        forum_name: "Combo Binder",
        author_alias: item.user || null,
        indicators_tagged: [item.user].filter(Boolean),
        raw_response: item
      };
    case "cds":
      return {
        id: item.id,
        source_url: null,
        title: `Stealer log: ${item.host || "unknown host"}`,
        content: compactText(
          `host=${item.host || "-"}`,
          `user=${item.user || "-"}`,
          `username=${item.username || "-"}`,
          `password=${present(item.password)}`,
          `ip=${item.ip || "-"}`,
          `computer=${item.computername || "-"}`
        ),
        timestamp: unixToIso(item.leakeddate),
        forum_name: "Compromised Data Set",
        author_alias: item.user || item.username || null,
        indicators_tagged: [item.host, item.user, item.ip].filter(Boolean),
        raw_response: item
      };
    case "rm":
      return {
        id: item.id,
        source_url: item.proof_url || null,
        title: `${item.attack_group || "Unknown group"} -> ${item.victim || "unknown victim"}`,
        content: compactText(
          `victim=${item.victim || "-"}`,
          `site=${item.site || "-"}`,
          `country=${item.country || "-"}`,
          `sector=${item.sector || "-"}`,
          item.proof_url && `proof=${item.proof_url}`
        ),
        timestamp: unixToIso(item.detection_datetime),
        forum_name: item.attack_group || "Ransomware Monitoring",
        author_alias: item.attack_group || null,
        indicators_tagged: [item.victim, item.site, item.domain].filter(Boolean),
        raw_response: item
      };
    case "gm":
    case "lm":
      return {
        id: item.id,
        source_url: item.proof_url || null,
        title: item.title || "(untitled)",
        content: compactText(item.title || "", item.author && `author=${item.author}`, item.proof_url && `proof=${item.proof_url}`),
        timestamp: unixToIso(item.detection_datetime),
        forum_name: module === "gm" ? "Government Monitoring" : "Leaked Monitoring",
        author_alias: item.author || null,
        indicators_tagged: [],
        raw_response: item
      };
    case "tt":
      {
        const target = item.__target || null;
        const content = stripHtml(item.highlight || item.value || "");
        const value = String(item.value || "");
        const valueLooksLikeNodeId = /^[0-9]+(?:_[0-9]+)?$/.test(value);
        const label = targetLabel(target);
        const title =
          target === "telegram.message" && item.highlight
            ? `${label}: ${firstReadableLine(content, value)}`
            : valueLooksLikeNodeId && content === value
            ? `${label} node ${value}`
            : valueLooksLikeNodeId
              ? `${label}: ${firstReadableLine(content, value)}`
              : `${label}: ${firstReadableLine(value, content)}`;
        return {
          id: item.id,
          source_url: null,
          title,
          content,
          timestamp: item.createDate ? new Date(item.createDate * 1000).toISOString() : null,
          forum_name: label,
          author_alias: null,
          indicators_tagged: [target, value].filter(Boolean),
          raw_response: item
        };
      }
    default:
      return {
        id: item.id || crypto.randomUUID(),
        source_url: null,
        title: "(unrecognized result)",
        content: JSON.stringify(item),
        timestamp: null,
        forum_name: module,
        author_alias: null,
        indicators_tagged: [],
        raw_response: item
      };
  }
}

function mockResult(module, value) {
  return {
    query_ioc: { type: "keyword", value },
    module,
    results_count: 1,
    results: [
      {
        id: `mock-${module}-1`,
        source_url: null,
        title: `[MOCK] ${module.toUpperCase()} result for ${value}`,
        content: `Mock mode is active (missing StealthMole credentials). indicator=${value} module=${module}`,
        timestamp: new Date().toISOString(),
        forum_name: "mock",
        author_alias: null,
        indicators_tagged: [value],
        raw_response: {}
      }
    ],
    cached: false,
    queried_at: new Date().toISOString()
  };
}

async function syncSearch(module, queryString, { limit = 50 } = {}) {
  if (stealthmole.mockMode) return mockResult(module, queryString);

  const key = `${module}:${queryString}:${limit}`;
  const cached = cacheGet(key);
  if (cached) return { ...cached, cached: true };

  const body = await apiFetch(`/${module}/search`, { query: queryString, limit });
  const results = (body.data || []).map((item) => normalizeItem(module, item));
  const normalized = {
    module,
    results_count: body.totalCount ?? results.length,
    results,
    queried_at: new Date().toISOString()
  };
  cacheSet(key, normalized);
  return { ...normalized, cached: false };
}

async function asyncSearchAll(indicator, text, { limit = 100, maxPolls = 3, pollDelayMs = 1200 } = {}) {
  if (stealthmole.mockMode) return mockResult("tt", text);

  const key = `tt:${indicator}:${text}:${limit}`;
  const cached = cacheGet(key);
  if (cached) return { ...cached, cached: true };

  const body = await apiFetch(`/tt/search/${indicator}/target/all`, { text, limit });
  const collected = [];
  const pendingPolls = [];

  for (const [targetName, target] of Object.entries(body || {})) {
    if (Array.isArray(target.data)) {
      collected.push(...target.data.map((item) => ({ ...item, __target: targetName })));
    }
    const pollId = target.id || target.cid;
    if (target.last === false && pollId) {
      pendingPolls.push({ pollId, targetName });
    }
  }

  let stillProcessing = false;
  for (const { pollId, targetName } of pendingPolls) {
    let last = false;
    for (let attempt = 0; attempt < maxPolls && !last; attempt += 1) {
      await sleep(pollDelayMs);
      const page = await apiFetch(`/tt/search/${pollId}`, { limit });
      if (Array.isArray(page.data)) {
        collected.push(...page.data.map((item) => ({ ...item, __target: targetName })));
      }
      last = page.last === true;
    }
    if (!last) stillProcessing = true;
  }

  const directMatches = collected.filter((item) => isDirectTtMatch(item, text));
  const results = directMatches.map((item) => normalizeItem("tt", item)).sort((a, b) => sortTtResults(a, b, indicator));
  const normalized = {
    module: "tt",
    results_count: results.length,
    results,
    still_processing: stillProcessing,
    queried_at: new Date().toISOString()
  };
  cacheSet(key, normalized);
  return { ...normalized, cached: false };
}

// Best-effort extraction of human-readable text from a /{service}/node
// response. The schema varies a lot by node category (telegram.message,
// telegram.user, document, ip, wallet, ...), so this tries known fields in
// priority order rather than assuming one shape.
function pickReadableText(node) {
  if (!node || typeof node !== "object") return null;
  if (typeof node.message === "string" && node.message.trim()) return node.message;
  if (Array.isArray(node.message) && node.message.length) return node.message.join("\n---\n");
  if (typeof node.text === "string" && node.text.trim()) return node.text;
  if (node.first_name || node.last_name || (Array.isArray(node.username) && node.username.length)) {
    const name = [node.first_name, node.last_name].map(cleanDisplayValue).filter(Boolean).join(" ");
    const handles = Array.isArray(node.username)
      ? node.username
          .map(cleanDisplayValue)
          .filter(Boolean)
          .map((h) => `@${String(h).replace(/^@/, "")}`)
          .join(", ")
      : "";
    const profile = joinDisplayParts([name, handles, node.phone]);
    return profile ? `Telegram user: ${profile}` : null;
  }
  if (node.title || node.url) {
    const channel = joinDisplayParts([node.title, node.url, node.countMembers && `members=${node.countMembers}`]);
    return channel ? `Telegram channel: ${channel}` : null;
  }
  if (node.domain) return joinDisplayParts([node.domain, node.ip && `ip=${node.ip}`]) || null;
  return null;
}

// Drill-down for a single search result (M5 "click to open document"). Only
// called lazily when an analyst opens a document, not for every list item,
// since node lookups consume StealthMole quota per call.
async function getNodeDetail(service, id, pid) {
  if (stealthmole.mockMode || !id) return null;

  const key = `node:${service}:${id}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  try {
    const node = await apiFetch(`/${service}/node`, { id, pid, include_contents: true });
    const readable = pickReadableText(node);
    const detail = readable ? { title: readable.slice(0, 140), content: readable, raw_node: node } : null;
    cacheSet(key, detail);
    return detail;
  } catch (error) {
    console.error(`Node detail lookup failed for ${service}:${id}`, error.detail || error.message);
    return null;
  }
}

async function getQuotas() {
  if (stealthmole.mockMode) {
    return {
      CDS: { allowed: 1000, used: 0 },
      CL: { allowed: 500, used: 0 },
      CB: { allowed: 500, used: 0 },
      TT: { allowed: 200, used: 0 },
      RM: { allowed: 200, used: 0 },
      GM: { allowed: 200, used: 0 },
      LM: { allowed: 200, used: 0 }
    };
  }
  return apiFetch("/user/quotas", {});
}

// Runs every route for a single IOC and returns one normalized result per module.
async function queryIoc(ioc) {
  const routes = routesFor(ioc.type);
  const settled = await Promise.allSettled(
    routes.map(async (route) => {
      if (route.kind === "sync") {
        const queryString = route.query(ioc.value);
        const result = await syncSearch(route.module, queryString, {});
        return { ...result, query_ioc: { type: ioc.type, value: ioc.value } };
      }
      const result = await asyncSearchAll(route.indicator, ioc.value, {});
      return { ...result, query_ioc: { type: ioc.type, value: ioc.value } };
    })
  );

  return settled.map((entry, index) => {
    if (entry.status === "fulfilled") return entry.value;
    return {
      query_ioc: { type: ioc.type, value: ioc.value },
      module: routes[index].module,
      results_count: 0,
      results: [],
      cached: false,
      error: entry.reason.detail || entry.reason.message,
      queried_at: new Date().toISOString()
    };
  });
}

module.exports = {
  routesFor,
  syncSearch,
  asyncSearchAll,
  queryIoc,
  getQuotas,
  getNodeDetail,
  SYNC_MODULES,
  ASYNC_MODULES
};
