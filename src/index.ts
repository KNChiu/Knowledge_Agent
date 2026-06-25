#!/usr/bin/env -S npx tsx
import "dotenv/config";
import { loadConfig } from "./config.js";
import { createKnowledgeAgent } from "./agent.js";

/**
 * Minimal CLI: pass a query as arguments, the agent reasons over the OKF
 * knowledge base and streams its answer plus tool activity to stdout.
 */
async function main(): Promise<void> {
  const query = process.argv.slice(2).join(" ").trim();
  if (!query) {
    console.error('Usage: knowledge-agent "<your question>"');
    process.exit(1);
  }

  const config = loadConfig();
  const agent = createKnowledgeAgent(config);

  agent.subscribe((event) => {
    switch (event.type) {
      case "tool_execution_start":
        process.stderr.write(
          `\n[tool] ${event.toolName}(${JSON.stringify(event.args)})\n`,
        );
        break;
      case "tool_execution_end":
        if (event.isError) {
          process.stderr.write(`[tool:error] ${event.toolName}: ${event.result}\n`);
        }
        break;
      case "message_update":
        if (event.assistantMessageEvent.type === "text_delta") {
          process.stdout.write(event.assistantMessageEvent.delta);
        }
        break;
      case "agent_end":
        process.stdout.write("\n");
        break;
    }
  });

  await agent.prompt(query);
  await agent.waitForIdle();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
