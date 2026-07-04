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
- Lets analysts drag interest IOCs into an API lookup queue, then run StealthMole lookups.
- Lists only the latest lookup response in the right-side results panel.
- Lazily opens full node/document detail only when a result is clicked.
- Lets analysts maintain a separate interest Node list, rename those nodes, and reopen them.
- Adds submitted evidence automatically to the interest Node list.
- Shows OpenAI semantic highlights as underlines when `OPENAI_API_KEY` is configured.
- Extracts review-only relationship candidates for selected interest IOCs through the left IOC widget popup.
- Shows a wallet graph only for selected Bitcoin/Ethereum wallet IOC searches.
- Supports dragging wallet graph nodes into the interest IOC list.

## Current UI Layout

The first screen is the workbench, not a landing page.

- Left: interest IOC list with relationship extraction, interest Node list, LLM highlight toggle, quota display.
- Center: one active node/document/evidence viewer, semantic underline rendering, optional wallet graph.
- Right: evidence submission, direct keyword/module search, IOC lookup queue, current search results.

Important interaction details:

- IOC candidates are not automatically queried.
- Analyst evidence is submitted with `자료 제출`.
- Submitted evidence is automatically registered as an interest Node.
- Search results are cleared every time a new unified search or IOC queue lookup starts.
- Clicking a result opens its full detail in the center viewer.
- The center viewer can add the currently displayed node to interest Nodes with the `+` button.
- Interest Nodes can be renamed from the left widget with the pen icon.
- The relationship button in the interest IOC widget runs candidate extraction only for currently selected interest IOCs.

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
| `telegram` | `tt` indicator `telegram` |
| `cve` | `tt` indicator `cve` |
| `discord_id` | `tt` indicator `discord` |
| `keyword` | `tt` keyword plus `rm`, `gm`, `lm` plain query |

Manual module search from the right panel bypasses this routing table and calls the selected module directly.

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
StealthMole_API_MANUAL_KR.md  Local StealthMole API manual copy
package.json                  Node scripts and engine hint

server/config.js              .env loader and runtime config
server/index.js               HTTP server, static serving, API routes
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
node --check server/index.js
node --check server/stealthmoleClient.js
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
- Raw uploads are not persisted to disk; current state is in-memory and resets on server restart.
- Live StealthMole requests can consume quota. Keep limits low during probes.

## Known Limitations

- No database or durable session storage.
- No user authentication.
- No queue system.
- No formal test suite.
- `cdf` file-download workflows are not integrated into the current viewer.
- Relationship extraction produces analyst-review candidates, not confirmed entity merges.
- TT node detail is fetched lazily only when a result is opened.
- Bitcoin wallet graph links depend on public transaction data from `mempool.space`; Ethereum transaction expansion is not implemented yet.

## Suggested Next Work

1. Add a small persistence layer for incidents, selected IOCs, and renamed Nodes.
2. Add a real test harness for extractor, StealthMole normalization, and frontend state transitions.
3. Add explicit `cdf` file search/download workflow if the demo scope needs file evidence.
4. Improve TT node detail extraction for channel/message/user variants.
5. Add durable entity profiles and merge decisions once the desired M6 model is clearer.
