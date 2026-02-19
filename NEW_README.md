# auto-documentor

## Mission
Generate high-level project documentation by scanning a codebase and summarizing its architecture, features, and APIs using OpenAI.

## Architecture
The CLI entry point (`src/index.ts`) invokes the Commander-driven interface in `src/cli/run.ts`, which orchestrates three core subsystems: `scanCodebase` in `src/core/scanner.ts` crawls the project with fast-glob, respecting .gitignore rules and building both a file list and tree; `analyzeProject` in `src/core/analyzer.ts` gathers package metadata, assembles a structured prompt, and requests a JSON-structured analysis from the OpenAI Responses API; `writeReadme` in `src/core/writer.ts` formats the returned analysis (mission, architecture, features, dependencies, API reference) into a new `NEW_README.md`. The CLI ties these steps together, handling errors and user-supplied API keys.

## Features
- Command-line interface (`auto-documentor`) that accepts a project path and optional OpenAI API key.
- File system scanner that collects TypeScript/JavaScript sources while honoring `.gitignore` patterns and producing both a sorted file list and directory tree.
- OpenAI-backed analyzer that builds a structured prompt from package metadata, README contents, and entry points to request project insights.
- README generator that renders the model’s analysis into Markdown, including mission, architecture, features, dependencies, and API reference sections.

## Installation
Install dependencies:

```bash
npm install
```

Project dependencies:

- `commander`: `^12.1.0`
- `fast-glob`: `^3.3.3`
- `openai`: `^4.104.0`

## API Reference
- CLI `auto-documentor`: options `--path <path>` (required), `--api-key <key>` override for OpenAI authentication.
- `runCli()` – boots the Commander CLI and coordinates scanning, analysis, and README generation.
- `scanCodebase(rootPath)` – returns `{ files, tree }` after globbing relevant source files and respecting ignore rules.
- `analyzeProject(rootPath, files, options)` – calls OpenAI Responses API with a structured prompt to obtain mission, architecture, features, API reference, dependencies, and prompt text.
- `writeReadme(rootPath, analysis)` – writes `NEW_README.md` from the analysis; `renderReadme(analysis)` formats the Markdown contents.
