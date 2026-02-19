import fg from "fast-glob";
import path from "node:path";
import { readFile } from "node:fs/promises";

const DEFAULT_SOURCE_GLOBS = ["**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}"];
const DEFAULT_IGNORE_GLOBS = ["**/node_modules/**", "**/.git/**"];

export interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
}

export interface ScannedFile {
  path: string;
  absolutePath: string;
  content: string;
}

export interface ScanResult {
  files: ScannedFile[];
  tree: FileNode;
}

export async function scanCodebase(rootPath: string): Promise<ScanResult> {
  const gitignorePatterns = await loadGitignorePatterns(rootPath);
  const ignorePatterns = [...DEFAULT_IGNORE_GLOBS, ...gitignorePatterns];

  const absolutePaths = await fg(DEFAULT_SOURCE_GLOBS, {
    cwd: rootPath,
    absolute: true,
    onlyFiles: true,
    dot: true,
    ignore: ignorePatterns,
  });

  const files = await Promise.all(
    absolutePaths.map(async (absolutePath) => {
      const content = await readFile(absolutePath, "utf8");
      const relativePath = toPosix(path.relative(rootPath, absolutePath));

      return {
        path: relativePath,
        absolutePath,
        content,
      };
    }),
  );

  files.sort((a, b) => a.path.localeCompare(b.path));

  return {
    files,
    tree: buildTree(files.map((file) => file.path), rootPath),
  };
}

async function loadGitignorePatterns(rootPath: string): Promise<string[]> {
  const gitignorePath = path.join(rootPath, ".gitignore");

  try {
    const raw = await readFile(gitignorePath, "utf8");

    return raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#") && !line.startsWith("!"))
      .map(normalizeGitignorePattern);
  } catch {
    return [];
  }
}

function normalizeGitignorePattern(pattern: string): string {
  const clean = pattern.replace(/\\/g, "/").replace(/^\.\//, "");

  if (clean.endsWith("/")) {
    const base = clean.slice(0, -1);
    return `**/${base}/**`;
  }

  if (!clean.includes("/")) {
    return `**/${clean}`;
  }

  return clean;
}

function buildTree(filePaths: string[], rootPath: string): FileNode {
  const root: FileNode = {
    name: path.basename(rootPath) || ".",
    path: ".",
    type: "directory",
    children: [],
  };

  for (const filePath of filePaths) {
    const parts = filePath.split("/");
    let current = root;

    for (let i = 0; i < parts.length; i += 1) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const currentPath = parts.slice(0, i + 1).join("/");

      if (!current.children) {
        current.children = [];
      }

      let node = current.children.find((child) => child.name === part);

      if (!node) {
        node = {
          name: part,
          path: currentPath,
          type: isLast ? "file" : "directory",
          children: isLast ? undefined : [],
        };
        current.children.push(node);
      }

      if (node.type === "directory") {
        current = node;
      }
    }
  }

  sortTree(root);
  return root;
}

function sortTree(node: FileNode): void {
  if (!node.children) {
    return;
  }

  node.children.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === "directory" ? -1 : 1;
    }

    return a.name.localeCompare(b.name);
  });

  for (const child of node.children) {
    sortTree(child);
  }
}

function toPosix(inputPath: string): string {
  return inputPath.replace(/\\/g, "/");
}
