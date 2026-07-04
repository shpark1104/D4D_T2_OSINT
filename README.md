# D4D CTI Base

First-share scaffold for a Node.js CTI workbench.

The important project guide is [AGENTS.md](./AGENTS.md).

## What Is Included

- Minimal Node.js HTTP server
- Static web UI in `public/`
- Incident text/file intake
- Basic IOC extraction
- StealthMole search proxy shape
- Mock mode for sharing before API keys are available
- Placeholder areas for reports, highlights, and entity resolution

## Run

```bash
cp .env.example .env
npm run dev
```

Open:

```text
http://localhost:3000
```

Node.js 18 or later is expected. This base currently has no external npm dependencies.

## Live StealthMole Mode

Set `.env`:

```bash
STEALTHMOLE_ACCESS_KEY=...
STEALTHMOLE_SECRET_KEY=...
STEALTHMOLE_MOCK=false
```

When keys are missing or `STEALTHMOLE_MOCK=true`, the server uses mock responses.

## Files

```text
AGENTS.md                    Project rules for future agents and teammates
server/config.js             Environment loader
server/index.js              HTTP server and API routing
server/sessions.js           In-memory session/document store
server/iocExtractor.js       Regex-based IOC extraction + defanging (M2a)
server/llmClient.js          OpenAI API wrapper
server/llmIocExtractor.js    LLM-assisted IOC + entity extraction (M2b)
server/semanticHighlighter.js LLM document highlighting (M5b)
server/stealthmoleClient.js  StealthMole JWT auth, routing, cache, search (M3)
public/index.html            UI shell (chat intake, results list, document viewer)
public/app.js                Browser-side interactions
public/styles.css            Workbench styling incl. IOC/semantic highlight colors
```

See [CTI_개발_마일스톤.md](./CTI_개발_마일스톤.md) for the full milestone plan;
M1-M5 are implemented, M6 (entity resolution) and M7 (graph/dashboard) are not yet.
