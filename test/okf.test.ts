import { describe, expect, it } from "vitest";
import { parseOkf, summarize, validateOkf } from "../src/okf.js";

const VALID = `---
type: metric
name: user_retention
tags: [metrics, growth]
---
# Body
content here`;

describe("parseOkf", () => {
  it("parses frontmatter and body", () => {
    const result = parseOkf(VALID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.frontmatter.type).toBe("metric");
    expect(result.body).toContain("# Body");
  });

  it("rejects content without frontmatter", () => {
    const result = parseOkf("# Just markdown");
    expect(result.ok).toBe(false);
  });

  it("rejects malformed YAML", () => {
    const result = parseOkf("---\ntype: [unclosed\n---\nbody");
    expect(result.ok).toBe(false);
  });

  it("rejects non-mapping frontmatter", () => {
    const result = parseOkf("---\n- just\n- a\n- list\n---\nbody");
    expect(result.ok).toBe(false);
  });
});

describe("validateOkf", () => {
  it("accepts a non-empty type", () => {
    expect(validateOkf({ type: "metric" }).ok).toBe(true);
  });

  it("rejects a missing type", () => {
    const r = validateOkf({ name: "x" });
    expect(r.ok).toBe(false);
  });

  it("rejects an empty type", () => {
    expect(validateOkf({ type: "   " }).ok).toBe(false);
  });
});

describe("summarize", () => {
  it("returns only type/name/tags", () => {
    const parsed = parseOkf(VALID);
    if (!parsed.ok) throw new Error("expected parse");
    const summary = summarize(parsed.frontmatter);
    expect(Object.keys(summary).sort()).toEqual(["name", "tags", "type"]);
  });
});
