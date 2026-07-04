# AGENTS.md

## Project

This repository is a first-share base scaffold for:

**LLM-assisted CTI ingestion, IOC extraction, StealthMole OSINT lookup, document highlighting, and CTI-embedded entity resolution.**

The goal of this stage is not a complete product. Keep the code light, understandable, and easy for teammates to extend.

## Current Scope

Implements CTI_개발_마일스톤.md milestones M1-M5 (M6 entity resolution and M7
graph visualization/dashboard are intentionally out of scope for now):

- Node.js based local web app (no build step, no framework).
- ChatGPT-like incident intake UI: session-based chat thread, drag&drop/click
  file upload, text preview.
- IOC extraction: regex-based (`server/iocExtractor.js`, M2a) merged with
  optional OpenAI-based semantic extraction (`server/llmIocExtractor.js`, M2b).
  LLM steps are skipped automatically when `OPENAI_API_KEY` is empty.
- StealthMole API gateway (`server/stealthmoleClient.js`, M3): JWT auth,
  IOC-type -> module routing table, in-memory cache (1h TTL), request
  throttling, sync (`cl`/`cb`/`cds`/`rm`/`gm`/`lm`) and async (`tt`) search
  normalized into one result schema. `dt` and `ub` are excluded per the
  hackathon manual.
- Search-engine-like report listing with module/sort filters and cursor
  pagination (M4), backed by a per-session in-memory document index
  (`server/sessions.js`).
- Document viewer with IOC highlighting + click-to-search, drag-to-search,
  and optional OpenAI-based semantic highlighting (`server/semanticHighlighter.js`,
  M5a/M5b), cached per document.
- Entity-resolution / knowledge-graph area (M6/M7) is not implemented yet.

## Non-Goals For This Base

- Do not overbuild production infrastructure yet.
- Do not add a database unless the task explicitly requires persistence.
- Do not add queues, auth systems, complex state managers, or heavy frameworks without approval.
- Do not hard-code API keys, secrets, sample credentials, or private incident data.
- Do not turn this into a polished final UI. It is a base to share first.

## Commands

```bash
npm run dev
```

The app serves `public/` from `server/index.js`.

Node.js 18 or later is expected. The scaffold currently avoids external npm dependencies so reviewers can understand the base quickly.

## Environment

Use `.env` based on `.env.example`.

Required for live StealthMole calls:

```bash
STEALTHMOLE_BASE_URL=https://hackathon.stealthmole.com
STEALTHMOLE_ACCESS_KEY=
STEALTHMOLE_SECRET_KEY=
STEALTHMOLE_MOCK=false
```

If keys are empty or `STEALTHMOLE_MOCK=true`, the server returns mock search and quota data.

## StealthMole Integration Notes

- Generate a fresh HS256 JWT for every request.
- JWT payload must include `access_key`, `nonce`, and `iat`.
- Async search services: `dt`, `tt`, `cdf`.
- Sync search services: `cl`, `cb`, `ub`, `cds`, `gm`, `lm`, `rm`.
- Async search should use the manual's `/{service}/search/{indicator}/target/all?text=...` shape unless a task asks for target-specific search.
- Sync search should use `/{service}/search?query=...`.
- Respect service limit differences:
  - async search max limit: 100
  - sync search max limit: 50
- Prefer `/user/quotas` for quota display. It should not consume quota according to the manual.

## LLM Integration Notes

LLM work uses the OpenAI Chat Completions API directly via `fetch` (no SDK
dependency added). Set `OPENAI_API_KEY` (and optionally `OPENAI_MODEL`,
default `gpt-4o-mini`) in `.env` to enable it; when empty, both LLM stages
no-op and the app runs on regex extraction only.

Module boundaries in place:

- `server/iocExtractor.js`: deterministic (regex) extraction, defanging.
- `server/llmClient.js`: thin OpenAI Chat Completions wrapper + JSON parsing helper.
- `server/llmIocExtractor.js`: LLM-assisted IOC + semantic entity extraction (M2b).
- `server/semanticHighlighter.js`: LLM document highlighting and rationale (M5b).
- `server/entityResolver.js`: not implemented yet (M6, out of current scope).
- `server/stealthmoleClient.js`: external CTI lookup only.

Do not mix LLM prompts, StealthMole API calls, and UI-specific formatting in one file.

## Frontend Direction

Keep the interface operational and analyst-focused.

- First screen should be the actual workbench, not a landing page.
- Prioritize dense scanning, quick search, document reading, and click-through analysis.
- IOC chips should trigger search.
- Drag-selected document text should be searchable.
- Results should remain list-like, similar to a search engine.
- Document rendering should highlight extracted IOC values and semantic-risk lines.

Avoid decorative UI work unless it improves analyst workflow.

## Security And Data Handling

- Never commit `.env`.
- Never log secrets or full JWTs.
- Treat incident uploads as sensitive.
- Keep mock data synthetic.
- Use server-side proxying for StealthMole calls; do not expose access keys to the browser.
- When adding file upload storage, keep raw files out of git and document retention assumptions.

## Coding Guidelines

- Keep modules small and obvious.
- Prefer simple functions over abstractions until repeated needs appear.
- Keep this scaffold dependency-light unless the task calls for a real package.
- Add only concise comments where they clarify a non-obvious decision.
- Preserve existing user changes. Do not reset or overwrite unrelated work.

## Suggested Next Tasks

1. Verify live StealthMole search end-to-end with real credentials (this
   sandbox has no Node.js installed, so live runs have not been executed here).
2. Validate the LLM extraction/highlighting prompts against real incident
   text with `OPENAI_API_KEY` set; tune prompts as needed.
3. Persist incidents and searches in a lightweight DB (currently in-memory
   only; state resets on server restart).
4. Add `/{service}/node` drill-down for `tt` results.
5. Implement M6 (entity resolution) and M7 (graph visualization + dashboard
   + STIX export) per CTI_개발_마일스톤.md.
