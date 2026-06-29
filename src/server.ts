import "dotenv/config";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as url from "node:url";
import express from "express";
import multer from "multer";
import { registerBuiltInApiProviders } from "@earendil-works/pi-ai/compat";
import { loadConfig } from "./config.js";
import { createKnowledgeAgent } from "./agent.js";
import { createListConceptsTool, createReadConceptTool, createWriteConceptTool } from "./tools/index.js";
import { generateFrontmatter, slugify } from "./generateFrontmatter.js";
import { parseOkf, validateOkf, serializeOkf, stripFrontmatter } from "./okf.js";
import { resolveInsideKnowledge } from "./paths.js";

registerBuiltInApiProviders();

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const config = loadConfig();
const app = express();

// Tool singletons — shared across requests; each tool is stateless
const listTool = createListConceptsTool(config);
const readTool = createReadConceptTool(config);
const writeTool = createWriteConceptTool(config);

// Store uploaded files in memory (files are small Markdown docs)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

function firstText(content: { type: string; text?: string }[]): string {
  return (content.find((c) => c.type === "text") as { type: "text"; text: string } | undefined)?.text ?? "";
}

// List all concepts (frontmatter only — no body)
app.get("/api/concepts", async (_req, res) => {
  const result = await listTool.execute("", {});
  res.json(JSON.parse(firstText(result.content)));
});

// Read a single concept by filename
app.get("/api/concepts/:file", async (req, res) => {
  try {
    const result = await readTool.execute("", { filePath: req.params["file"] ?? "" });
    res.json({ content: firstText(result.content) });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

// Update an existing concept's full markdown. Routes through writeTool so the
// traversal guard and OKF validation are enforced exactly like uploads.
app.put("/api/concepts/:file", async (req, res) => {
  const content = (req.body as { content?: string }).content ?? "";
  try {
    await writeTool.execute("", { filePath: req.params["file"] ?? "", content });
    res.json({ file: req.params["file"], content });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

// Delete a concept. No delete tool exists; guard the path and unlink directly.
app.delete("/api/concepts/:file", async (req, res) => {
  const resolved = resolveInsideKnowledge(config.knowledgeDir, req.params["file"] ?? "");
  if (!resolved.ok) {
    res.status(400).json({ error: resolved.error });
    return;
  }
  try {
    await fs.unlink(resolved.absolutePath);
    res.json({ file: req.params["file"] });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    res.status(code === "ENOENT" ? 404 : 400).json({ error: (err as Error).message });
  }
});

// Upload a file — auto-generate OKF frontmatter if missing, then save
app.post("/api/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No file provided." });
    return;
  }

  const originalName = req.file.originalname;
  const rawContent = req.file.buffer.toString("utf-8");
  const targetFile = slugify(path.basename(originalName, path.extname(originalName))) + ".md";

  const parsed = parseOkf(rawContent);
  let finalContent: string;

  if (parsed.ok && validateOkf(parsed.frontmatter).ok) {
    finalContent = rawContent;
  } else {
    const fm = await generateFrontmatter(rawContent, originalName, config);
    const body = parsed.ok ? parsed.body : stripFrontmatter(rawContent);
    finalContent = serializeOkf(fm, body);
  }

  try {
    await writeTool.execute("", { filePath: targetFile, content: finalContent });
    res.json({ file: targetFile, content: finalContent });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

// Chat — streams SSE events while the agent reasons
app.post("/api/chat", async (req, res) => {
  const query: string = (req.body as { query?: string }).query?.trim() ?? "";
  if (!query) {
    res.status(400).json({ error: "query is required" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const send = (event: string, data: string) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const agent = createKnowledgeAgent(config);

  agent.subscribe((event) => {
    switch (event.type) {
      case "tool_execution_start":
        send("tool", event.toolName);
        break;
      case "message_update":
        if (event.assistantMessageEvent.type === "text_delta") {
          send("text", event.assistantMessageEvent.delta);
        }
        break;
      case "agent_end":
        send("done", "");
        res.end();
        break;
    }
  });

  try {
    await agent.prompt(query);
    await agent.waitForIdle();
  } catch (err) {
    send("error", (err as Error).message);
    res.end();
  }
});

const PORT = Number(process.env.PORT ?? 3000);
app.listen(PORT, () => {
  console.log(`Knowledge Agent UI → http://localhost:${PORT}`);
});
