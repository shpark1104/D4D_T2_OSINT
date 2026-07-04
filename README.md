# D4D T2 OSINT CTI Workbench

Hackathon-oriented local CTI workbench for incident evidence intake, IOC extraction,
StealthMole OSINT lookup, OpenAI-assisted semantic highlighting, and wallet-focused
graph exploration.

This repository intentionally stays lightweight: plain Node.js, static files, no build
step, no frontend framework, no database. The goal is a shareable analyst workbench
that teammates can read, run, and extend quickly.

## What The App Does

- Accepts analyst evidence text and local files through the right-side search panel.
- Extracts IOC candidates with deterministic regex rules and optional OpenAI assistance.
- Highlights extracted IOCs in the center viewer by IOC type.
- Lets analysts click IOC highlights to add only selected IOCs to the left-side interest list.
- Lets analysts click or drag one interest IOC into the search field, then run a single StealthMole lookup.
- Lists only the latest lookup response in the right-side results panel.
- Lazily opens full node/document detail only when a result is clicked.
- Lets analysts maintain a separate interest Node list, rename those nodes, and reopen them.
- Adds submitted evidence automatically to the interest Node list.
- Shows OpenAI semantic highlights as underlines when `OPENAI_API_KEY` is configured.
- Extracts review-only relationship candidates from the left IOC widget. Unqueried interest IOCs are looked up first, then the relationship popup is built from the selected IOCs and result documents.
- Shows a wallet graph only for selected Bitcoin/Ethereum wallet IOC searches.
- Supports dragging wallet graph nodes into the interest IOC list.

## Current UI Layout

The first screen is the workbench, not a landing page.

- Left: interest IOC list with relationship extraction, interest Node list, LLM highlight toggle, quota display.
- Center: one active node/document/evidence viewer, semantic underline rendering, optional wallet graph.
- Right: evidence submission, direct keyword/module search, single IOC search target, current search results.

Important interaction details:

- IOC candidates are not automatically queried.
- Analyst evidence is submitted with `자료 제출`.
- Submitted evidence is automatically registered as an interest Node.
- Search results are cleared every time a new unified search or single IOC lookup starts.
- The search field keeps the last submitted lookup target visible after execution.
- Clicking a result opens its full detail in the center viewer.
- The center viewer can add the currently displayed node to interest Nodes with the `+` button.
- Interest Nodes can be renamed from the left widget with the pen icon.
- The `관계 추출` button in the interest IOC widget first queries any selected IOC that has not been queried yet, then opens a relationship-candidate popup.

## Quick Start

```bash
cp .env.example .env
npm run dev
```

Open:

```text
http://localhost:3000
```

The server binds to `HOST` from `.env`; the current code defaults to `0.0.0.0` so the
app can be reached from other devices on the same network when the firewall allows it.

Node.js 18 or later is expected. There are no runtime npm dependencies.

## Vercel Deployment

The Vercel entrypoint is the root [server.js](./server.js), which starts the same plain Node.js HTTP server used locally. Keep this file at the repository root so Vercel can detect the app as a Node server instead of deploying only `public/` as a static site.

Recommended Vercel settings:

- Build command: leave empty or use the default install-only flow.
- Output directory: leave empty.
- Install command: default `npm install`.
- Environment variables: configure the same keys from `.env.example` in the Vercel Project Settings.

Required for live lookups/highlighting in Vercel:

```bash
STEALTHMOLE_BASE_URL=https://hackathon.stealthmole.com
STEALTHMOLE_ACCESS_KEY=
STEALTHMOLE_SECRET_KEY=
STEALTHMOLE_MOCK=false
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
```

If `자료 제출 실패: Request failed` appears after deployment, check the deployed `/api/health` URL first. A 404 or HTML response usually means Vercel did not route requests to the Node server. A JSON response means the server is running and the next place to inspect is the Vercel Function log.

Current sessions, submitted evidence, and search results are still in memory. On Vercel this is demo-suitable but not durable: cold starts, function instance changes, or redeploys can reset session state.

