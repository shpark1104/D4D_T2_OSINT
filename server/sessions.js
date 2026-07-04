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

function addMessage(session, { role = "user", text = "", files = [] }) {
  const message = {
    id: crypto.randomUUID(),
    role,
    text,
    files: files.map((file) => ({ name: file.name, size: file.content ? file.content.length : 0 })),
    createdAt: new Date().toISOString()
  };
  session.messages.push(message);
  return message;
}

function setIocs(session, iocs) {
  session.iocs = iocs;
  refreshRelationships(session);
}

function addEntities(session, entities) {
  const seen = new Set(session.entities.map((e) => `${e.type}:${e.value.toLowerCase()}`));
  for (const entity of entities) {
    const key = `${entity.type}:${entity.value.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    session.entities.push(entity);
  }
  refreshRelationships(session);
}

// Flattens StealthMole query results into a per-document index the UI can
// list, filter, and click into (M4/M5 entry point).
function addQueryResults(session, queryResultsByIoc) {
  for (const iocResults of queryResultsByIoc) {
    for (const result of iocResults) {
      session.queryResults.push(result);
      for (const item of result.results || []) {
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
            ? Array.from(new Set([...existing.matched_iocs, result.query_ioc.value]))
            : [result.query_ioc.value],
          semanticHighlights: existing ? existing.semanticHighlights : null
        };
        session.documents.set(docId, doc);
      }
    }
  }
  refreshRelationships(session);
}

function listDocuments(session, { module, sort = "recent", cursor = 0, limit = 20 } = {}) {
  let docs = Array.from(session.documents.values());
  if (module) docs = docs.filter((doc) => doc.module === module);

  if (sort === "recent") {
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

function iocKey(ioc) {
  return `${ioc.type}:${String(ioc.value).toLowerCase()}`;
}

function isQueried(session, ioc) {
  return session.queriedIocKeys.has(iocKey(ioc));
}

function markQueried(session, ioc) {
  session.queriedIocKeys.add(iocKey(ioc));
}

function refreshRelationships(session, targetIocs = null) {
  const relationshipSession = targetIocs?.length ? { ...session, iocs: targetIocs } : session;
  const relationships = buildRelationships(relationshipSession, session.relationshipReviews);
  session.relationships = relationships;
  return relationships;
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
  return session.relationships.find((item) => item.id === relationshipId) || { ...existing, status, reviewStatus: status };
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
  isQueried,
  markQueried,
  refreshRelationships,
  listRelationships,
  updateRelationshipStatus
};
