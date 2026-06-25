import * as yaml from "js-yaml";

/**
 * Open Knowledge Format (OKF) helpers.
 *
 * Every knowledge file is `--- <yaml frontmatter> ---` followed by a Markdown
 * body. We use a real YAML parser (js-yaml) rather than hand-rolled string
 * parsing so malformed frontmatter is detected reliably.
 */

export type Frontmatter = Record<string, unknown>;

export type ParseResult =
  | { ok: true; frontmatter: Frontmatter; body: string }
  | { ok: false; error: string };

export type ValidateResult = { ok: true } | { ok: false; error: string };

/** Only the fields surfaced by `list_concepts` (never the body, to save tokens). */
export interface ConceptSummary {
  type: unknown;
  name: unknown;
  tags: unknown;
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

/** Split a raw OKF file into parsed frontmatter and the remaining body. */
export function parseOkf(raw: string): ParseResult {
  const match = FRONTMATTER_RE.exec(raw);
  if (!match) {
    return {
      ok: false,
      error:
        "Missing OKF YAML frontmatter. Content must start with a '---' delimited YAML block.",
    };
  }

  const [, frontmatterRaw, body = ""] = match;

  let parsed: unknown;
  try {
    parsed = yaml.load(frontmatterRaw ?? "");
  } catch (err) {
    return {
      ok: false,
      error: `Invalid YAML in frontmatter: ${(err as Error).message}`,
    };
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {
      ok: false,
      error: "Frontmatter must be a YAML mapping of key/value fields.",
    };
  }

  return { ok: true, frontmatter: parsed as Frontmatter, body };
}

/** Enforce the OKF contract: a non-empty `type` field must be present. */
export function validateOkf(frontmatter: Frontmatter): ValidateResult {
  const type = frontmatter.type;
  if (typeof type !== "string" || type.trim() === "") {
    return {
      ok: false,
      error: "OKF frontmatter requires a non-empty 'type' field.",
    };
  }
  return { ok: true };
}

/** Project a parsed frontmatter to the token-frugal listing shape. */
export function summarize(frontmatter: Frontmatter): ConceptSummary {
  return {
    type: frontmatter.type ?? null,
    name: frontmatter.name ?? null,
    tags: frontmatter.tags ?? [],
  };
}

/** Strip a leading `---…---` block (valid or broken) and return the remaining body. */
export function stripFrontmatter(raw: string): string {
  const match = FRONTMATTER_RE.exec(raw);
  return match ? (match[2] ?? "") : raw;
}

/** Serialize OKF frontmatter fields + body into a complete OKF Markdown string. */
export function serializeOkf(
  fm: { type: string; name: string; tags: string[]; last_updated?: string },
  body: string,
): string {
  const today = new Date().toISOString().slice(0, 10);
  return `---\ntype: ${fm.type}\nname: ${fm.name}\ntags: ${JSON.stringify(fm.tags)}\nlast_updated: ${fm.last_updated ?? today}\n---\n${body}`;
}
