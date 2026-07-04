# AGENTS.md

## Project

This repository is a hackathon-stage base scaffold for:

**LLM-assisted CTI ingestion, IOC extraction, StealthMole OSINT lookup, analyst evidence highlighting, and lightweight CTI graph exploration.**

The goal is not a complete product. Keep the code light, readable, demo-friendly, and easy for teammates to extend under time pressure.

## Product Shape

The application is a local analyst workbench served by a plain Node.js HTTP server.

Current analyst workflow:

1. Submit incident evidence text or files from the right-side search panel.
2. Server extracts IOC candidates with regex and optional OpenAI assistance.
3. Center viewer highlights IOC candidates immediately.
4. Analyst clicks only interesting IOC highlights to register them in the left interest IOC list.
5. Analyst drags selected IOCs into the API lookup queue.
6. Analyst runs the queue and reviews only the latest search results in the right panel.
7. Analyst clicks a result to lazily load full node/document detail into the center viewer.
8. Analyst can add the currently displayed node to interest Nodes with the `+` button.
9. Analyst can rename interest Nodes from the left widget with the pen icon.
10. Analyst can run relationship candidate extraction from the interest IOC widget.
11. For Bitcoin/Ethereum wallet IOC lookups, the wallet graph is enabled in the center viewer.

The UI is intentionally dense and operational: left interests, center viewer, right search/results.

## Current Implementation Scope

Implemented:

- Node.js local web app with no build step and no frontend framework.
- Static frontend under `public/`.
- In-memory session, evidence, result, and document state in `server/sessions.js`.
- Regex IOC extraction in `server/iocExtractor.js`.
- Optional OpenAI IOC/entity extraction in `server/llmIocExtractor.js`.
- Optional OpenAI semantic underline extraction in `server/semanticHighlighter.js`.
- StealthMole server-side proxy, JWT auth, cache, request throttle, route normalization in `server/stealthmoleClient.js`.
- Search-result list backed by the latest query response.
- Lazy detail loading for result documents.
- TT node detail drill-down on document open.
- Interest IOC and interest Node widgets.
- Analyst evidence as an automatically registered interest Node.
- Interest-IOC relationship candidate popup using selected IOCs, LLM entities, and lookup result documents.
- Wallet graph module in `public/walletGraph.js`.

Still intentionally incomplete:

- Durable storage.
- Authentication/authorization.
- Production queueing.
- Durable entity profiles and confirmed merge workflow.
- STIX export.
- Full dashboard/graph analytics.
- `cdf` file search/download UI.

## Commands

```bash
npm run dev
```

The app serves `public/` from `server/index.js`.

Node.js 18 or later is expected. The scaffold currently avoids external npm dependencies.

Recommended syntax checks after JavaScript changes:

```bash
node --check server/index.js
node --check server/stealthmoleClient.js
node --check public/app.js
node --check public/walletGraph.js
```

Health check:

```text
GET /api/health
```

## Environment

Use `.env` based on `.env.example`.

Important variables:

```bash
PORT=3000
HOST=0.0.0.0

STEALTHMOLE_BASE_URL=https://hackathon.stealthmole.com
STEALTHMOLE_ACCESS_KEY=
STEALTHMOLE_SECRET_KEY=
STEALTHMOLE_MOCK=true

OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
```

Runtime behavior:

- If StealthMole keys are empty or `STEALTHMOLE_MOCK=true`, mock responses are returned.
- If StealthMole keys are present and `STEALTHMOLE_MOCK=false`, live StealthMole API calls are made.
- If `OPENAI_API_KEY` is empty, LLM stages no-op gracefully.
- `.env` must never be committed.

## Architecture Boundaries

Keep module boundaries explicit:

- `server/config.js`: environment loading and runtime config only.
- `server/index.js`: HTTP routing, static serving, endpoint orchestration.
- `server/sessions.js`: in-memory session/document/query storage.
- `server/iocExtractor.js`: deterministic IOC extraction, normalization, defanging.
- `server/llmClient.js`: thin OpenAI Chat Completions wrapper and JSON extraction.
- `server/llmIocExtractor.js`: LLM IOC/entity extraction prompts.
- `server/relationshipResolver.js`: review-only relationship candidate generation.
- `server/semanticHighlighter.js`: LLM semantic highlight prompts and offset matching.
- `server/stealthmoleClient.js`: StealthMole auth, API calling, cache, route table, result normalization.
- `public/app.js`: browser state, drag/drop, viewer rendering, query orchestration.
- `public/walletGraph.js`: wallet graph rendering only.
- `public/styles.css`: visual styling only.

Do not mix LLM prompts, StealthMole API calls, and UI-specific formatting in one module.

## StealthMole Integration Notes

Live StealthMole requests are server-side only.

Rules:

- Generate a fresh HS256 JWT for every request.
- JWT payload must include `access_key`, `nonce`, and `iat`.
- Do not log secrets or full JWTs.
- Prefer `/user/quotas` for quota display.
- Respect limit differences:
  - async search max limit: 100
  - sync search max limit: 50
- Keep request throttling in place.
- Keep caching in place unless debugging live freshness.

Current automatic IOC route table:

- `ipv4` -> `cds` with `ip:<value>`.
- `domain` -> `cl`, `cds`, `rm` with `domain:<value>`.
- `url` -> `cds` with `url:<value>`.
- `email` -> `cl`, `cds` with `email:<value>`.
- `md5`, `sha1`, `sha256` -> `tt` indicator `hash`.
- `btc_address` -> `tt` indicator `bitcoin`.
- `eth_address` -> `tt` indicator `ethereum`.
- `telegram` -> `tt` indicator `telegram`.
- `cve` -> `tt` indicator `cve`.
- `discord_id` -> `tt` indicator `discord`.
- `keyword` -> `tt` keyword plus `rm`, `gm`, `lm` plain query.

Do not automatically add `dt`, `ub`, or `cdf` to the current IOC-to-node flow without a deliberate design change:

- `dt` and `ub` are excluded by the hackathon manual/scope.
- `cdf` is search/file-download centered and does not fit the current lazy node viewer flow.

Manual module search may call a selected module directly, but typed IOC routing should remain conservative.

## StealthMole Result Normalization

Normalize module-specific responses into:

```js
{
  id,
  source_url,
  title,
  content,
  timestamp,
  forum_name,
  author_alias,
  indicators_tagged,
  raw_response
}
```

Guidelines:

- Make `title` useful for scanning, not just an internal ID.
- Keep `content` concise but analyst-useful.
- Do not expose credential passwords in normalized snippets; use `password=present`.
- Preserve `raw_response` for later detail/debug use.
- Include `proof_url` as `source_url` when available.
- For TT numeric node-like values, use a label such as `Telegram node <value>`.
- TT full detail should stay lazy to avoid quota-heavy eager `/tt/node` calls.

## LLM Integration Notes

LLM calls use OpenAI Chat Completions directly via `fetch`.

LLM stages:

- Evidence intake IOC/entity extraction.
- Semantic highlight extraction for evidence and opened documents.
- Relationship candidate extraction uses LLM-extracted entities plus selected interest IOCs and lookup result documents. It does not call the LLM again.

Semantic highlight response shape:

```js
{
  category: "motive" | "technique" | "negotiation" | "victim",
  text: "...",
  offset: { start, end },
  rationale: "..."
}
```

Important:

- Semantic highlights are rendered as underlines.
- IOC highlights are rendered as colored spans.
- Both highlight systems can overlap.
- Evidence views and document views should both support semantic highlights.
- If OpenAI fails, the UI should still work with regex IOC highlights.

## Frontend Direction

Keep the interface operational and analyst-focused.

Layout:

- Left: interest IOC list, interest Node list, LLM toggle, quota.
- Interest IOC widget includes the relationship extraction action.
- Center: exactly one active node/document/evidence viewer and optional wallet graph.
- Right: evidence submission, keyword/module search, IOC lookup queue, latest results.

UX rules:

- Do not auto-register every extracted IOC into interest IOCs.
- Do not auto-query every extracted IOC.
- IOC highlights should be clickable to register selected IOCs.
- Interest IOCs should be draggable to the lookup queue.
- Relationship extraction should run from the interest IOC widget and consider only currently selected interest IOCs.
- Relationship candidates should appear in a popup and be clearly treated as analyst-review candidates.
- Search results should be draggable to interest Nodes.
- Submitted evidence should be auto-registered as an interest Node.
- Search results should clear at the start of every new query.
- The result list should show only the current query result set.
- Node/detail fetches should be lazy.
- Current viewer node can be added to interest Nodes with a `+` icon button.
- Interest Node renaming belongs in the left interest Node widget, not the center viewer.

Visual rules:

- Keep the dark analyst/hacker theme.
- Avoid landing pages and decorative fluff.
- Use icons for compact actions when possible.
- Use clear hover titles for icon-only controls.
- Keep cards and panels compact and scan-friendly.
- Avoid nested cards.
- Make sure text does not overflow controls.

## Wallet Graph Notes

Wallet graph is a specialized visualization, not the general entity graph.

Behavior:

- Only enable for `btc_address` and `eth_address` IOC searches.
- Initially render only the selected address.
- On selected Bitcoin node click, call the independent transaction explorer endpoint and reveal real transaction counterparties.
- Limit visible transaction counterparty nodes to five.
- Dragging graph nodes to interest IOC list should register the wallet IOC.
- Linked wallet click may start a new wallet lookup.
- Show only first five address characters inside the node.
- Add explorer link controls:
  - Bitcoin -> `mempool.space`
  - Ethereum -> `etherscan.io`
- Do not rely on StealthMole search-result text to construct the Bitcoin transaction graph.

Do not turn this into a broad graph engine unless the task explicitly asks for M7 work.

## Security And Data Handling

- Never commit `.env`.
- Never hard-code API keys, tokens, JWTs, sample private credentials, or incident data.
- Treat uploaded evidence as sensitive.
- Keep raw uploaded files out of git.
- Avoid logging full request/response bodies from live CTI APIs when they may contain secrets.
- Do not expose StealthMole or OpenAI keys to browser code.
- Keep mock data synthetic.
- Live StealthMole calls can consume quota; probe with low limits.

## Coding Guidelines

- Keep modules small and obvious.
- Prefer simple functions over abstractions until repeated needs appear.
- Preserve existing user changes. Do not reset or overwrite unrelated work.
- Do not add dependencies unless the task clearly benefits from them.
- Add comments only where the decision is not obvious.
- Use structured parsing and data handling instead of brittle string hacking when practical.
- When updating UI text, prefer Korean labels consistent with the current analyst workflow.
- When changing API response normalization, test at least one real or mock response shape.

## Git Hygiene

- Check `git status -sb` before staging.
- Stage only relevant files.
- Never stage `.env`, logs, uploads, or generated private data.
- If the branch is behind `origin/main`, prefer a feature branch over pushing directly to `main`.
- Run the relevant `node --check` commands before committing JavaScript changes.

## Suggested Next Tasks

1. Add lightweight persistence for evidence, selected IOCs, interest Nodes, and renamed titles.
2. Add tests for IOC extraction, StealthMole route selection, and result normalization.
3. Add browser-level smoke tests for drag/drop and viewer rendering.
4. Design a separate `cdf` search/download flow if file evidence becomes important.
5. Improve TT node detail parsing for user/channel/message variants.
6. Design durable entity profiles and merge decisions only after the desired M6 data model is agreed.
