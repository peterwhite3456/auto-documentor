import path from "node:path";
import { writeFile } from "node:fs/promises";
import type { ProjectAnalysis } from "./analyzer.js";

export async function writeReadme(rootPath: string, analysis: ProjectAnalysis): Promise<string> {
  const targetPath = path.join(rootPath, "NEW_README.md");
  const markdown = renderReadme(analysis);

  await writeFile(targetPath, markdown, "utf8");

  return targetPath;
}

export function renderReadme(analysis: ProjectAnalysis): string {
  const deps = formatDependencies(analysis.dependencies);
  const features = formatList(analysis.features);
  const apiReference = formatList(analysis.apiReference);

  return [
    `# ${analysis.projectName}`,
    "",
    "## Mission",
    analysis.mission,
    "",
    "## Architecture",
    analysis.architecture,
    "",
    "## Features",
    features,
    "",
    "## Installation",
    "Install dependencies:",
    "",
    "```bash",
    "npm install",
    "```",
    "",
    "Project dependencies:",
    "",
    deps,
    "",
    "## API Reference",
    apiReference,
    "",
  ].join("\n");
}

function formatDependencies(dependencies: Record<string, string>): string {
  const entries = Object.entries(dependencies).sort(([a], [b]) => a.localeCompare(b));

  if (entries.length === 0) {
    return "- No runtime dependencies detected.";
  }

  return entries.map(([name, version]) => `- \`${name}\`: \`${version}\``).join("\n");
}

function formatList(values: string[]): string {
  if (values.length === 0) {
    return "- None";
  }

  return values.map((value) => `- ${value}`).join("\n");
}