const crypto = require("crypto");
const { buildRelationships, validReviewStatus } = require("./relationshipResolver");

const sessions = new Map();

function createSession(title) {
  const session = {
    id: crypto.randomUUID(),
    title: title || "New incident",
    createdAt: new Date().toISOString(),
    messages: [],
    iocs: [],
    entities: [],
    sourceDocuments: new Map(),
    queryResults: [],
    documents: new Map(),
    queriedIocKeys: new Set(),
    relationships: [],
    relationshipReviews: new Map()
  };
  sessions.set(session.id, session);
  return session;
}

function getSession(id) {
  return sessions.get(id) || null;
}

function addSourceDocument(session, { name, type = "input", content = "", createdAt = new Date().toISOString() }) {
  const document = {
    id: `source:${crypto.randomUUID()}`,
    module: "source",
    type,
    name,
    title: name,
    content,
    source_file: type === "message" ? "message" : name,
    size: content ? Buffer.byteLength(content, "utf8") : 0,
    timestamp: createdAt,
    forum_name: "Uploaded source",
    matched_iocs: []
  };
  session.sourceDocuments.set(document.id, document);
  return document;
}

function addMessage(session, { role = "user", text = "", files = [] }) {
  const createdAt = new Date().toISOString();
  const message = {
    id: crypto.randomUUID(),
    role,
    text,
    files: [],
    createdAt
  };

  if (String(text || "").trim()) {
    const sourceDoc = addSourceDocument(session, {
      name: "Analyst input",
      type: "message",
      content: text,
      createdAt
    });
    message.documentId = sourceDoc.id;
  }

  message.files = files.map((file) => {
    const sourceDoc = addSourceDocument(session, {
      name: file.name,
      type: "file",
      content: file.content || "",
      createdAt
    });
    return {
      name: file.name,
      size: sourceDoc.size,
      documentId: sourceDoc.id
    };
  });

  session.messages.push(message);
  return message;
}

function setIocs(session, iocs) {
  session.iocs = iocs;
}

