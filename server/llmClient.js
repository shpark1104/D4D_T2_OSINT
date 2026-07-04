const { llm } = require("./config");

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

// Thin wrapper around the OpenAI Chat Completions API. Every caller must
// handle `enabled === false` (no key configured) by skipping LLM work gracefully.
async function callLlm({ system, prompt, maxTokens = 1500 }) {
  if (!llm.enabled) {
    return { enabled: false, text: "" };
  }

  const response = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${llm.apiKey}`
    },
    body: JSON.stringify({
      model: llm.model,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt }
      ]
    })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw Object.assign(new Error(`OpenAI API error (${response.status}): ${detail}`), {
      status: 502
    });
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || "";
  return { enabled: true, text, raw: data };
}

function extractJson(text) {
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch ? fencedMatch[1] : text;
  const start = candidate.indexOf("[") === -1 ? candidate.indexOf("{") : candidate.indexOf("[");
  const end = candidate.lastIndexOf("]") === -1 ? candidate.lastIndexOf("}") : candidate.lastIndexOf("]");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

module.exports = { callLlm, extractJson, isEnabled: () => llm.enabled };
