# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## What this project is

A **lightweight Knowledge Agent** that avoids a vector DB / embedding-based RAG. Knowledge lives in local Markdown files following Google's **Open Knowledge Format (OKF)**, and an LLM agent loop (think → act → observe) navigates it by calling file tools. Retrieval is the agent *choosing* which files to list and read, not similarity search.

## Architecture

Built on `@earendil-works/pi-agent-core` (Agent loop) and `@earendil-works/pi-ai` (provider/model abstraction). The default provider is **OpenRouter** (`OPENROUTER_API_KEY`), default model is `deepseek/deepseek-v4-flash` (overridable via `KA_MODEL`).

### Three core tools

| Tool | Behavior | Hard constraint |
| :--- | :--- | :--- |
| `list_concepts` | Scan `knowledge/`, parse YAML frontmatter, return list. | Return only `type`/`name`/`tags` — **never the body**, to save tokens. |
| `read_concept` | Read full body of one file by relative path. | Must defend against path traversal; reads confined to the knowledge dir. |
| `write_concept` | Create/update a knowledge node. | Must **throw** when content lacks valid OKF YAML frontmatter or has an empty `type`, so the agent self-corrects. |

Tools **throw** on failure (do not return error strings) — the pi-agent-core loop encodes thrown errors as error tool-results the model can read and retry from.

## OKF file format

```markdown
---
type: metric
name: user_retention
tags: [metrics, growth]
last_updated: 2026-06-25
---
# Title
...
```

Use `js-yaml` for frontmatter parse/validation. Never hand-roll YAML string parsing.

## Project layout

```
src/                   # Backend (TypeScript, ESM)
  config.ts            # env-driven config (KNOWLEDGE_DIR, KA_PROVIDER, KA_MODEL)
  okf.ts               # parseOkf / validateOkf / serializeOkf / summarize
  paths.ts             # resolveInsideKnowledge (traversal guard)
  generateFrontmatter.ts # LLM-assisted OKF frontmatter generation for uploads
  tools/               # listConcepts, readConcept, writeConcept, index
  agent.ts             # builds model + Agent
  index.ts             # CLI entry
  server.ts            # Express web server (serves public/, exposes /api/*)
public/                # Frontend static assets
  index.html           # single-page chat + concept browser UI
docs/                  # Project documentation
  architecture.html    # architecture / flow diagram
knowledge/             # OKF Markdown files
test/
  okf.test.ts
  paths.test.ts
  tools.test.ts
  acceptance.e2e.test.ts   # gated on OPENROUTER_API_KEY
  setup.ts           # loads .env via dotenv
vitest.config.ts
.env.example
```

## Development

```bash
npm install
cp .env.example .env    # add OPENROUTER_API_KEY
npm test                # unit tests (no key needed)
npx tsx src/index.ts "your question"   # CLI (or: npm run cli "...")
npm start                              # Web UI → http://localhost:3000
```

The agent is exposed two ways over the same tools/agent core: a **CLI** (`src/index.ts`)
and a **web server** (`src/server.ts`, serving `public/` and streaming chat via SSE).

## Acceptance criteria (non-negotiable)

1. `list_concepts` output never contains file body text.
2. `read_concept("../../etc/passwd")` must error, not read.
3. `write_concept` with missing/empty `type` must throw.
4. Live e2e: querying user retention → agent calls `read_concept("user_retention.md")`.
5. Live e2e: write without `type` → error → agent retries with correct format.

## Conventions

- Language: TypeScript / Node.js (ESM, `"type": "module"`).
- Modules use `.js` extensions in imports (NodeNext resolution).
- Tool parameters typed as `AgentTool<typeof parameters>` with a TypeBox `Type.Object(...)` schema.
- All comments and commit messages in English.
