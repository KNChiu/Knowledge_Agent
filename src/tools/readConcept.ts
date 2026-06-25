import * as fs from "node:fs/promises";
import { Type } from "@earendil-works/pi-ai";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import type { Config } from "../config.js";
import { resolveInsideKnowledge } from "../paths.js";

/**
 * `read_concept` — return the full body of one knowledge file by its
 * knowledge-relative path. Reads are confined to the knowledge directory.
 *
 * Per the agent-loop contract, failures throw: the loop converts the thrown
 * error into an error tool-result the model can read and correct.
 */
const parameters = Type.Object({
  filePath: Type.String({
    description: "Path relative to the knowledge directory.",
  }),
});

export function createReadConceptTool(config: Config): AgentTool<typeof parameters> {
  return {
    name: "read_concept",
    label: "Read Concept",
    description:
      "Read the full content of one knowledge file, given its path relative to the knowledge directory (e.g. 'user_retention.md').",
    parameters,
    async execute(_id, params) {
      const resolved = resolveInsideKnowledge(config.knowledgeDir, params.filePath);
      if (!resolved.ok) {
        throw new Error(resolved.error);
      }

      let content: string;
      try {
        content = await fs.readFile(resolved.absolutePath, "utf-8");
      } catch {
        throw new Error(`Concept '${params.filePath}' was not found.`);
      }

      return {
        content: [{ type: "text", text: content }],
        details: { filePath: params.filePath },
      };
    },
  };
}
