# Knowledge Agent

A lightweight AI agent that queries and updates a local Markdown knowledge base following [Google's Open Knowledge Format (OKF)](https://google.github.io/adk-docs/tools/okf/). No vector DB — the agent browses files directly via tool calls (list → read → answer).

## How it works

The agent runs a think–act–observe loop powered by [`@earendil-works/pi-agent-core`](https://github.com/earendil-works/pi). It has three tools:

| Tool | What it does |
|---|---|
| `list_concepts` | Scans `knowledge/` and returns each file's `type`, `name`, and `tags` (never the body — cheap to call) |
| `read_concept` | Returns the full content of one file by relative path |
| `write_concept` | Creates or updates a file; rejects content missing a valid OKF frontmatter `type` field |

All knowledge files are OKF Markdown:

```markdown
---
type: metric
name: user_retention
tags: [metrics, growth]
last_updated: 2026-06-25
---
# User Retention

...
```

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Add your API key
cp .env.example .env
# Edit .env and set OPENROUTER_API_KEY=sk-or-...
```

## Run the CLI

```bash
npx tsx src/index.ts "請幫我查用戶留存的定義"
npx tsx src/index.ts "What is user retention?"
# or: npm run cli "What is user retention?"
```

## Run the Web UI

```bash
npm start            # tsx src/server.ts → http://localhost:3000
```

The web server (`src/server.ts`) serves the frontend from `public/` and exposes
`/api/concepts`, `/api/upload`, and a streaming `/api/chat` (SSE) endpoint backed by
the same agent and tools as the CLI.

## Project layout

```
src/        # Backend (TypeScript, ESM) — agent, tools, CLI (index.ts) & web server (server.ts)
public/     # Frontend static assets (index.html)
docs/       # Project documentation (architecture.html)
knowledge/  # OKF Markdown knowledge base
test/       # Unit + live acceptance tests
```

## Configuration

All config is via environment variables (`.env` or exported):

| Variable | Default | Description |
|---|---|---|
| `OPENROUTER_API_KEY` | — | **Required.** Your [OpenRouter](https://openrouter.ai) key |
| `KA_MODEL` | `deepseek/deepseek-v4-flash` | Any model id available on OpenRouter |
| `KA_PROVIDER` | `openrouter` | pi-ai provider id |
| `KNOWLEDGE_DIR` | `./knowledge` | Path to the OKF knowledge base |

## Tests

```bash
# Unit tests (no API key needed)
npm test

# Live acceptance tests (requires OPENROUTER_API_KEY in .env)
npx vitest run test/acceptance.e2e.test.ts
```

The two acceptance tests verify the core PRD criteria:
1. Querying user retention → agent calls `read_concept("user_retention.md")`.
2. Writing a file without a `type` field → tool errors → agent fixes the format and retries.