function addEntities(session, entities) {
  const seen = new Set(session.entities.map((e) => `${e.type}:${e.value.toLowerCase()}`));
  for (const entity of entities) {
    const key = `${entity.type}:${entity.value.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    session.entities.push(entity);
  }
}

function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/^[-a-z_]+:/i, "")
    .replace(/hxxps?:\/\//g, "http://")
    .replace(/\[\.\]|\(.\)|\[dot\]/g, ".")
    .replace(/\[at\]|\(at\)|\[@\]/g, "@")
    .trim();
}

function tokenize(value) {
  const normalized = normalizeSearchText(value);
  const tokens = new Set();
  if (normalized) tokens.add(normalized);
  for (const token of normalized.matchAll(/[@a-z0-9가-힣][@a-z0-9가-힣._:-]{1,79}/gi)) {
    const item = token[0].toLowerCase();
    if (/[가-힣]/.test(item) ? item.length >= 2 : item.length >= 3) tokens.add(item);
  }
  return Array.from(tokens);
}

function textForSimilarity(item) {
  return normalizeSearchText(
    [
      item.title,
      item.content,
      item.source_url,
      item.timestamp,
      item.forum_name,
      item.author_alias,
      Array.isArray(item.indicators_tagged) ? item.indicators_tagged.join(" ") : "",
      JSON.stringify(item.raw_response || {})
    ].join(" ")
  );
}

function similarityFields(item) {
  return [
    ["title", item.title],
    ["content", item.content],
    ["source_url", item.source_url],
    ["forum", item.forum_name],
    ["author", item.author_alias],
    ["tags", Array.isArray(item.indicators_tagged) ? item.indicators_tagged.join(" ") : ""],
    ["raw_response", JSON.stringify(item.raw_response || {})]
  ]
    .map(([field, value]) => ({ field, text: String(value || "") }))
    .filter((entry) => entry.text.trim());
}

function contextSnippet(text, index, length) {
  const source = String(text || "").replace(/\s+/g, " ").trim();
  if (index < 0) return source.slice(0, 180);
  const start = Math.max(0, index - 90);
  const end = Math.min(source.length, index + length + 90);
  return `${start > 0 ? "..." : ""}${source.slice(start, end)}${end < source.length ? "..." : ""}`;
}

function findSimilarityContext(query, item, matchedTokens = []) {
  const needles = [query, ...matchedTokens]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  for (const { field, text } of similarityFields(item)) {
    const normalizedText = normalizeSearchText(text);
    for (const needle of needles) {
      const normalizedNeedle = normalizeSearchText(needle);
      if (!normalizedNeedle) continue;
      const index = normalizedText.indexOf(normalizedNeedle);
      if (index !== -1) {
        return {
          field,
          matched: needle,
          snippet: contextSnippet(text, index, needle.length)
        };
      }
    }
  }

  return {
    field: "content",
    matched: matchedTokens[0] || query,
    snippet: contextSnippet(item.content || item.title || JSON.stringify(item.raw_response || {}), 0, 0)
  };
}

function computeSimilarity(query, item) {
  const needle = normalizeSearchText(query);
  const haystack = textForSimilarity(item);
  if (!needle || !haystack) return { score: 0, reason: "empty query/result" };

  if (haystack.includes(needle)) {
    return {
      score: 1,
      reason: `exact match: ${needle}`,
      context: findSimilarityContext(query, item, [needle])
    };
  }

  const compactNeedle = needle.replace(/[\s._:-]+/g, "");
  const compactHaystack = haystack.replace(/[\s._:-]+/g, "");
  if (compactNeedle.length >= 6 && compactHaystack.includes(compactNeedle)) {
    return {
      score: 0.92,
      reason: `normalized match: ${needle}`,
      context: findSimilarityContext(query, item, [needle])
    };
  }

  const tokens = tokenize(needle);
  if (!tokens.length) return { score: 0, reason: "no comparable token" };
  const matched = tokens.filter((token) => haystack.includes(token));
  if (!matched.length) return { score: 0, reason: "no query token in result" };

  const longestRatio = Math.max(...matched.map((token) => Math.min(1, token.length / Math.max(needle.length, 1))));
  const overlapRatio = matched.length / tokens.length;
  const score = Math.min(0.9, 0.35 + overlapRatio * 0.35 + longestRatio * 0.2);
  return {
    score,
    reason: `token match: ${matched.slice(0, 3).join(", ")}`,
    context: findSimilarityContext(query, item, matched)
  };
}

// Flattens StealthMole query results into a per-document index the UI can
// list, filter, and click into (M4/M5 entry point).
function addQueryResults(session, queryResultsByIoc) {
  for (const iocResults of queryResultsByIoc) {
    for (const result of iocResults) {
      session.queryResults.push(result);
      for (const item of result.results || []) {
        const matchedValue = result.query_ioc?.value || "";
        const similarity = computeSimilarity(matchedValue, item);
        if (similarity.score < 0.18) continue;

        const docId = `${result.module}:${item.id}`;
        const existing = session.documents.get(docId);
        const doc = {
          id: docId,
          module: result.module,
          query_ioc: result.query_ioc,
          title: item.title,
          content: item.content,
          source_url: item.source_url,
          timestamp: item.timestamp,
          forum_name: item.forum_name,
          author_alias: item.author_alias,
          indicators_tagged: item.indicators_tagged,
          raw_response: item.raw_response,
          matched_iocs: existing
            ? Array.from(new Set([...existing.matched_iocs, matchedValue].filter(Boolean)))
            : [matchedValue].filter(Boolean),
          relevance_score: existing ? Math.max(existing.relevance_score || 0, similarity.score) : similarity.score,
          relevance_reason: similarity.reason,
          relevance_context: similarity.context,
          semanticHighlights: existing ? existing.semanticHighlights : null
        };
        session.documents.set(docId, doc);
      }
    }
  }
  refreshRelationships(session);
}

function listDocuments(session, { module, sort = "relevance", cursor = 0, limit = 20 } = {}) {
  let docs = Array.from(session.documents.values());
  if (module) docs = docs.filter((doc) => doc.module === module);

  if (sort === "relevance") {
    docs.sort(
      (a, b) =>
        Number(b.relevance_score || 0) - Number(a.relevance_score || 0) ||
        new Date(b.timestamp || 0) - new Date(a.timestamp || 0)
    );
  } else if (sort === "recent") {
    docs.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
  } else if (sort === "source") {
    docs.sort((a, b) => (a.forum_name || "").localeCompare(b.forum_name || ""));
  }

  const start = Number(cursor) || 0;
  const page = docs.slice(start, start + limit);
  return {
    totalCount: docs.length,
    cursor: start + page.length < docs.length ? start + page.length : null,
    limit,
    data: page
  };
}

function getDocument(session, docId) {
  return session.documents.get(docId) || null;
}

function listSourceDocuments(session) {
  return Array.from(session.sourceDocuments.values());
}

function getSourceDocument(session, docId) {
  return session.sourceDocuments.get(docId) || null;
}

function deleteSourceDocument(session, docId) {
  const doc = session.sourceDocuments.get(docId);
  if (!doc) return null;
  session.sourceDocuments.delete(docId);

  for (const message of session.messages) {
    if (message.documentId === docId) delete message.documentId;
    message.files = message.files.filter((file) => file.documentId !== docId);
  }

  session.iocs = session.iocs.filter((ioc) => ioc.source_document_id !== docId);
  session.entities = session.entities.filter((entity) => entity.source_document_id !== docId);
  refreshRelationships(session);
  return doc;
}

function findSourceDocumentByName(session, sourceFile) {
  const source = String(sourceFile || "");
  return (
    Array.from(session.sourceDocuments.values()).find((doc) => doc.source_file === source || doc.name === source) ||
    null
  );
}

function iocKey(ioc) {
  return `${ioc.type}:${String(ioc.value).toLowerCase()}`;
}

function isQueried(session, ioc) {
  return session.queriedIocKeys.has(iocKey(ioc));
}

function markQueried(session, ioc) {
  session.queriedIocKeys.add(iocKey(ioc));
}

function refreshRelationships(session) {
  session.relationships = buildRelationships(session, session.relationshipReviews);
  return session.relationships;
}

function listRelationships(session) {
  return session.relationships || [];
}

function updateRelationshipStatus(session, relationshipId, status) {
  if (!validReviewStatus(status)) {
    const error = new Error("Invalid relationship status");
    error.status = 400;
    throw error;
  }
  const existing = (session.relationships || []).find((item) => item.id === relationshipId);
  if (!existing) return null;
  session.relationshipReviews.set(relationshipId, status);
  refreshRelationships(session);
  return session.relationships.find((item) => item.id === relationshipId) || null;
}

module.exports = {
  createSession,
  getSession,
  addMessage,
  setIocs,
  addEntities,
  addQueryResults,
  listDocuments,
  getDocument,
  listSourceDocuments,
  getSourceDocument,
  deleteSourceDocument,
  findSourceDocumentByName,
  isQueried,
  markQueried,
  refreshRelationships,
  listRelationships,
  updateRelationshipStatus
};
