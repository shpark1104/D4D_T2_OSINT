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
AGENTS.md          Project rules for future agents and teammates
server/config.js   Environment loader
server/index.js    Minimal HTTP server and API routes
public/index.html  UI shell
public/app.js      Browser-side interactions
public/styles.css  Basic workbench styling
```
