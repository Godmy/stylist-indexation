# Changelog

## 1.0.1 — 2026-11-13

- Releases go through npm staged publishing: the GitHub release workflow
  stages the version with trusted publishing (OIDC, no npm token) and a
  maintainer approves it with 2FA. See `RELEASING.md`.
- No changes to the generator.

## 1.0.0 — 2026-11-13

First public release.

- Barrel generation (`index.ts`, `index.full.ts`) with protected sections for
  TypeScript and Svelte sources, moved from `stylist-svelte-tools`.
- Enriched JSON tree of files, exports, imports and expected barrels.
- `stylist-indexation.config.json` with `extends`: projects, source root,
  root clusters, service folders, generation modes, markers, output directory,
  skipped folders, SVG domains, component naming and import aliases.
- Without a configuration the launch directory is the only project.
- Exports and imports are read with the TypeScript compiler API; Python
  compatibility of the former generator is dropped.
- CLI `stylist-indexation` with `--config`, `--out-dir`, `--dry-run`, `--check`.
- `skipFolders` and `clustersOnly` replace folder rules that were hard-coded
  for `stylist-svelte`.
- Fixed: enums are re-exported as values (they were `export type`).
- Fixed: plain folders inside a domain and hand-written `index.ts` entry
  modules reach the parent barrels (strict SAMO keeps the old behaviour
  with `clustersOnly: true`).
- npm package with compiled `dist/`, type declarations and a `bin`; Node.js 22+.
