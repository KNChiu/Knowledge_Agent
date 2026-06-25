import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Path-traversal containment. Every file access performed by the tools must be
 * confined to the knowledge directory; agent-supplied paths are untrusted.
 */

export type ResolveResult =
  | { ok: true; absolutePath: string }
  | { ok: false; error: string };

/**
 * Resolve a knowledge-relative path to an absolute path, rejecting anything
 * that escapes the knowledge directory (via `..`, an absolute path, or a
 * symlink that points outside).
 */
export function resolveInsideKnowledge(
  knowledgeDir: string,
  relativePath: string,
): ResolveResult {
  if (typeof relativePath !== "string" || relativePath.trim() === "") {
    return { ok: false, error: "A non-empty file path is required." };
  }
  if (path.isAbsolute(relativePath)) {
    return { ok: false, error: "Absolute paths are not allowed." };
  }

  const baseDir = path.resolve(knowledgeDir);
  const candidate = path.resolve(baseDir, relativePath);

  if (!isInside(baseDir, candidate)) {
    return {
      ok: false,
      error: `Path '${relativePath}' escapes the knowledge directory.`,
    };
  }

  // Defend against symlink escapes: if the file already exists, its real path
  // must still resolve inside the (real) knowledge directory.
  if (fs.existsSync(candidate)) {
    const realBase = fs.realpathSync(baseDir);
    const realCandidate = fs.realpathSync(candidate);
    if (!isInside(realBase, realCandidate)) {
      return {
        ok: false,
        error: `Path '${relativePath}' resolves outside the knowledge directory.`,
      };
    }
  }

  return { ok: true, absolutePath: candidate };
}

function isInside(baseDir: string, candidate: string): boolean {
  if (candidate === baseDir) return true;
  const rel = path.relative(baseDir, candidate);
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}
