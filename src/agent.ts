import { builtinModels } from "@earendil-works/pi-ai/providers/all";
import { Agent } from "@earendil-works/pi-agent-core";
import type { Config } from "./config.js";
import { createKnowledgeTools } from "./tools/index.js";

const INSTRUCTIONS = `You are a knowledge management agent that strictly follows the Open Knowledge Format (OKF). Your job is to help the user query and update a local Markdown knowledge base.

Guidelines:
1. To answer a question, first call \`list_concepts\` to discover what exists, then \`read_concept\` to read the relevant file(s). Base your answers on the knowledge base, not prior assumptions.
2. When writing knowledge with \`write_concept\`, the content must begin with OKF YAML frontmatter ('--- ... ---') containing a non-empty \`type\` field, followed by the Markdown body. If a write is rejected, read the error, fix the format, and retry.
3. Keep tool usage minimal and purposeful.`;

/**
 * Construct a Knowledge Agent: resolve the configured model from pi-ai's
 * built-in provider catalog (OpenRouter by default; auth via OPENROUTER_API_KEY)
 * and wire the three OKF tools onto the pi-agent-core loop.
 */
const _models = builtinModels();

export function createKnowledgeAgent(config: Config): Agent {
  const model = _models.getModel(config.provider, config.model);
  if (!model) {
    throw new Error(
      `Model '${config.model}' is not available for provider '${config.provider}'. ` +
        `Set KA_PROVIDER / KA_MODEL to a valid pi-ai provider/model.`,
    );
  }

  return new Agent({
    initialState: {
      systemPrompt: INSTRUCTIONS,
      model,
      thinkingLevel: "off",
      tools: createKnowledgeTools(config),
      messages: [],
    },
  });
}
