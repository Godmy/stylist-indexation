# indexation / class

Classes; the joint names the design-pattern role of the class.

## adapter

Pattern: adapts an external format or API.

| entity       | family                                      | description                                                           |
| ------------ | ------------------------------------------- | --------------------------------------------------------------------- |
| `SourceText` | [source-text](adapter/source-text/index.ts) | Line and order semantics of source text, independent of the platform. |

## builder

Pattern: assembles a result step by step.

| entity                  | family                                              | description                                                                                  |
| ----------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `ComponentTreeBuilder`  | [component-tree](builder/component-tree/index.ts)   | Directory tree of a source root, with module checkouts projected onto their logical domains. |
| `DependencyBushBuilder` | [dependency-bush](builder/dependency-bush/index.ts) | Dependency bushes of component entries, built from the enriched tree.                        |
| `IndexContentBuilder`   | [index-content](builder/index-content/index.ts)     | Final index.ts text: generated block plus the preserved protected section.                   |
| `IndexStructureBuilder` | [index-structure](builder/index-structure/index.ts) | Expected index.ts structure and generated text of a tree node.                               |

## facade

Pattern: entry point over the domain.

| entity          | family                                           | description                                 |
| --------------- | ------------------------------------------------ | ------------------------------------------- |
| `IndexationCli` | [indexation-cli](facade/indexation-cli/index.ts) | Command line entry of the index generation. |

## factory

Pattern: creates objects by kind.

| entity             | family                                    | description                                                 |
| ------------------ | ----------------------------------------- | ----------------------------------------------------------- |
| `FileEntryFactory` | [file-entry](factory/file-entry/index.ts) | Analysis entries of the files of a tree node, by file kind. |

## registry

Pattern: looks up registered items.

| entity                   | family                                                       | description                                                      |
| ------------------------ | ------------------------------------------------------------ | ---------------------------------------------------------------- |
| `GenerationModeRegistry` | [generation-mode](registry/generation-mode/index.ts)         | Generation modes and the root domain/cluster filters they apply. |
| `IndexationSettings`     | [indexation-settings](registry/indexation-settings/index.ts) | Configuration of the current run, read by every generation step. |

## repository

Pattern: owns storage and file access.

| entity                       | family                                                     | description                                                                   |
| ---------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `IndexationConfigRepository` | [indexation-config](repository/indexation-config/index.ts) | Reads `stylist-indexation.config.json`, its `extends` chain and the defaults. |
| `ModuleSourceRepository`     | [module-source](repository/module-source/index.ts)         | modules.json registry and the physical domain checkouts it maps.              |
| `SourceProjectRepository`    | [source-project](repository/source-project/index.ts)       | Configured source projects and the layout of each one.                        |

## strategy

Pattern: interchangeable algorithm behind one contract.

| entity        | family                                           | description                                                              |
| ------------- | ------------------------------------------------ | ------------------------------------------------------------------------ |
| `TsAstParser` | [ts-ast-parser](strategy/ts-ast-parser/index.ts) | Exports and imports of TS code, parsed with the TypeScript compiler API. |

## visitor

Pattern: walks a tree.

| entity            | family                                                | description                                                                                    |
| ----------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `ComponentParser` | [component-parser](visitor/component-parser/index.ts) | Visitor that enriches the directory tree with per-file analysis and expected barrel structure. |
| `IndexWriter`     | [index-writer](visitor/index-writer/index.ts)         | Walks the enriched tree and writes stale generated index files.                                |
