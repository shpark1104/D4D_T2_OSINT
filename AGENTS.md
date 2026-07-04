# AGENTS.md

## Project

This repository is a first-share base scaffold for:

**LLM-assisted CTI ingestion, IOC extraction, StealthMole OSINT lookup, document highlighting, and CTI-embedded entity resolution.**

The goal of this stage is not a complete product. Keep the code light, understandable, and easy for teammates to extend.

## Current Scope

- Node.js based local web app.
- ChatGPT-like incident intake UI for logs, notes, and text files.
- Mechanical IOC extraction first.
- StealthMole API proxy shape with mock mode.
- Search-engine-like report listing.
- Document viewer with IOC and semantic-signal highlighting.
- Entity-resolution placeholder area for accounts, emails, domains, hosts, and IPs.

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

LLM work is intentionally a placeholder at this stage.

Suggested future boundaries:

- `server/iocExtractor.js`: deterministic extraction.
- `server/llmHighlighter.js`: semantic extraction and rationale.
- `server/entityResolver.js`: entity grouping and confidence scoring.
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

1. Confirm actual StealthMole credentials and test live search.
2. Add a real LLM provider module for semantic highlights.
3. Persist incidents and searches in a lightweight DB.
4. Add detail/node drill-down for selected StealthMole reports.
5. Replace heuristic entity resolution with evidence-backed clustering.
