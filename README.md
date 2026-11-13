# stylist-indexation

Barrel generator and export/dependency indexer for TypeScript and Svelte.

It walks the source tree of a library or site, parses `.ts`, `.svelte`,
stories, SVG and shader files with the TypeScript compiler API, writes
`index.ts` / `index.full.ts` barrels (keeping hand-written `AUTO-PROTECTED`
sections) and saves an enriched JSON tree of exports, imports and dependencies.

## Quick start

Requires Node.js **24.11 or newer**: Node executes the TypeScript sources
directly, without a build step.

```powershell
git clone https://github.com/Godmy/stylist-indexation.git
cd stylist-indexation
npm ci
```

Then, from the root of any project with `src/lib`:

```powershell
node ../stylist-indexation/scripts/indexation.mjs --dry-run   # report only
node ../stylist-indexation/scripts/indexation.mjs             # write barrels
node ../stylist-indexation/scripts/indexation.mjs --check     # exit 1 when barrels are stale
```

Without a configuration file the launch directory is the only project, sources
are read from `src/lib` and diagnostics go to `.stylist-indexation/`
(add it to `.gitignore`).

## Configuration

`stylist-indexation.config.json` in the launch directory, or `--config <file>`.
Every key is optional; paths are relative to the file that declares them.

```json
{
  "extends": "../my-library/stylist-indexation.config.json",
  "projects": [
    { "name": "my-library", "path": "../my-library" },
    { "name": "site", "path": "." }
  ],
  "sourceRoot": "src/lib",
  "outDir": ".stylist-indexation",
  "marker": "STYLIST CODER MODEL",
  "svgDomains": ["svg"],
  "componentPrefixes": { "html": "Html" },
  "componentNames": { "html/node": "HtmlNodeRenderer" }
}
```

| Key                 | Default                                              | Meaning                                                                 |
| ------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------- |
| `extends`           | —                                                    | Base configuration; its projects come first, maps are merged            |
| `projects`          | the config directory                                 | `{ name, path }` of every indexed project                               |
| `sourceRoot`        | `src/lib`                                            | Source directory inside a project                                       |
| `rootClusters`      | `class component const data function interface type` | Folders that make a source root a single domain                         |
| `serviceFolders`    | `server test`                                        | Other folders allowed at a single-domain root, never exported           |
| `modes`             | `full`, `package` (see below)                        | `{ excludedRootDomains, includedRootClusters }` per `--generation-mode` |
| `marker`            | `STYLIST CODER MODEL`                                | Barrel header `/** AREA: <marker> -> AUTO-GENERATED */`                 |
| `retiredMarkers`    | `[]`                                                 | Former header labels dropped from protected sections                    |
| `outDir`            | `.stylist-indexation`                                | Diagnostics directory                                                   |
| `svgDomains`        | `[]`                                                 | Domains whose SVG folders get glob constants and name lists             |
| `componentPrefixes` | `{}`                                                 | Component name prefix per domain                                        |
| `componentNames`    | `{}`                                                 | Exact component name per `domain/family`                                |
| `aliases`           | `["$lib"]`                                           | Import alias prefixes resolved against the source root                  |

Built-in modes: `full` exports every root cluster and excludes the `server`
domain; `package` (used for the public `index.ts` of a multi-domain root)
exports `component`, `const`, `interface`, `type` and excludes `server` plus the
private domains of `modules.json`. Unknown keys are rejected.

## Commands

| Flag                              | Effect                                    |
| --------------------------------- | ----------------------------------------- |
| `--config <file>`                 | Configuration instead of the default name |
| `--out-dir <dir>`                 | Diagnostics directory instead of `outDir` |
| `--generation-mode <mode>`        | Configured mode, `full` by default        |
| `--modules all\|public\|name,...` | Selected `modules.json` entries           |
| `--exclude-modules name,...`      | Exclusions after selection                |
| `--projects name,...`             | Only these configured projects            |
| `--dry-run`                       | Compute without writing barrels           |
| `--check`                         | Dry run; exit 1 when barrels are stale    |

Exit codes: 0 success, 1 stale barrels or a generation error, 2 invalid
arguments or configuration. Diagnostics: `<project>.json` (enriched tree),
`<project>-components.json` (raw tree) and `result.md`; `dry-run/` for
`--dry-run` and `--check`.

## As a dependency

The package exposes every entity by its path inside the domain:

```ts
import { IndexationCli } from 'stylist-indexation/class/facade/indexation-cli';
import { analyzeProject } from 'stylist-indexation/function/create/analyze-project';
import type { EnrichedNode } from 'stylist-indexation/interface/contract/enriched-node';
```

Link it as `portal:<path>` (Yarn) or `file:<path>` (npm). Publishing to npm
needs a build step to `dist/`, because Node does not strip types inside
`node_modules`.

## History

Moved from `stylist-svelte-tools` (`src/lib/indexation`, commit `4938877`), a
TypeScript port of the former Python `stylist/indexation/cli.py`. Python
compatibility is dropped: exports are read with the TypeScript compiler API,
JSON is written as UTF-8 and every file uses LF unless an existing barrel uses
CRLF. Barrels of `stylist-svelte` are unchanged by this switch.

## Architecture

See [src/lib/indexation/README.md](src/lib/indexation/README.md) for the flow
and the generation rules, and [AGENTS.md](AGENTS.md) for source conventions.
