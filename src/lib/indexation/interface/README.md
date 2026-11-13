# indexation / interface

Interface contracts: data shapes exchanged between classes and written as JSON.

## contract

| entity               | family                                                         | description                                                                            |
| -------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `AssetInfo`          | [asset-info](contract/asset-info/index.ts)                     | Read result of an svg, frag or vert file.                                              |
| `BushEdge`           | [bush-edge](contract/bush-edge/index.ts)                       | Resolved import or re-export edge of the dependency bushes.                            |
| `BushGraphNode`      | [bush-graph-node](contract/bush-graph-node/index.ts)           | File of the dependency bush graph with its edges.                                      |
| `BushNode`           | [bush-node](contract/bush-node/index.ts)                       | Node of a component dependency bush.                                                   |
| `BushStats`          | [bush-stats](contract/bush-stats/index.ts)                     | File count, depth and categories of a bush.                                            |
| `CliArgs`            | [cli-args](contract/cli-args/index.ts)                         | Parsed index generation command line.                                                  |
| `ComponentTree`      | [component-tree](contract/component-tree/index.ts)             | Directory tree of a source root, with module checkouts projected onto logical domains. |
| `DependencyBushes`   | [dependency-bushes](contract/dependency-bushes/index.ts)       | Dependency bushes of all component entries.                                            |
| `DependencySummary`  | [dependency-summary](contract/dependency-summary/index.ts)     | Dependency bushes without the bush trees, sorted by depth.                             |
| `EnrichedNode`       | [enriched-node](contract/enriched-node/index.ts)               | Node of the enriched tree as the index writer reads it.                                |
| `ExportEntry`        | [export-entry](contract/export-entry/index.ts)                 | Exported name, its module or assignment.                                               |
| `FileMap`            | [file-map](contract/file-map/index.ts)                         | Raw content by normalized file path.                                                   |
| `GenerationConfig`   | [generation-config](contract/generation-config/index.ts)       | Root domain and cluster filters of one generation mode.                                |
| `IndexationConfig`   | [indexation-config](contract/indexation-config/index.ts)       | Settings of an index generation run (`stylist-indexation.config.json`).                |
| `IndexationMode`     | [indexation-mode](contract/indexation-mode/index.ts)           | Root domain and cluster filters of one generation mode.                                |
| `IndexationProject`  | [indexation-project](contract/indexation-project/index.ts)     | Source project indexed by one run.                                                     |
| `ImportEntry`        | [import-entry](contract/import-entry/index.ts)                 | Imported name and its module.                                                          |
| `ModuleEdge`         | [module-edge](contract/module-edge/index.ts)                   | Static import or re-export of a module.                                                |
| `ModuleRegistry`     | [module-registry](contract/module-registry/index.ts)           | Entries of modules.json by module name.                                                |
| `ModuleSource`       | [module-source](contract/module-source/index.ts)               | One modules.json entry.                                                                |
| `ParsedExports`      | [parsed-exports](contract/parsed-exports/index.ts)             | Top-level exports of a TS file by bucket.                                              |
| `ParsedImports`      | [parsed-imports](contract/parsed-imports/index.ts)             | Top-level imports of a TS file, type-only and value.                                   |
| `StoryFileEntry`     | [story-file-entry](contract/story-file-entry/index.ts)         | Analysis entry of a story file.                                                        |
| `StoryInfo`          | [story-info](contract/story-info/index.ts)                     | Read result of a story file.                                                           |
| `SvelteDefault`      | [svelte-default](contract/svelte-default/index.ts)             | Default component export of a Svelte file.                                             |
| `SvelteFileEntry`    | [svelte-file-entry](contract/svelte-file-entry/index.ts)       | Analysis entry of a Svelte file.                                                       |
| `SvelteInfo`         | [svelte-info](contract/svelte-info/index.ts)                   | Read result of a Svelte file with its component name.                                  |
| `TransitEntry`       | [transit-entry](contract/transit-entry/index.ts)               | `export * from` module.                                                                |
| `TreeNodeBush`       | [tree-node-bush](contract/tree-node-bush/index.ts)             | Enriched tree node as read by the component dependency bushes.                         |
| `TreeNodeRoot`       | [tree-node-root](contract/tree-node-root/index.ts)             | Library root node that may carry module.json metadata flags.                           |
| `TreeNodeStructure`  | [tree-node-structure](contract/tree-node-structure/index.ts)   | Enriched tree node as read by the index.ts structure builder.                          |
| `TsCompareStructure` | [ts-compare-structure](contract/ts-compare-structure/index.ts) | Exports and imports compared between the current and the expected barrel.              |
| `TsFileEntry`        | [ts-file-entry](contract/ts-file-entry/index.ts)               | Analysis entry of a TS file: what was read, the expected barrel and their comparison.  |
| `TsInfo`             | [ts-info](contract/ts-info/index.ts)                           | Read result of a TS file with parsed exports and imports.                              |
| `TsMerge`            | [ts-merge](contract/ts-merge/index.ts)                         | Differences between the current and the expected barrel.                               |
| `TsParser`           | [ts-parser](contract/ts-parser/index.ts)                       | Strategy for reading top-level exports and imports of TS code.                         |
| `TsStructure`        | [ts-structure](contract/ts-structure/index.ts)                 | Exports and imports from which barrel text is generated.                               |
| `TsStructureExports` | [ts-structure-exports](contract/ts-structure-exports/index.ts) | Barrel exports by bucket.                                                              |
| `TsStructureImports` | [ts-structure-imports](contract/ts-structure-imports/index.ts) | Barrel imports by bucket.                                                              |
| `TsStructureResult`  | [ts-structure-result](contract/ts-structure-result/index.ts)   | Expected barrel of a node: generated text and its exports.                             |
