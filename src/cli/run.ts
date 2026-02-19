import { Command } from "commander";
import { scanCodebase } from "../core/scanner.js";
import { analyzeProject } from "../core/analyzer.js";
import { writeReadme } from "../core/writer.js";

export async function runCli(): Promise<void> {
  const program = new Command();

  program
    .name("auto-documentor")
    .description("Scan a project, analyze architecture, and generate docs")
    .version("0.1.0")
    .requiredOption("-p, --path <path>", "Path to the project root")
    .option("--api-key <key>", "OpenAI API key (overrides OPENAI_API_KEY)")
    .action(async (options) => {
      try {
        const scan = await scanCodebase(options.path);
        const analysis = await analyzeProject(options.path, scan.files, {
          apiKey: options.apiKey,
        });
        const outputPath = await writeReadme(options.path, analysis);

        console.log(`Scanned ${scan.files.length} files.`);
        console.log(`Root nodes in tree: ${scan.tree.children?.length ?? 0}`);
        console.log(`Generated README: ${outputPath}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Error: ${message}`);
        process.exitCode = 1;
      }
    });

  await program.parseAsync(process.argv);
}
