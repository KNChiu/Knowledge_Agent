import * as fs from "node:fs/promises";
import * as path from "node:path";
import { Type } from "@earendil-works/pi-ai";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import type { Config } from "../config.js";
import { parseOkf, validateOkf } from "../okf.js";
import { resolveInsideKnowledge } from "../paths.js";

/**
 * `write_concept` — create or update a knowledge file. The content MUST be valid
 * OKF (YAML frontmatter with a non-empty `type`); otherwise the tool throws so
 * the agent sees the error and retries with corrected formatting.
 */
const parameters = Type.Object({
  filePath: Type.String({
    description: "Path relative to the knowledge directory (e.g. 'churn.md').",
  }),
  content: Type.String({
    description: "Full file content: OKF frontmatter followed by Markdown body.",
  }),
});

export function createWriteConceptTool(config: Config): AgentTool<typeof parameters> {
  return {
    name: "write_concept",
    label: "Write Concept",
    description:
      "Create or update a knowledge file. Content must begin with OKF YAML frontmatter ('--- ... ---') including a non-empty 'type' field, followed by the Markdown body.",
    parameters,
    async execute(_id, params) {
      const resolved = resolveInsideKnowledge(config.knowledgeDir, params.filePath);
      if (!resolved.ok) {
        throw new Error(resolved.error);
      }

      const parsed = parseOkf(params.content);
      if (!parsed.ok) {
        throw new Error(parsed.error);
      }
      const valid = validateOkf(parsed.frontmatter);
      if (!valid.ok) {
        throw new Error(valid.error);
      }

      await fs.mkdir(path.dirname(resolved.absolutePath), { recursive: true });
      await fs.writeFile(resolved.absolutePath, params.content, "utf-8");

      return {
        content: [
          { type: "text", text: `Saved concept '${params.filePath}'.` },
        ],
        details: { filePath: params.filePath },
      };
    },
  };
}