## Environment

Use `.env` locally. Never commit real keys.

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

Behavior:

- If StealthMole keys are empty, or `STEALTHMOLE_MOCK=true`, search and quota calls use synthetic mock data.
- If `STEALTHMOLE_MOCK=false` and both StealthMole keys are present, the server uses the live API.
- If `OPENAI_API_KEY` is empty, LLM IOC extraction and semantic highlighting no-op gracefully.
- `.env` is ignored by git and should remain local.

## StealthMole Integration

All StealthMole calls are server-side. Keys are never exposed to the browser.

Implemented live lookup behavior:

- Fresh HS256 JWT per request with `access_key`, `nonce`, and `iat`.
- In-memory cache keyed by module/query.
- Serialized throttled requests to reduce accidental API pressure.
- Quota display through `/user/quotas`.
- Sync module support: `cl`, `cb`, `cds`, `rm`, `gm`, `lm`.
- Async Telegram Tracker support: `tt`.
- TT `target/all` responses are normalized with target-aware filtering and sorting so non-Telegram indicators such as CVE, hash, Bitcoin, Ethereum, and Discord do not surface context-free Telegram user/channel nodes ahead of direct indicator matches.
- `dt`, `ub`, and `cdf` are intentionally excluded from the current IOC-to-node workflow.

Current automatic IOC routing:

| IOC type | Route |
| --- | --- |
| `ipv4` | `cds` query `ip:<value>` |
| `domain` | `cl`, `cds`, `rm` query `domain:<value>` |
| `url` | `cds` query `url:<value>` |
| `email` | `cl`, `cds` query `email:<value>` |
| `md5`, `sha1`, `sha256` | `tt` indicator `hash` |
| `btc_address` | `tt` indicator `bitcoin` plus wallet graph |
| `eth_address` | `tt` indicator `ethereum` plus wallet graph |
| `telegram` | `tt` indicator `telegram`; leading `@` is stripped only for API search text |
| `cve` | `tt` indicator `cve` |
| `discord_id` | `tt` indicator `discord` |
| `keyword` | `tt` keyword plus `rm`, `gm`, `lm` plain query |

Manual sync-module search from the right panel calls the selected module directly. Manual `TT` search uses the inferred TT indicator when the query looks like a known IOC, otherwise it falls back to `keyword`.

### TT Target Handling

StealthMole's TT API can return multiple target buckets for one indicator. For example, a CVE lookup may return `cve`, `telegram.message`, `telegram.channel`, and `telegram.user` results. The app keeps the target name in `raw_response.__target` and applies these rules:

- The searched indicator's own target is shown first when present, such as `cve`, `hash`, `bitcoin`, `ethereum`, or `discord`.
- Non-Telegram targets come before Telegram graph targets for non-Telegram indicators.
- Telegram results are still shown when the searched text actually appears in `highlight`, `value`, or `metadata`.
- Telegram user/channel nodes with no direct match evidence are filtered out for broad indicator searches.
- Telegram-specific searches keep Telegram message/channel/user targets as first-class results.

## LLM Integration

OpenAI calls use the Chat Completions API directly through `fetch`; no SDK dependency is added.

LLM-enabled paths:

- `server/llmIocExtractor.js`: optional semantic IOC/entity extraction during evidence submission.
- `server/semanticHighlighter.js`: semantic underline extraction for viewer text.
- `server/relationshipResolver.js`: review-only relationship candidates using selected IOCs, LLM entities, and lookup result documents.
- `POST /api/sessions/:id/semantic`: semantic highlights for submitted evidence currently shown in the viewer.
- `GET /api/sessions/:id/documents/:docId/semantic`: semantic highlights for opened search-result documents.

Semantic highlights are returned as offset ranges:

```json
{
  "enabled": true,
  "highlights": [
    {
      "category": "technique",
      "text": "CVE-2023-34362 MOVEit Transfer exploitation",
      "offset": { "start": 120, "end": 166 },
      "rationale": "..."
    }
  ]
}
```

