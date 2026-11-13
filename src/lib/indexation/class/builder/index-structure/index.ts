import * as path from 'node:path';
import { NON_EXPORTED_TS_SUFFIXES } from '../../../const/array/non-exported-ts-suffixes/index.ts';
import type { ExportEntry } from '../../../interface/contract/export-entry/index.ts';
import type { GenerationConfig } from '../../../interface/contract/generation-config/index.ts';
import type { TransitEntry } from '../../../interface/contract/transit-entry/index.ts';
import type { TreeNodeStructure } from '../../../interface/contract/tree-node-structure/index.ts';
import type { TsStructure } from '../../../interface/contract/ts-structure/index.ts';
import type { TsStructureResult } from '../../../interface/contract/ts-structure-result/index.ts';
import { SourceText } from '../../../class/adapter/source-text/index.ts';
import { GenerationModeRegistry } from '../../../class/registry/generation-mode/index.ts';
import { IndexationSettings } from '../../../class/registry/indexation-settings/index.ts';

/** Expected index.ts structure and generated text of a tree node. */
export class IndexStructureBuilder {
  static buildTsStructureFromNode(
    node: TreeNodeStructure,
    generationConfig?: GenerationConfig,
  ): TsStructureResult {
    const compareText = SourceText.compareText;
    const childExportFrom = IndexStructureBuilder.childExportFrom;
    const isDevTs = IndexStructureBuilder.isDevTs;
    const nodePath = node.path ?? '';
    const nodeName = node.name ?? '';
    const children = node.children ?? [];
    const svelteAnalysis = node.svelte ?? [];

    const svgRawContent = IndexStructureBuilder.buildSvgIndexRawContent(node);

    const exportsDefault: ExportEntry[] = [];
    const exportsType: ExportEntry[] = [];
    const exportsTransit: TransitEntry[] = [];
    const exportsInterface: ExportEntry[] = [];
    const importsType: unknown[] = [];
    const importsData: unknown[] = [];

    // Case 1: Leaf node with svelte files (no children)
    if (svelteAnalysis.length > 0 && children.length === 0) {
      for (const svelteItem of svelteAnalysis) {
        const defaultExport = svelteItem.read?.default;
        if (defaultExport?.name) {
          exportsDefault.push({
            name: defaultExport.name,
            from: defaultExport.from,
          });
        }
      }
      exportsDefault.sort((a, b) => compareText(a.name ?? '', b.name ?? ''));
    }
    // Case 2: Directory node with children
    else if (children.length > 0) {
      if (svelteAnalysis.length > 0) {
        for (const svelteItem of svelteAnalysis) {
          const defaultExport = svelteItem.read?.default;
          if (defaultExport?.name) {
            exportsDefault.push({
              name: defaultExport.name,
              from: defaultExport.from,
            });
          }
        }
      }

      const childExports: Array<{
        name: string;
        from: string;
        child_name: string;
      }> = [];

      for (const child of children) {
        const childName = child.name ?? '';

        if (IndexationSettings.isSkippedFolder(nodePath, childName)) continue;
        if (
          GenerationModeRegistry.shouldSkipRootChildExport(
            node.architecture_path ?? nodePath,
            childName,
            generationConfig,
          )
        )
          continue;
        if (
          GenerationModeRegistry.shouldSkipDomainClusterExport(
            node.architecture_path ?? nodePath,
            childName,
            generationConfig,
          )
        )
          continue;

        const childSvelte = child.svelte ?? [];
        const childTs = (child.ts ?? []).filter(
          (entry) => !isDevTs(entry.read?.file ?? ''),
        );

        if (childSvelte.length > 0) {
          for (const svelteItem of childSvelte) {
            const defaultExport = svelteItem.read?.default;
            if (defaultExport?.name) {
              childExports.push({
                name: defaultExport.name,
                from: childExportFrom(child, childName),
                child_name: childName,
              });
            }
          }
        } else if (childTs.length > 0) {
          const indexEntry =
            childTs.find((ts) => ts.read?.file === 'index.ts') ?? childTs[0];
          const buildData = indexEntry?.build ?? {};
          // Build exports without any entry fall back to the exports the
          // child's own index.ts declares (a hand-written entry module).
          const rawBuildExports = buildData.exports as
            Record<string, ExportEntry[]> | undefined;
          const rawReadExports = indexEntry?.read?.exports as
            Record<string, ExportEntry[]> | undefined;
          const childExportsData =
            rawBuildExports &&
            Object.values(rawBuildExports).some(
              (entries) => Array.isArray(entries) && entries.length > 0,
            )
              ? rawBuildExports
              : (rawReadExports ?? {});

          const childDefaultExports: ExportEntry[] =
            childExportsData['default'] ?? [];
          const childTypeExports: ExportEntry[] =
            childExportsData['type'] ?? [];
          const childInterfaceExports: ExportEntry[] =
            childExportsData['interface'] ?? [];

          const childIndexWasAnalyzed =
            Object.keys(buildData).length > 0 ||
            Object.keys(childExportsData).length > 0 ||
            Object.keys(indexEntry?.read?.exports ?? {}).length > 0;

          let hasExports = false;

          if (childDefaultExports.length > 0) {
            hasExports = true;
            for (const exp of childDefaultExports) {
              if (exp.name) {
                childExports.push({
                  name: exp.name,
                  from: childExportFrom(child, childName),
                  child_name: childName,
                });
              }
            }
          }

          if (childTypeExports.length > 0) {
            hasExports = true;
            for (const exp of childTypeExports) {
              if (exp.name) {
                exportsType.push({
                  name: exp.name,
                  from: childExportFrom(child, childName),
                });
              }
            }
          }

          if (childInterfaceExports.length > 0) {
            hasExports = true;
            for (const exp of childInterfaceExports) {
              if (exp.name) {
                exportsInterface.push({
                  name: exp.name,
                  from: childExportFrom(child, childName),
                });
              }
            }
          }

          if (!hasExports) {
            if (childIndexWasAnalyzed) continue;

            const childChildren = child.children ?? [];
            if (childChildren.length > 0) {
              const recursiveExports =
                IndexStructureBuilder.collectExportsFromChildren(
                  childChildren,
                  childName,
                );
              if (recursiveExports.length > 0) {
                hasExports = true;
                for (const exp of recursiveExports) {
                  childExports.push({
                    name: exp.name,
                    from: exp.from,
                    child_name: childName,
                  });
                }
              }
            }
          }

          if (!hasExports) {
            if (childIndexWasAnalyzed) continue;
            exportsTransit.push({ from: childExportFrom(child, childName) });
          }
        } else if ((child.children ?? []).length > 0) {
          if (IndexationSettings.isSkippedFolder(nodePath, childName)) continue;
          const childChildren = child.children ?? [];
          const recursiveExports =
            IndexStructureBuilder.collectExportsFromChildren(
              childChildren,
              childName,
            );
          if (recursiveExports.length > 0) {
            for (const exp of recursiveExports) {
              childExports.push({
                name: exp.name,
                from: `./${childName}`,
                child_name: childName,
              });
            }
          }
        }
      }

      childExports.sort((a, b) => compareText(a.name, b.name));
      const seenChildExportNames = new Set<string>();

      for (const exp of childExports) {
        if (seenChildExportNames.has(exp.name)) continue;
        seenChildExportNames.add(exp.name);
        exportsDefault.push({ name: exp.name, from: exp.from });
      }

      // Deduplicate type exports
      const seenTypeNames = new Set<string>();
      const dedupedTypeExports: ExportEntry[] = [];
      for (const exp of exportsType) {
        if (!exp.name || seenTypeNames.has(exp.name)) continue;
        seenTypeNames.add(exp.name);
        dedupedTypeExports.push(exp);
      }
      exportsType.splice(0, exportsType.length, ...dedupedTypeExports);

      // Deduplicate interface exports
      const seenInterfaceNames = new Set<string>();
      const dedupedInterfaceExports: ExportEntry[] = [];
      for (const exp of exportsInterface) {
        if (!exp.name || seenInterfaceNames.has(exp.name)) continue;
        seenInterfaceNames.add(exp.name);
        dedupedInterfaceExports.push(exp);
      }
      exportsInterface.splice(
        0,
        exportsInterface.length,
        ...dedupedInterfaceExports,
      );
    }
    // Case 3: Directory with sibling .ts files (tokens/index.ts, etc.)
    else {
      const files = node.files ?? [];
      const tsFiles = files.filter(
        (f) => f.endsWith('.ts') && f !== 'index.ts' && !isDevTs(f),
      );

      if (tsFiles.length > 0) {
        const nodeTsData = node.ts ?? [];

        for (const tsFileName of [...tsFiles].sort(compareText)) {
          const tsData = nodeTsData.find((ts) => ts.read?.file === tsFileName);
          if (!tsData) continue;

          const readData = tsData.read ?? {};
          const fileExports =
            (readData.exports as Record<string, ExportEntry[]> | undefined) ??
            {};
          const fileNameWithoutExt = tsFileName.replace('.ts', '');
          const sourceKind = tsFileName.endsWith('.svelte.ts') ? 'ts' : '';

          for (const exp of fileExports['default'] ?? []) {
            if (exp.name) {
              const exportData: ExportEntry = {
                name: exp.name,
                from: `./${fileNameWithoutExt}`,
              };
              if (sourceKind && exp.from !== 'default')
                exportData.source_kind = sourceKind;
              exportsDefault.push(exportData);
            }
          }

          for (const exp of fileExports['type'] ?? []) {
            if (exp.name)
              exportsType.push({
                name: exp.name,
                from: `./${fileNameWithoutExt}`,
              });
          }

          for (const exp of fileExports['interface'] ?? []) {
            if (exp.name)
              exportsInterface.push({
                name: exp.name,
                from: `./${fileNameWithoutExt}`,
              });
          }
        }
      }
    }

    if (svgRawContent) {
      const constExports: ExportEntry[] = [];
      const typeExportsList: ExportEntry[] = [];

      for (const line of svgRawContent.split('\n')) {
        const constMatch = /^export const ([A-Z0-9_]+)\s*=/.exec(line);
        if (constMatch) {
          constExports.push({
            name: constMatch[1],
            assign: line
              .slice(line.indexOf('=') + 1)
              .trim()
              .replace(/;+$/, ''),
          });
        }
        const typeMatch = /^export type ([A-Za-z0-9_]+)\s*=/.exec(line);
        if (typeMatch) {
          typeExportsList.push({
            name: typeMatch[1],
            assign: line
              .slice(line.indexOf('=') + 1)
              .trim()
              .replace(/;+$/, ''),
          });
        }
      }

      const result: TsStructureResult = {
        file: 'index.ts',
        file_path: nodePath ? path.join(nodePath, 'index.ts') : 'index.ts',
        raw_content: svgRawContent,
        rows_count: svgRawContent.split('\n').length,
        exports: {},
        imports: {},
      };
      if (constExports.length > 0) result.exports['default'] = constExports;
      if (typeExportsList.length > 0) result.exports['type'] = typeExportsList;
      return result;
    }

    const tempStructure = {
      exports: {
        default: exportsDefault,
        type: exportsType,
        transit: exportsTransit,
        interface: exportsInterface,
      },
      imports: { type: [], data: [] },
    };

    const rawContent = IndexStructureBuilder.generateTsContentFromStructure(
      tempStructure,
      nodeName,
    );
    const rowsCount = rawContent ? rawContent.split('\n').length : 0;
    const tsFilePath = nodePath ? path.join(nodePath, 'index.ts') : 'index.ts';

    const result: TsStructureResult = {
      file: 'index.ts',
      file_path: tsFilePath,
      raw_content: rawContent,
      rows_count: rowsCount,
      exports: {},
      imports: {},
    };

    if (exportsDefault.length > 0) result.exports['default'] = exportsDefault;
    if (exportsType.length > 0) result.exports['type'] = exportsType;
    if (exportsTransit.length > 0) result.exports['transit'] = exportsTransit;
    if (exportsInterface.length > 0)
      result.exports['interface'] = exportsInterface;
    if (importsType.length > 0) result.imports['type'] = importsType;
    if (importsData.length > 0) result.imports['data'] = importsData;

    return result;
  }

