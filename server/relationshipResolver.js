const crypto = require("crypto");
const { extractIocsFromText } = require("./iocExtractor");

const REVIEW_STATUSES = new Set([
  "weak_candidate",
  "review_needed",
  "probable_same_cluster",
  "rejected",
  "confirmed_by_analyst"
]);

const STRONG_TYPES = new Set(["email", "btc_address", "eth_address", "telegram"]);
const TRACKED_IOC_TYPES = new Set([
  "email",
  "btc_address",
  "eth_address",
  "telegram",
  "domain",
  "url"
]);

const ALIAS_KEYS = /(alias|user(name)?|nick(name)?|handle|author|actor|channel|screen_?name|display_?name|name)$/i;
const GENERIC_ALIASES = new Set([
  "unknown",
  "admin",
  "user",
  "none",
  "null",
  "true",
  "false",
  "telegram",
  "channel",
  "message"
]);

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function relationshipId(subject, object, relation) {
  return crypto
    .createHash("sha1")
    .update(`${relation}|${normalize(subject)}|${normalize(object)}`)
    .digest("hex")
    .slice(0, 16);
}

function contextSnippet(value) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 220);
}

function statusForScore(score) {
  if (score >= 0.75) return "probable_same_cluster";
  if (score >= 0.5) return "review_needed";
  return "weak_candidate";
}

function isAliasLike(value) {
  const text = String(value || "").trim();
  if (text.length < 3 || text.length > 64) return false;
  if (GENERIC_ALIASES.has(text.toLowerCase())) return false;
  if (/^https?:\/\//i.test(text)) return false;
  if (/^[\d\s._:-]+$/.test(text)) return false;
  if (/@.+\./.test(text)) return false;
  if (/\s{2,}/.test(text)) return false;
  return /[a-zA-Z가-힣_@.-]/.test(text);
}

function identifierKey(identifier) {
  return `${identifier.type}:${normalize(identifier.value)}`;
}

function pushIdentifier(target, seen, identifier) {
  if (!identifier.value) return;
  const key = `${identifier.type}:${normalize(identifier.value)}:${identifier.sourceDocumentId || ""}:${identifier.origin || ""}`;
  if (seen.has(key)) return;
  seen.add(key);
  target.push(identifier);
}

function sourceNameFromDoc(doc) {
  return doc.title || doc.name || doc.id || "document";
}

function collectTextIocs(text, sourceDocumentId, sourceName, origin) {
  return extractIocsFromText(text || "", sourceName)
    .filter((ioc) => TRACKED_IOC_TYPES.has(ioc.type))
    .map((ioc) => ({
      type: ioc.type,
      value: ioc.value,
      sourceDocumentId,
      sourceName,
      origin,
      context: contextSnippet(ioc.context),
      confidence: ioc.confidence || 1
    }));
}

function walkRaw(value, visit, path = []) {
  if (value === null || value === undefined) return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkRaw(item, visit, [...path, String(index)]));
    return;
  }
  if (typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      walkRaw(child, visit, [...path, key]);
    }
    return;
  }
  visit(path, value);
}

function collectRawIdentifiers(raw, sourceDocumentId, sourceName) {
  const identifiers = [];
  const seen = new Set();

  walkRaw(raw, (path, value) => {
    const text = String(value || "");
    const field = path[path.length - 1] || "raw";
    for (const ioc of collectTextIocs(text, sourceDocumentId, sourceName, `raw_response.${path.join(".")}`)) {
      pushIdentifier(identifiers, seen, ioc);
    }
    if (ALIAS_KEYS.test(field) && isAliasLike(text)) {
      pushIdentifier(identifiers, seen, {
        type: text.startsWith("@") ? "telegram" : "alias",
        value: text.startsWith("@") ? text : text.replace(/^@/, ""),
        sourceDocumentId,
        sourceName,
        origin: `raw_response.${path.join(".")}`,
        context: `${field}: ${contextSnippet(text)}`,
        confidence: 0.72
      });
    }
  });

  return identifiers;
}