The browser renders these as underlines over the existing document text. IOC highlights and semantic highlights can overlap.

## Wallet Graph

Wallet graph code lives in `public/walletGraph.js`.

Behavior:

- Enabled only when the active query is a Bitcoin or Ethereum wallet IOC.
- Initially renders only the selected wallet address.
- Clicking the selected Bitcoin wallet calls the transaction explorer endpoint and reveals up to five real transaction counterparties.
- Wallet edges display lightweight direction/count labels such as `sent 3tx` or `received 1tx`.
- Dragging a wallet node to the interest IOC list registers it as an IOC.
- Clicking a linked wallet starts a new wallet lookup for that address.
- Nodes show only the first five address characters.
- Node explorer button links to `mempool.space` for Bitcoin and `etherscan.io` for Ethereum.

Bitcoin counterparties are fetched independently from StealthMole through `mempool.space`.
The graph is intentionally simple and data-light. It is a hackathon visualization aid, not a full blockchain analytics engine.

## Project Files

```text
AGENTS.md                     Project rules and implementation notes for future agents
CTI_개발_마일스톤.md           Milestone plan
package.json                  Node scripts and engine hint
server.js                     Root Node server entrypoint for local start and Vercel

server/config.js              .env loader and runtime config
server/index.js               HTTP routing, static serving, API routes
server/sessions.js            In-memory session/document/query store
server/iocExtractor.js        Regex IOC extraction and defanging
server/llmClient.js           Thin OpenAI Chat Completions wrapper
server/llmIocExtractor.js     LLM-assisted IOC/entity extraction
server/relationshipResolver.js Interest IOC relationship candidate resolver
server/semanticHighlighter.js LLM semantic underline extraction
server/stealthmoleClient.js   StealthMole auth, routing, cache, normalization
server/walletExplorer.js      Bitcoin transaction counterparty lookup

public/index.html             Workbench shell
public/app.js                 Browser state, drag/drop, viewer, search orchestration
public/styles.css             Dark analyst UI and highlight styling
public/walletGraph.js         Wallet-specific graph visualization
```

## Useful Checks

There is no formal test suite yet. For now, run syntax checks on touched JavaScript:

```bash
node --check server.js
node --check server/index.js
node --check server/stealthmoleClient.js
node --check server/relationshipResolver.js
node --check server/walletExplorer.js
node --check public/app.js
node --check public/walletGraph.js
```

Health check after starting the server:

```text
GET http://localhost:3000/api/health
```

Expected live response shape:

```json
{
  "ok": true,
  "stealthmoleMock": false,
  "llmEnabled": true
}
```

## Security Notes

- Never commit `.env`, real API keys, JWTs, incident files, or private customer data.
- Do not log full JWTs, raw secrets, or full credential leak passwords.
- The current UI intentionally displays `password=present` rather than secret values in normalized result snippets.
- Normalized result snippets omit empty placeholder fields such as `-`, `N/A`, `unknown`, and `null`.
- Raw uploads are not persisted to disk; current state is in-memory and resets on server restart.
- Live StealthMole requests can consume quota. Keep limits low during probes.

## Known Limitations

- No database or durable session storage.
- No user authentication.
- No queue system.
- No formal test suite.
- `cdf` file-download workflows are not integrated into the current viewer.
- Relationship extraction produces analyst-review candidates, not confirmed entity merges.
- Relationship extraction can consume StealthMole quota because it queries selected interest IOCs that have not been queried yet.
- TT node detail is fetched lazily only when a result is opened.
- Bitcoin wallet graph links depend on public transaction data from `mempool.space`; Ethereum transaction expansion is not implemented yet.

## Suggested Next Work

1. Add a small persistence layer for incidents, selected IOCs, and renamed Nodes.
2. Add a real test harness for extractor, StealthMole normalization, and frontend state transitions.
3. Add explicit `cdf` file search/download workflow if the demo scope needs file evidence.
4. Improve TT node detail extraction for channel/message/user variants.
5. Add durable entity profiles and merge decisions once the desired M6 model is clearer.