  static generateTsContentFromStructure(
    structure: TsStructure,
    _componentName: string = '',
  ): string {
    const compareText = SourceText.compareText;
    const formatNames = IndexStructureBuilder.formatNames;
    const exports = structure.exports ?? {};
    const imports = structure.imports ?? {};

    const hasExports = !!(
      exports.default?.length ||
      exports.transit?.length ||
      exports.type?.length ||
      exports.interface?.length
    );
    const hasImports = !!(imports.type?.length || imports.data?.length);

    if (!hasExports && !hasImports) {
      return '';
    }

    const lines: string[] = [];
    lines.push(IndexationSettings.marker('AUTO-GENERATED'));

    const typeImports = imports.type ?? [];
    const dataImports = imports.data ?? [];

    for (const imp of typeImports) {
      lines.push(`import type { ${imp.name} } from '${imp.from}';`);
    }
    for (const imp of dataImports) {
      lines.push(`import { ${imp.name} } from '${imp.from}';`);
    }
    if (typeImports.length > 0 || dataImports.length > 0) {
      lines.push('');
    }

    const defaultExports = exports.default ?? [];
    const transitExports = exports.transit ?? [];
    const typeExports = exports.type ?? [];
    const interfaceExports = exports.interface ?? [];

    // Group default/value exports by source path
    const exportsByPath = new Map<string, Set<string>>();
    const valueExportNames = new Set<string>();
    const sourceKindByPath = new Map<string, string>();

    for (const exp of defaultExports) {
      if (exp.name) valueExportNames.add(exp.name);
      const key = exp.from ?? '';
      if (!exportsByPath.has(key)) exportsByPath.set(key, new Set());
      if (exp.name) exportsByPath.get(key)!.add(exp.name);
      if (exp.from && exp.source_kind) {
        sourceKindByPath.set(exp.from, exp.source_kind);
      }
    }

    for (const [fromPath, nameSet] of [...exportsByPath.entries()].sort(
      ([a], [b]) => compareText(a, b),
    )) {
      const names = [...nameSet].sort(compareText);
      if (
        names.length === 1 &&
        fromPath.endsWith('.svelte') &&
        sourceKindByPath.get(fromPath) !== 'ts'
      ) {
        lines.push(`export { default as ${names[0]} } from '${fromPath}';`);
      } else if (names.length > 0 && fromPath) {
        lines.push(`export ${formatNames(names)} from '${fromPath}';`);
      } else if (names.length === 1) {
        lines.push(`export { default as ${names[0]} } from '${fromPath}';`);
      }
    }

    // Transit exports
    for (const exp of transitExports) {
      lines.push(`export * from '${exp.from}';`);
    }

    // Type exports - group by source path
    const typeExportsByPath = new Map<string, Set<string>>();
    const localTypeExports: Array<[string, string]> = [];
    const exportedTypeNames = new Set<string>();

    for (const exp of typeExports) {
      if (exp.name && valueExportNames.has(exp.name)) continue;

      if (exp.assign) {
        if (exp.name) localTypeExports.push([exp.name, exp.assign]);
      } else if (exp.from) {
        if (!typeExportsByPath.has(exp.from))
          typeExportsByPath.set(exp.from, new Set());
        if (exp.name) typeExportsByPath.get(exp.from)!.add(exp.name);
      } else if (exp.name) {
        localTypeExports.push([exp.name, 'any;  // TODO: Define type']);
      }
    }

    for (const [fromPath, nameSet] of [...typeExportsByPath.entries()].sort(
      ([a], [b]) => compareText(a, b),
    )) {
      const names = [...nameSet].sort(compareText);
      names.forEach((n) => exportedTypeNames.add(n));
      lines.push(`export type ${formatNames(names)} from '${fromPath}';`);
    }

    for (const [name, assign] of localTypeExports) {
      exportedTypeNames.add(name);
      lines.push(`export type ${name} = ${assign};`);
    }

    // Interface exports - group by source path
    const interfaceExportsByPath = new Map<string, Set<string>>();
    const localInterfaceExports: Array<[string, string]> = [];

    for (const exp of interfaceExports) {
      if (
        exp.name &&
        (valueExportNames.has(exp.name) || exportedTypeNames.has(exp.name))
      )
        continue;

      if (exp.assign) {
        if (exp.name) localInterfaceExports.push([exp.name, exp.assign]);
      } else if (exp.from) {
        if (!interfaceExportsByPath.has(exp.from))
          interfaceExportsByPath.set(exp.from, new Set());
        if (exp.name) interfaceExportsByPath.get(exp.from)!.add(exp.name);
      } else if (exp.name) {
        localInterfaceExports.push([
          exp.name,
          '{  // TODO: Define interface\n}',
        ]);
      }
    }

    for (const [fromPath, nameSet] of [
      ...interfaceExportsByPath.entries(),
    ].sort(([a], [b]) => compareText(a, b))) {
      const names = [...nameSet].sort(compareText);
      lines.push(`export type ${formatNames(names)} from '${fromPath}';`);
    }

    for (const [name, assign] of localInterfaceExports) {
      lines.push(`export interface ${name} ${assign}`);
    }

    return lines.join('\n').trimEnd();
  }