function collectInputIdentifiers(session) {
  const identifiers = [];
  const seen = new Set();

  for (const ioc of session.iocs || []) {
    if (!TRACKED_IOC_TYPES.has(ioc.type)) continue;
    pushIdentifier(identifiers, seen, {
      type: ioc.type,
      value: ioc.value,
      sourceDocumentId: ioc.source_document_id || ioc.source_file || "input",
      sourceName: ioc.source_file || "input",
      origin: "input_ioc",
      context: contextSnippet(ioc.context || ioc.raw_value || ioc.value),
      confidence: ioc.confidence || 1
    });
  }

  for (const entity of session.entities || []) {
    if (!["threat_actor_alias", "campaign", "malware", "alias"].includes(entity.type)) continue;
    pushIdentifier(identifiers, seen, {
      type: entity.type === "threat_actor_alias" ? "alias" : entity.type,
      value: entity.value,
      sourceDocumentId: entity.source_document_id || entity.source_file || "input",
      sourceName: entity.source_file || "input",
      origin: "input_llm_entity",
      context: contextSnippet(entity.context || entity.reasoning || entity.value),
      confidence: entity.confidence || 0.6
    });
  }

  return identifiers;
}

function collectResultIdentifiers(session) {
  const identifiers = [];
  const seen = new Set();

  for (const doc of session.documents.values()) {
    const sourceName = sourceNameFromDoc(doc);
    for (const ioc of collectTextIocs(doc.content || "", doc.id, sourceName, "normalized_content")) {
      pushIdentifier(identifiers, seen, ioc);
    }
    for (const ioc of collectRawIdentifiers(doc.raw_response || {}, doc.id, sourceName)) {
      pushIdentifier(identifiers, seen, ioc);
    }
    if (doc.author_alias && isAliasLike(doc.author_alias)) {
      pushIdentifier(identifiers, seen, {
        type: "alias",
        value: doc.author_alias,
        sourceDocumentId: doc.id,
        sourceName,
        origin: "author_alias",
        context: `author_alias: ${contextSnippet(doc.author_alias)}`,
        confidence: 0.72
      });
    }
  }

  return identifiers;
}

function relationScore(relation, left, right, base) {
  const strong = STRONG_TYPES.has(left.type) || STRONG_TYPES.has(right.type);
  if (relation === "same_identifier_observed") return strong ? 0.92 : 0.82;
  if (relation === "possible_same_actor") return strong ? 0.82 : 0.68;
  if (relation === "repeated_alias_cluster") return base;
  return Math.min(0.74, base + (strong ? 0.15 : 0));
}

function addRelationship(map, candidate, reviewOverrides) {
  const left = String(candidate.subject || "");
  let right = String(candidate.object || "");
  if (!left || !right) return;
  if (normalize(left) === normalize(right)) {
    if (candidate.relation !== "same_identifier_observed") return;
    right = `${right} (StealthMole)`;
  }

  const ordered = [left, right].sort((a, b) => normalize(a).localeCompare(normalize(b)));
  const id = relationshipId(ordered[0], ordered[1], candidate.relation);
  const existing = map.get(id);
  const score = Math.max(existing?.score || 0, candidate.score || 0);
  const evidence = Array.from(new Set([...(existing?.evidence || []), ...(candidate.evidence || [])])).slice(0, 8);
  const sources = Array.from(new Set([...(existing?.sources || []), ...(candidate.sources || [])])).slice(0, 8);
  const reviewStatus = reviewOverrides.get(id);

  map.set(id, {
    id,
    subject: ordered[0],
    object: ordered[1],
    relation: candidate.relation,
    score,
    status: reviewStatus || statusForScore(score),
    reviewStatus: reviewStatus || null,
    reason: candidate.reason || existing?.reason || "",
    evidence,
    sources,
    identifiers: Array.from(new Set([...(existing?.identifiers || []), ...(candidate.identifiers || [])])).slice(0, 8)
  });
}

