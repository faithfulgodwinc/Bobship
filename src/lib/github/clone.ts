import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import simpleGit from "simple-git";

export interface CloneResult {
  success: boolean;
  repoPath: string;
  error?: string;
  cleanup: () => void;
}

/**
 * Clone a git repository into a temporary directory.
 * Returns the path and a cleanup function to remove the clone.
 */
export async function cloneRepository(
  repoUrl: string,
  branch: string = "main"
): Promise<CloneResult> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bobship-"));

  const cleanup = () => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  };

  try {
    const git = simpleGit();
    await git.clone(repoUrl, tmpDir, [
      "--depth=1",
      "--single-branch",
      `--branch=${branch}`,
    ]);
    return { success: true, repoPath: tmpDir, cleanup };
  } catch (cloneErr) {
    // Try without branch specification (branch might not exist)
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      const tmpDir2 = fs.mkdtempSync(path.join(os.tmpdir(), "bobship-"));
      const git = simpleGit();
      await git.clone(repoUrl, tmpDir2, ["--depth=1"]);

      const cleanup2 = () => {
        try {
          fs.rmSync(tmpDir2, { recursive: true, force: true });
        } catch {
          // Ignore
        }
      };

      return { success: true, repoPath: tmpDir2, cleanup: cleanup2 };
    } catch (err) {
      cleanup();
      return {
        success: false,
        repoPath: "",
        error: err instanceof Error ? err.message : "Clone failed",
        cleanup: () => {},
      };
    }
  }
}

/**
 * Safely read a file, returning null if it doesn't exist.
 */
export function readFileSafe(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

/**
 * Find files matching a pattern in a directory tree (limited depth).
 */
export function findFiles(
  dir: string,
  patterns: string[],
  maxDepth: number = 6
): string[] {
  const results: string[] = [];

  function walk(currentDir: string, depth: number) {
    if (depth > maxDepth) return;
    try {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        // Skip node_modules, .git, build output directories
        if (
          entry.isDirectory() &&
          ![
            "node_modules",
            ".git",
            "build",
            "dist",
            ".gradle",
            "Pods",
            "__pycache__",
          ].includes(entry.name)
        ) {
          walk(fullPath, depth + 1);
        } else if (entry.isFile()) {
          const name = entry.name;
          if (patterns.some((p) => name === p || name.endsWith(p))) {
            results.push(fullPath);
          }
        }
      }
    } catch {
      // Skip unreadable directories
    }
  }

  walk(dir, 0);
  return results;
}

/**
 * Get a short relative path for display (evidence references).
 */
export function relativePath(repoRoot: string, filePath: string): string {
  return path.relative(repoRoot, filePath);
}
