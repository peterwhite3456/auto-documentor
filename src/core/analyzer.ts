import path from "node:path";
import { access, readFile } from "node:fs/promises";
import OpenAI from "openai";
import type { ScannedFile } from "./scanner.js";

export interface ProjectAnalysis {
  projectName: string;
  mission: string;
  architecture: string;
  features: string[];
  apiReference: string[];
  dependencies: Record<string, string>;
  prompt: string;
}

interface PackageJson {
  name?: string;
  description?: string;
  main?: string;
  module?: string;
  types?: string;
  bin?: string | Record<string, string>;
  exports?: string | Record<string, unknown>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export interface AnalyzeOptions {
  apiKey?: string;
  model?: string;
}

export async function analyzeProject(
  rootPath: string,
  files: ScannedFile[],
  options: AnalyzeOptions = {},
): Promise<ProjectAnalysis> {
  const pkg = await loadPackageJson(rootPath);
  const readme = await loadOptionalFile(path.join(rootPath, "README.md"));
  const entryPoints = findEntryPoints(pkg, files);
  const prompt = buildAnalysisPrompt(pkg, readme, files, entryPoints);
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing OpenAI API key. Set OPENAI_API_KEY or pass --api-key.");
  }

  const client = new OpenAI({ apiKey });

  const response = await client.responses.create({
    model: options.model ?? "gpt-5-codex",
    input: prompt,
    text: {
      format: {
        type: "json_schema",
        name: "project_analysis",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            mission: { type: "string" },
            architecture: { type: "string" },
            features: {
              type: "array",
              items: { type: "string" },
            },
            apiReference: {
              type: "array",
              items: { type: "string" },
            },
          },
          required: ["mission", "architecture", "features", "apiReference"],
        },
      },
    },
  });

  const structured = JSON.parse(response.output_text) as {
    mission: string;
    architecture: string;
    features: string[];
    apiReference: string[];
  };

  return {
    projectName: pkg.name ?? path.basename(rootPath),
    mission: structured.mission,
    architecture: structured.architecture,
    features: structured.features,
    apiReference: structured.apiReference,
    dependencies: pkg.dependencies ?? {},
    prompt,
  };
}

export function buildAnalysisPrompt(
  pkg: PackageJson,
  readme: string,
  files: ScannedFile[],
  entryPoints: string[],
): string {
  const packageBlock = JSON.stringify(pkg, null, 2);
  const treeBlock = files.slice(0, 400).map((file) => `- ${file.path}`).join("\n");
  const entryBlock = entryPoints.length > 0 ? entryPoints.map((p) => `- ${p}`).join("\n") : "- (none found)";
  const fileContext = files
    .slice(0, 20)
    .map((file) => `### ${file.path}\n${file.content.slice(0, 2000)}`)
    .join("\n\n");

  return [
    "You are gpt-5-codex acting as a software architecture analyst.",
    "Synthesize a high-confidence big-picture understanding of this repository.",
    "Return JSON with keys: mission, architecture, features, apiReference.",
    "Do not invent APIs that are not present in the provided code.",
    "",
    "## package.json",
    packageBlock,
    "",
    "## README.md",
    readme || "(README.md not found)",
    "",
    "## Main Entry Points",
    entryBlock,
    "",
    "## File List (truncated)",
    treeBlock,
    "",
    "## Key File Snapshots",
    fileContext,
  ].join("\n");
}

async function loadPackageJson(rootPath: string): Promise<PackageJson> {
  const packagePath = path.join(rootPath, "package.json");
  const raw = await readFile(packagePath, "utf8");

  return JSON.parse(raw) as PackageJson;
}

async function loadOptionalFile(filePath: string): Promise<string> {
  try {
    await access(filePath);
    return await readFile(filePath, "utf8");
  } catch {
    return "";
  }
}

function findEntryPoints(pkg: PackageJson, files: ScannedFile[]): string[] {
  const fileSet = new Set(files.map((file) => file.path));
  const results = new Set<string>();

  for (const candidate of extractPackageEntryCandidates(pkg)) {
    const normalized = toPosix(candidate.replace(/^\.\//, ""));

    if (fileSet.has(normalized)) {
      results.add(normalized);
    }
  }

  const conventionalEntries = [
    "src/index.ts",
    "src/main.ts",
    "src/cli/run.ts",
    "index.ts",
    "index.js",
  ];

  for (const entry of conventionalEntries) {
    if (fileSet.has(entry)) {
      results.add(entry);
    }
  }

  return Array.from(results);
}

function extractPackageEntryCandidates(pkg: PackageJson): string[] {
  const candidates: string[] = [];

  if (typeof pkg.main === "string") {
    candidates.push(pkg.main);
  }

  if (typeof pkg.module === "string") {
    candidates.push(pkg.module);
  }

  if (typeof pkg.types === "string") {
    candidates.push(pkg.types);
  }

  if (typeof pkg.bin === "string") {
    candidates.push(pkg.bin);
  }

  if (pkg.bin && typeof pkg.bin === "object") {
    for (const value of Object.values(pkg.bin)) {
      if (typeof value === "string") {
        candidates.push(value);
      }
    }
  }

  if (typeof pkg.exports === "string") {
    candidates.push(pkg.exports);
  }

  return candidates;
}

function toPosix(inputPath: string): string {
  return inputPath.replace(/\\/g, "/");
}
