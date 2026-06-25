import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveInsideKnowledge } from "../src/paths.js";

const KNOWLEDGE = path.resolve("knowledge");

describe("resolveInsideKnowledge", () => {
  it("allows a simple relative path", () => {
    const r = resolveInsideKnowledge(KNOWLEDGE, "user_retention.md");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.absolutePath).toBe(path.join(KNOWLEDGE, "user_retention.md"));
  });

  it("blocks parent traversal", () => {
    expect(resolveInsideKnowledge(KNOWLEDGE, "../../etc/passwd").ok).toBe(false);
  });

  it("blocks absolute paths", () => {
    expect(resolveInsideKnowledge(KNOWLEDGE, "/etc/passwd").ok).toBe(false);
  });

  it("blocks empty paths", () => {
    expect(resolveInsideKnowledge(KNOWLEDGE, "   ").ok).toBe(false);
  });
});
