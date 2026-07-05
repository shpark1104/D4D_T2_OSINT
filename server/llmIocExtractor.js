const { callLlm, extractJson, isEnabled } = require("./llmClient");

const CHUNK_SIZE = 4000;
const CHUNK_OVERLAP = 200;
// Chunks are sent to OpenAI in parallel (not sequentially) so a long paste
// doesn't add up to N x per-chunk latency and blow past the serverless
// function time limit. Cap the chunk count so an extremely long paste can't
// fire off unbounded concurrent requests; regex extraction still covers the
// full text regardless of this cap.
const MAX_LLM_CHUNKS = 6;

const KNOWN_IOC_TYPES = new Set([
  "ipv4",
  "domain",
  "url",
  "email",
  "md5",
  "sha1",
  "sha256",
  "btc_address",
  "eth_address",
  "cve",
  "telegram",
  "discord_id",
  "mitre_attack_id"
]);

// Safety net against LLM misclassification (e.g. tagging a ransom amount like
// "5 BTC" as a btc_address) - a value must match its claimed type's shape or
// it is dropped rather than sent on to StealthMole as a bogus query.
const VALUE_VALIDATORS = {
  ipv4: /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/,
  domain: /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/i,
  url: /^https?:\/\/\S+$/i,
  email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  md5: /^[a-fA-F0-9]{32}$/,
  sha1: /^[a-fA-F0-9]{40}$/,
  sha256: /^[a-fA-F0-9]{64}$/,
  btc_address: /^(?:[13][a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-z0-9]{25,59})$/,
  eth_address: /^0x[a-fA-F0-9]{40}$/,
  cve: /^CVE-\d{4}-\d{4,7}$/i,
  telegram: /^@[a-zA-Z][a-zA-Z0-9_]{4,31}$/,
  discord_id: /^\d{17,19}$/,
  mitre_attack_id: /^T\d{4}(?:\.\d{3})?$/
};

function isPlausibleValue(type, value) {
  const validator = VALUE_VALIDATORS[type];
  if (!validator) return true;
  return validator.test(value.replace(/\s+/g, ""));
}

const SYSTEM_PROMPT = `You are a CTI (Cyber Threat Intelligence) analyst assistant.
You review raw incident text (logs, notes, forum posts) and find:
1) Indicators of Compromise that a plain regex would miss: obfuscated/defanged values,
   values split across line breaks, or values embedded in natural language.
2) Semantic threat entities: threat actor names/aliases, campaign names, malware family names.

Respond with ONLY a JSON array, no prose. Each element:
{
  "value": "the exact substring as it appears in the text (verbatim, do not paraphrase)",
  "type": "ipv4|domain|url|email|md5|sha1|sha256|btc_address|eth_address|cve|telegram|discord_id|mitre_attack_id|threat_actor_alias|campaign|malware",
  "context_classification": "attacker_infrastructure|victim_asset|unrelated",
  "confidence": 0.0-1.0,
  "reasoning": "one short sentence"
}

Strict rules:
- Only tag "btc_address"/"eth_address" when the value is an actual wallet address
  string (e.g. starts with 1/3/bc1 for Bitcoin, 0x + 40 hex chars for Ethereum).
  A ransom amount like "5 BTC" or "0.5 ETH" is NOT an address - skip it entirely,
  it is not an IOC.
- Only tag "md5"/"sha1"/"sha256" when the value is (or reassembles into) a valid
  hex hash of the exact expected length (32/40/64 hex chars).
- If you are not confident a value is a real indicator, omit it rather than guessing.

If nothing is found, respond with [].`;

function chunkText(text) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(text.length, start + CHUNK_SIZE);
    chunks.push({ start, text: text.slice(start, end) });
    if (end === text.length) break;
    start = end - CHUNK_OVERLAP;
  }
  return chunks.length ? chunks : [{ start: 0, text }];
}

function locateInText(fullText, value, hintStart) {
  if (!value) return null;
  const window = 2000;
  const searchStart = Math.max(0, hintStart - window);
  const searchEnd = Math.min(fullText.length, hintStart + window);
  const localIndex = fullText.slice(searchStart, searchEnd).indexOf(value);
  if (localIndex !== -1) return searchStart + localIndex;

  const globalIndex = fullText.indexOf(value);
  return globalIndex === -1 ? null : globalIndex;
}

async function extractIocsWithLlm(text, sourceFile = "message") {
  if (!isEnabled() || !text || !text.trim()) {
    return { iocs: [], entities: [] };
  }

  const chunks = chunkText(text).slice(0, MAX_LLM_CHUNKS);
  const iocs = [];
  const entities = [];
  const seenIocKeys = new Set();
  const seenEntityKeys = new Set();

  const chunkResults = await Promise.all(
    chunks.map(async (chunk) => {
      try {
        const { text: responseText } = await callLlm({
          system: SYSTEM_PROMPT,
          prompt: chunk.text,
          maxTokens: 2000
        });
        const items = extractJson(responseText);
        return { chunk, items: Array.isArray(items) ? items : [] };
      } catch (error) {
        console.error("LLM IOC extraction failed for a chunk:", error.message);
        return { chunk, items: [] };
      }
    })
  );

  for (const { chunk, items } of chunkResults) {
    for (const item of items) {
      if (!item || typeof item.value !== "string" || !item.value.trim()) continue;
      const value = item.value.trim();
      const type = String(item.type || "").toLowerCase();
      const confidence = Math.max(0, Math.min(1, Number(item.confidence) || 0.5));
      const offsetStart = locateInText(text, value, chunk.start);
      const offsetEnd = offsetStart === null ? null : offsetStart + value.length;
      const lineNumber = offsetStart === null ? null : text.slice(0, offsetStart).split("\n").length;
      const context =
        offsetStart === null
          ? value
          : text.slice(Math.max(0, offsetStart - 50), Math.min(text.length, offsetEnd + 50));

      if (KNOWN_IOC_TYPES.has(type)) {
        if (!isPlausibleValue(type, value)) continue;
        const normalizedValue = value.replace(/\s+/g, "");
        const key = `${type}:${normalizedValue.toLowerCase()}`;
        if (seenIocKeys.has(key)) continue;
        seenIocKeys.add(key);
        iocs.push({
          id: `llm-${seenIocKeys.size}-${Date.now()}`,
          type,
          value: normalizedValue,
          raw_value: value,
          source_file: sourceFile,
          line_number: lineNumber,
          offset: offsetStart === null ? null : { start: offsetStart, end: offsetEnd },
          context,
          confidence,
          extraction_method: "llm",
          context_classification: item.context_classification || "unrelated",
          reasoning: item.reasoning || ""
        });
      } else if (["threat_actor_alias", "campaign", "malware"].includes(type)) {
        const key = `${type}:${value.toLowerCase()}`;
        if (seenEntityKeys.has(key)) continue;
        seenEntityKeys.add(key);
        entities.push({
          type,
          value,
          source_file: sourceFile,
          line_number: lineNumber,
          context,
          confidence,
          context_classification: item.context_classification || "unrelated",
          reasoning: item.reasoning || ""
        });
      }
    }
  }

  return { iocs, entities };
}

module.exports = { extractIocsWithLlm };
