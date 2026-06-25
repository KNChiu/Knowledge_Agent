import * as path from "node:path";

/**
 * Runtime configuration, all overridable via environment variables so the agent
 * can target any pi-ai provider/model without code changes.
 */
export interface Config {
  /** Absolute path to the OKF knowledge base directory. */
  knowledgeDir: string;
  /** pi-ai provider id (default: OpenRouter). */
  provider: string;
  /** Model id within the provider. */
  model: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const knowledgeDir = path.resolve(
    env.KNOWLEDGE_DIR ?? path.join(process.cwd(), "knowledge"),
  );

  return {
    knowledgeDir,
    provider: env.KA_PROVIDER ?? "openrouter",
    model: env.KA_MODEL ?? "deepseek/deepseek-v4-flash",
  };
}
