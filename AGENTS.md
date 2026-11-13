Follow the workspace [agent workflow](../AGENTS.md); keep the project rules below.

# Source architecture

This repository owns the index generator formerly in
`stylist-svelte-tools/src/lib/indexation`. Source follows the architecture in
the sibling `stylist-svelte/AGENTS.md`:

- `src/lib/indexation/<cluster>/<joint>/<family>/index.ts` is one exported entity.
- Cluster declarations are strict: `const`, `type`, `interface`, `class`, `function`.
  Classes use design-pattern joints (`adapter`, `builder`, `facade`, `factory`,
  `registry`, `repository`, `strategy`, `visitor`).
- `README.md` is allowed at the domain root and a cluster root only; every
  exported entity has a JSDoc summary listed there.
- No non-exported top-level declarations and no handwritten barrels.
- Assembly direction: data -> const -> type -> interface -> class -> function -> test.
- Vitest suites belong in `test/unit/<family>/index.test.ts`, export nothing, use
  synthetic sources in a temporary directory and are never imported by production code.
- `scripts/indexation.mjs` only launches `IndexationCli`.
- No build step: Node.js >=24.11 executes TypeScript. The only runtime dependency
  is `typescript` (`TsAstParser`).

Project knowledge never goes into code: project lists, domain names, naming
rules, markers and paths belong in `stylist-indexation.config.json`
([IndexationConfig](src/lib/indexation/interface/contract/indexation-config/index.ts))
and its defaults. Every step reads them through `IndexationSettings`; tests
that set it reset it afterwards. A new configuration key needs its default,
validation in `IndexationConfigRepository`, a test and a README row.

Keep the enriched-tree JSON schema compatible with the reader and the auditor in
`stylist-svelte-tools`. Python compatibility is dropped; do not reintroduce
Python ordering, escaping or newline quirks.

Run `npm run check` and `npm test` after changes. Verify against real sources
only with `--dry-run` and `--out-dir` in an isolated directory. Writing
`stylist-svelte` barrels is human-only, like `yarn stylist:index`.