function buildRelationships(session, reviewOverrides = new Map()) {
  const relationships = new Map();
  const inputIdentifiers = collectInputIdentifiers(session);
  const resultIdentifiers = collectResultIdentifiers(session);
  const inputByValue = new Map(inputIdentifiers.map((item) => [identifierKey(item), item]));

  for (const result of resultIdentifiers) {
    const matchingInput = inputByValue.get(identifierKey(result));
    if (matchingInput) {
      addRelationship(
        relationships,
        {
          subject: matchingInput.value,
          object: result.value,
          relation: "same_identifier_observed",
          score: relationScore("same_identifier_observed", matchingInput, result),
          reason: `Input ${matchingInput.type} was also observed in StealthMole ${result.origin}.`,
          evidence: [
            `input ${matchingInput.type} ${matchingInput.value} from ${matchingInput.sourceName}`,
            `StealthMole ${result.origin} in ${result.sourceName}: ${result.context || result.value}`
          ],
          sources: [matchingInput.sourceDocumentId, result.sourceDocumentId],
          identifiers: [matchingInput.type, result.type]
        },
        reviewOverrides
      );
    }
  }

  const resultByDoc = new Map();
  for (const identifier of resultIdentifiers) {
    if (!resultByDoc.has(identifier.sourceDocumentId)) resultByDoc.set(identifier.sourceDocumentId, []);
    resultByDoc.get(identifier.sourceDocumentId).push(identifier);
  }

  for (const input of inputIdentifiers) {
    for (const [docId, identifiers] of resultByDoc) {
      const hasInputInDoc = identifiers.some((item) => normalize(item.value) === normalize(input.value));
      if (!hasInputInDoc) continue;
      const aliases = identifiers.filter((item) => item.type === "alias" || item.type === "telegram");
      for (const alias of aliases) {
        if (normalize(alias.value) === normalize(input.value)) continue;
        addRelationship(
          relationships,
          {
            subject: input.value,
            object: alias.value,
            relation: "appeared_with",
            score: relationScore("appeared_with", input, alias, 0.48),
            reason: `Input identifier and StealthMole alias appeared in the same result document.`,
            evidence: [
              `${input.value} matched result document ${alias.sourceName}`,
              `${alias.type} ${alias.value} was extracted from ${alias.origin}: ${alias.context || alias.value}`
            ],
            sources: [input.sourceDocumentId, docId],
            identifiers: [input.type, alias.type]
          },
          reviewOverrides
        );
      }
    }
  }

  const strongToAliases = new Map();
  for (const [docId, identifiers] of resultByDoc) {
    const strongIdentifiers = identifiers.filter((item) => STRONG_TYPES.has(item.type));
    const aliases = identifiers.filter((item) => item.type === "alias" || item.type === "telegram");
    for (const strong of strongIdentifiers) {
      const key = identifierKey(strong);
      if (!strongToAliases.has(key)) strongToAliases.set(key, { strong, aliases: [], docs: new Set() });
      const entry = strongToAliases.get(key);
      for (const alias of aliases) entry.aliases.push(alias);
      entry.docs.add(docId);
    }
  }

  for (const entry of strongToAliases.values()) {
    const aliases = Array.from(new Map(entry.aliases.map((item) => [normalize(item.value), item])).values());
    for (let i = 0; i < aliases.length; i += 1) {
      for (let j = i + 1; j < aliases.length; j += 1) {
        addRelationship(
          relationships,
          {
            subject: aliases[i].value,
            object: aliases[j].value,
            relation: "possible_same_actor",
            score: relationScore("possible_same_actor", entry.strong, aliases[i], 0.72),
            reason: `Both aliases share strong identifier ${entry.strong.type}:${entry.strong.value}.`,
            evidence: [
              `${aliases[i].value} and ${aliases[j].value} were seen with ${entry.strong.type} ${entry.strong.value}`,
              `shared identifier appears across ${entry.docs.size} StealthMole result document(s)`
            ],
            sources: Array.from(entry.docs),
            identifiers: [aliases[i].type, aliases[j].type, entry.strong.type]
          },
          reviewOverrides
        );
      }
    }
  }

  const aliasOccurrences = new Map();
  for (const identifier of resultIdentifiers.filter((item) => item.type === "alias" || item.type === "telegram")) {
    const key = normalize(identifier.value);
    if (!aliasOccurrences.has(key)) aliasOccurrences.set(key, { value: identifier.value, docs: new Set(), contexts: [] });
    const entry = aliasOccurrences.get(key);
    entry.docs.add(identifier.sourceDocumentId);
    if (identifier.context) entry.contexts.push(identifier.context);
  }

  for (const entry of aliasOccurrences.values()) {
    if (entry.docs.size < 2) continue;
    const score = Math.min(0.86, 0.5 + entry.docs.size * 0.08);
    addRelationship(
      relationships,
      {
        subject: entry.value,
        object: `${entry.value} activity cluster`,
        relation: "repeated_alias_cluster",
        score,
        reason: `Alias ${entry.value} repeatedly appears across ${entry.docs.size} StealthMole result documents.`,
        evidence: [
          `repeated in ${entry.docs.size} result documents`,
          ...entry.contexts.slice(0, 3).map((context) => `context: ${context}`)
        ],
        sources: Array.from(entry.docs),
        identifiers: ["alias"]
      },
      reviewOverrides
    );
  }

  return Array.from(relationships.values()).sort((a, b) => b.score - a.score || a.subject.localeCompare(b.subject));
}

function validReviewStatus(status) {
  return REVIEW_STATUSES.has(status);
}

module.exports = {
  buildRelationships,
  collectInputIdentifiers,
  collectResultIdentifiers,
  validReviewStatus
};
