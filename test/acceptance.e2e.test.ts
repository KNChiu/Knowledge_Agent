import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AgentEvent } from "@earendil-works/pi-agent-core";
import { createKnowledgeAgent } from "../src/agent.js";
import type { Config } from "../src/config.js";

/**
 * Live acceptance tests (PRD section 6). They exercise a real LLM via
 * OpenRouter and are skipped unless OPENROUTER_API_KEY is set.
 */
const RUN = !!process.env.OPENROUTER_API_KEY;
const d = RUN ? describe : describe.skip;

let dir: string;
let config: Config;

const SEED = `---
type: metric
name: user_retention
tags: [metrics, growth]
---
# 用戶留存率指標定義
次日留存率 = (當日註冊且次日活躍用戶數 / 當日新註冊總用戶數) × 100%`;

function record(events: AgentEvent[]) {
  return (e: AgentEvent) => {
    events.push(e);
  };
}

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "ka-e2e-"));
  await fs.writeFile(path.join(dir, "user_retention.md"), SEED, "utf-8");
  config = {
    knowledgeDir: dir,
    provider: process.env.KA_PROVIDER ?? "openrouter",
    model: process.env.KA_MODEL ?? "deepseek/deepseek-v4-flash",
  };
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

d("acceptance", () => {
  it(
    "reads user_retention.md when asked for its definition",
    async () => {
      const agent = createKnowledgeAgent(config);
      const events: AgentEvent[] = [];
      agent.subscribe(record(events));

      await agent.prompt("請幫我查用戶留存的定義");
      await agent.waitForIdle();

      const reads = events.filter(
        (e): e is Extract<AgentEvent, { type: "tool_execution_start" }> =>
          e.type === "tool_execution_start" && e.toolName === "read_concept",
      );
      expect(reads.some((e) => String(e.args?.filePath).includes("user_retention"))).toBe(true);
    },
    120_000,
  );

  it(
    "errors then retries when a write omits the type field",
    async () => {
      const agent = createKnowledgeAgent(config);
      const events: AgentEvent[] = [];
      agent.subscribe(record(events));

      await agent.prompt(
        "Create a new concept file 'churn.md' for a metric named churn. " +
          "First attempt to write it WITHOUT a 'type' field, observe the error, " +
          "then fix it and write valid OKF content.",
      );
      await agent.waitForIdle();

      const writeEnds = events.filter(
        (e): e is Extract<AgentEvent, { type: "tool_execution_end" }> =>
          e.type === "tool_execution_end" && e.toolName === "write_concept",
      );
      expect(writeEnds.some((e) => e.isError)).toBe(true);

      // A corrected file should exist with a valid type.
      const written = await fs.readFile(path.join(dir, "churn.md"), "utf-8");
      expect(written).toMatch(/type:\s*\S+/);
    },
    180_000,
  );
});
