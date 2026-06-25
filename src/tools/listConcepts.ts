import * as fs from "node:fs/promises";
import * as path from "node:path";
import { Type } from "@earendil-works/pi-ai";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import type { Config } from "../config.js";
import { parseOkf, summarize } from "../okf.js";

/**
 * `list_concepts` — scan the knowledge directory and return, per file, only the
 * frontmatter `type`/`name`/`tags`. The Markdown body is deliberately never
 * included, so the agent can browse the whole base cheaply (token frugality).
 */
export function createListConceptsTool(config: Config): AgentTool {
  return {
    name: "list_concepts",
    label: "List Concepts",
    description:
      "List all knowledge concepts. Returns only each file's type, name and tags (never the body), so it is cheap to call when deciding what to read.",
    parameters: Type.Object({}),
    async execute() {
      let mdEntries: string[];
      try {
        const all = await fs.readdir(config.knowledgeDir);
        mdEntries = all.filter((e) => e.endsWith(".md")).sort();
      } catch {
        mdEntries = [];
      }

      const raws = await Promise.all(
        mdEntries.map((e) =>
          fs.readFile(path.join(config.knowledgeDir, e), "utf-8").catch(() => null),
        ),
      );

      type ConceptRow =
        | { path: string; invalid: string }
        | { path: string; type: unknown; name: unknown; tags: unknown };

      const concepts: ConceptRow[] = [];
      for (let i = 0; i < mdEntries.length; i++) {
        const entry = mdEntries[i]!;
        const raw = raws[i];
        if (raw == null) continue;
        const parsed = parseOkf(raw);
        if (!parsed.ok) {
          concepts.push({ path: entry, invalid: parsed.error });
        } else {
          concepts.push({ path: entry, ...summarize(parsed.frontmatter) });
        }
      }

      return {
        content: [{ type: "text", text: JSON.stringify(concepts, null, 2) }],
        details: { concepts },
      };
    },
  };
}