  private static isDevTs(name: string): boolean {
    return NON_EXPORTED_TS_SUFFIXES.some((suffix) => name.endsWith(suffix));
  }

  private static hasIndexSvelte(node: TreeNodeStructure): boolean {
    for (const svelteItem of node.svelte ?? []) {
      if (svelteItem.read?.file === 'index.svelte') return true;
    }
    return false;
  }

  private static isComponentLeafNode(node: TreeNodeStructure): boolean {
    const normalizedPath = (node.architecture_path ?? node.path ?? '').replace(
      /\\/g,
      '/',
    );
    if (!normalizedPath.includes('/component/')) return false;
    return IndexStructureBuilder.hasIndexSvelte(node);
  }

  private static childExportFrom(
    child: TreeNodeStructure,
    childName: string,
  ): string {
    if (child.export_from) return child.export_from;
    if (IndexStructureBuilder.isComponentLeafNode(child))
      return `./${childName}/index`;
    return `./${childName}`;
  }

  private static collectExportsFromChildren(
    children: TreeNodeStructure[],
    _parentName: string,
  ): Array<{ name: string; from: string }> {
    const exports: Array<{ name: string; from: string }> = [];

    for (const child of children) {
      const childNodeName = child.name ?? '';
      if (
        IndexationSettings.isSkippedFolder(
          path.dirname(child.path ?? ''),
          childNodeName,
        )
      )
        continue;

      const childSvelte = child.svelte ?? [];
      const childTs = (child.ts ?? []).filter(
        (entry) => !IndexStructureBuilder.isDevTs(entry.read?.file ?? ''),
      );
      const childChildren = child.children ?? [];

      if (childTs.length > 0) {
        const indexEntry =
          childTs.find((ts) => ts.read?.file === 'index.ts') ?? childTs[0];
        if (indexEntry) {
          const buildData = indexEntry.build ?? {};
          const readExports = indexEntry.read?.exports ?? {};
          const wasAnalyzed =
            Object.keys(buildData).length > 0 ||
            Object.keys(readExports).length > 0;
          if (wasAnalyzed) continue;
        }
      }

      if (childSvelte.length > 0) {
        for (const svelteItem of childSvelte) {
          const defaultExport = svelteItem.read?.default;
          if (defaultExport?.name) {
            exports.push({
              name: defaultExport.name,
              from: IndexStructureBuilder.childExportFrom(child, childNodeName),
            });
          }
        }
      } else if (childTs.length > 0) {
        const indexEntry =
          childTs.find((ts) => ts.read?.file === 'index.ts') ?? childTs[0];
        if (indexEntry) {
          const buildData = indexEntry.build ?? {};
          // An empty build exports object falls back to the read exports.
          // JS: `{} ?? fallback` keeps {} since it's not null/undefined — must check explicitly
          const rawBuildExports = buildData.exports as
            Record<string, ExportEntry[]> | undefined;
          const rawReadExports = indexEntry.read?.exports as
            Record<string, ExportEntry[]> | undefined;
          const childExportsData =
            rawBuildExports && Object.keys(rawBuildExports).length > 0
              ? rawBuildExports
              : (rawReadExports ?? {});
          const childDefaultExports = childExportsData['default'] ?? [];

          if (childDefaultExports.length > 0) {
            for (const exp of childDefaultExports) {
              if (exp.name)
                exports.push({
                  name: exp.name,
                  from: IndexStructureBuilder.childExportFrom(
                    child,
                    childNodeName,
                  ),
                });
            }
          } else if (childChildren.length > 0) {
            const subExports = IndexStructureBuilder.collectExportsFromChildren(
              childChildren,
              childNodeName,
            );
            exports.push(...subExports);
          }
        }
      } else if (childChildren.length > 0) {
        const subExports = IndexStructureBuilder.collectExportsFromChildren(
          childChildren,
          childNodeName,
        );
        exports.push(...subExports);
      }
    }

    return exports;
  }

