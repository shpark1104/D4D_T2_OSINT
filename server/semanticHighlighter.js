const { callLlm, extractJson, isEnabled } = require("./llmClient");

const CHUNK_SIZE = 6000;
// See llmIocExtractor.js for why chunks run in parallel with a cap instead
// of a sequential loop (avoids N x per-chunk latency on long documents).
const MAX_LLM_CHUNKS = 6;

const SYSTEM_PROMPT = `You are a CTI analyst assistant highlighting semantically important passages
in a dark-web / leak-forum style document for a human analyst.

Find short verbatim excerpts (a phrase or sentence, not the whole document) that fall into:
- "motive": threat actor motive or intent
- "technique": attack technique or TTP description
- "negotiation": deal/negotiation context (price, conditions, contact info)
- "victim": mention of victim organization or victim data

Respond with ONLY a JSON array, no prose. Each element:
{
  "category": "motive|technique|negotiation|victim",
  "quote": "verbatim excerpt copied exactly from the text, under 200 characters",
  "rationale": "one short sentence explaining why this matters"
}
If nothing qualifies, respond with [].`;

function chunkText(text) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(text.length, start + CHUNK_SIZE);
    chunks.push({ start, text: text.slice(start, end) });
    start = end;
  }
  return chunks.length ? chunks : [{ start: 0, text }];
}

async function getSemanticHighlights(documentText) {
  if (!isEnabled() || !documentText || !documentText.trim()) {
    return [];
  }

  const chunks = chunkText(documentText).slice(0, MAX_LLM_CHUNKS);
  const chunkResults = await Promise.all(
    chunks.map(async (chunk) => {
      try {
        const { text: responseText } = await callLlm({
          system: SYSTEM_PROMPT,
          prompt: chunk.text,
          maxTokens: 1500
        });
        const items = extractJson(responseText);
        return { chunk, items: Array.isArray(items) ? items : [] };
      } catch (error) {
        console.error("Semantic highlighting failed for a chunk:", error.message);
        return { chunk, items: [] };
      }
    })
  );

  const highlights = [];
  for (const { chunk, items } of chunkResults) {
    for (const item of items) {
      if (!item || typeof item.quote !== "string" || !item.quote.trim()) continue;
      const quote = item.quote.trim();
      const localIndex = chunk.text.indexOf(quote);
      if (localIndex === -1) continue;
      const start = chunk.start + localIndex;
      const end = start + quote.length;
      highlights.push({
        category: ["motive", "technique", "negotiation", "victim"].includes(item.category)
          ? item.category
          : "technique",
        text: quote,
        offset: { start, end },
        rationale: item.rationale || ""
      });
    }
  }

  return highlights.sort((a, b) => a.offset.start - b.offset.start);
}

module.exports = { getSemanticHighlights };
