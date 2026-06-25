import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Config } from "../src/config.js";
import {
  createListConceptsTool,
  createReadConceptTool,
  createWriteConceptTool,
} from "../src/tools/index.js";

let dir: string;
let config: Config;

const SEED = `---
type: metric
name: user_retention
tags: [metrics, growth]
---
# Retention
secret-body-marker`;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "ka-test-"));
  await fs.writeFile(path.join(dir, "user_retention.md"), SEED, "utf-8");
  config = { knowledgeDir: dir, provider: "openrouter", model: "x" };
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe("list_concepts", () => {
  it("returns frontmatter fields but never the body", async () => {
    const tool = createListConceptsTool(config);
    const result = await tool.execute("id", {});
    const text = result.content.map((c) => ("text" in c ? c.text : "")).join("");
    expect(text).toContain("user_retention");
    expect(text).toContain("metric");
    expect(text).not.toContain("secret-body-marker");
  });
});

describe("read_concept", () => {
  it("reads a file inside the knowledge dir", async () => {
    const tool = createReadConceptTool(config);
    const result = await tool.execute("id", { filePath: "user_retention.md" });
    const text = result.content.map((c) => ("text" in c ? c.text : "")).join("");
    expect(text).toContain("secret-body-marker");
  });

  it("throws on path traversal", async () => {
    const tool = createReadConceptTool(config);
    await expect(
      tool.execute("id", { filePath: "../../etc/passwd" }),
    ).rejects.toThrow();
  });

  it("throws when the file is missing", async () => {
    const tool = createReadConceptTool(config);
    await expect(tool.execute("id", { filePath: "nope.md" })).rejects.toThrow();
  });
});

describe("write_concept", () => {
  it("rejects content missing a type field", async () => {
    const tool = createWriteConceptTool(config);
    const bad = "---\nname: churn\n---\n# Churn";
    await expect(
      tool.execute("id", { filePath: "churn.md", content: bad }),
    ).rejects.toThrow(/type/i);
    // nothing should have been written
    await expect(fs.access(path.join(dir, "churn.md"))).rejects.toThrow();
  });

  it("rejects content without frontmatter", async () => {
    const tool = createWriteConceptTool(config);
    await expect(
      tool.execute("id", { filePath: "churn.md", content: "# Just markdown" }),
    ).rejects.toThrow();
  });

  it("writes valid OKF content", async () => {
    const tool = createWriteConceptTool(config);
    const good = "---\ntype: metric\nname: churn\n---\n# Churn rate";
    await tool.execute("id", { filePath: "churn.md", content: good });
    const written = await fs.readFile(path.join(dir, "churn.md"), "utf-8");
    expect(written).toContain("# Churn rate");
  });

  it("throws on path traversal", async () => {
    const tool = createWriteConceptTool(config);
    const good = "---\ntype: metric\n---\nbody";
    await expect(
      tool.execute("id", { filePath: "../escape.md", content: good }),
    ).rejects.toThrow();
  });
});
