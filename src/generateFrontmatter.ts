import { complete } from "@earendil-works/pi-ai/compat";
import type { Context } from "@earendil-works/pi-ai/compat";
import { builtinModels } from "@earendil-works/pi-ai/providers/all";
import type { Config } from "./config.js";

const _models = builtinModels();

export interface GeneratedFrontmatter {
  type: string;
  name: string;
  tags: string[];
}

const SYSTEM = `You are an OKF (Open Knowledge Format) metadata generator. Given a Markdown document, output ONLY a JSON object (no markdown fences) with these fields:
- "type": a single lowercase word describing the kind of knowledge node (e.g. metric, concept, process, guide, reference, decision, glossary)
- "name": a concise snake_case identifier for this node (e.g. user_retention_rate)
- "tags": an array of 2–5 lowercase tag strings relevant to the content

Output ONLY the JSON object, nothing else.`;

/**
 * Call the configured LLM once to infer OKF frontmatter fields from raw content.
 * Falls back to safe defaults on any failure so uploads never get blocked.
 */
export async function generateFrontmatter(
  content: string,
  filenameHint: string,
  config: Config,
): Promise<GeneratedFrontmatter> {
  const fallbackName = slugify(filenameHint);
  try {
    const model = _models.getModel(config.provider, config.model);
    if (!model) throw new Error("model not found");

    // Truncate to first 3000 chars — enough context, cheap to call
    const excerpt = content.slice(0, 3000);

    const context: Context = {
      systemPrompt: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Filename hint: ${filenameHint}\n\n${excerpt}`,
          timestamp: Date.now(),
        },
      ],
    };

    const response = await complete(model, context);
    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");

    const parsed = JSON.parse(text.trim()) as Partial<GeneratedFrontmatter>;
    return {
      type: String(parsed.type ?? "document").toLowerCase().trim() || "document",
      name: String(parsed.name ?? "").trim() || fallbackName,
      tags: Array.isArray(parsed.tags)
        ? parsed.tags.map((t) => String(t).toLowerCase())
        : [],
    };
  } catch {
    // Graceful fallback — never block an upload due to LLM failure
    return { type: "document", name: fallbackName, tags: [] };
  }
}

/** Convert a filename (without extension) to a snake_case identifier. */
export function slugify(filename: string): string {
  return (
    filename
      .replace(/\.[^.]+$/, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "untitled"
  );
}