  private static toSvgConstName(folderName: string): string {
    const normalized = folderName
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .toUpperCase()
      .replace(/^_|_$/g, '');
    const base = normalized === 'ICONS' ? 'ICON' : normalized;
    return base ? `${base}_SVG_GLOB` : 'SVG_GLOB';
  }

  private static toSvgEnumName(folderName: string): string {
    const normalized = folderName
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .toUpperCase()
      .replace(/^_|_$/g, '');
    const base = normalized === 'ICONS' ? 'ICON' : normalized;
    return base ? `${base}_SVG_NAME` : 'SVG_NAME';
  }

  private static buildSvgIndexRawContent(node: TreeNodeStructure): string {
    const compareText = SourceText.compareText;
    const nodePath = (node.architecture_path ?? node.path ?? '').replace(
      /\\/g,
      '/',
    );
    const suffix = IndexationSettings.sourceSuffix();
    const svgDomain = IndexationSettings.config.svgDomains.find((domain) =>
      nodePath.endsWith(`${suffix}/${domain}`),
    );
    if (!svgDomain) return '';

    const constants: Array<[string, string]> = [];
    const literalSets: Array<[string, string, string[]]> = [];

    const sortedChildren = [...(node.children ?? [])].sort((a, b) =>
      compareText(a.name ?? '', b.name ?? ''),
    );

    for (const child of sortedChildren) {
      const childName = child.name ?? '';
      if (!childName) continue;

      const childSvg = child.svg ?? [];
      const childFiles = child.files ?? [];
      const hasSvg =
        childSvg.length > 0 || childFiles.some((f) => f.endsWith('.svg'));
      if (!hasSvg) continue;

      const constName = IndexStructureBuilder.toSvgConstName(childName);
      const physicalPath = (node.path ?? '').replace(/\\/g, '/');
      const webRoot = physicalPath.includes('/modules/')
        ? '/modules/' +
          physicalPath.split('/modules/').slice(1).join('/modules/')
        : `${suffix}/${svgDomain}`;
      constants.push([constName, `${webRoot}/${childName}/*.svg`]);

      const svgNames: string[] = [];
      if (child.svg && child.svg.length > 0) {
        for (const svgItem of child.svg) {
          const fileName = svgItem.file ?? '';
          if (fileName.endsWith('.svg')) svgNames.push(fileName.slice(0, -4));
        }
      } else {
        for (const fileName of childFiles) {
          if (fileName.endsWith('.svg')) svgNames.push(fileName.slice(0, -4));
        }
      }

      if (svgNames.length > 0) {
        const enumName = IndexStructureBuilder.toSvgEnumName(childName);
        const constNamesName = `${enumName}S`;
        const typeName =
          enumName.charAt(0) +
          enumName.slice(1).toLowerCase().replace('_svg_name', 'SvgName');
        const values = [...new Set(svgNames)].sort(compareText);
        literalSets.push([constNamesName, typeName, values]);
      }
    }

    if (constants.length === 0) return '';

    const lines = [IndexationSettings.marker('AUTO-GENERATED')];
    for (const [constName, glob] of constants) {
      lines.push(`export const ${constName} = '${glob}';`);
    }
    for (const [constNamesName, typeName, values] of literalSets) {
      lines.push('');
      lines.push(`export const ${constNamesName} = [`);
      for (const value of values) {
        lines.push(`  '${value}',`);
      }
      lines.push('] as const;');
      lines.push(
        `export type ${typeName} = (typeof ${constNamesName})[number];`,
      );
    }

    return lines.join('\n').trimEnd();
  }

  private static formatNames(names: string[]): string {
    if (names.length === 1) return `{ ${names[0]} }`;
    return (
      '{\n' +
      names
        .map((name, index) => `\t${name}${index < names.length - 1 ? ',' : ''}`)
        .join('\n') +
      '\n}'
    );
  }
}
