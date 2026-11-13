import * as fs from 'node:fs';
import * as path from 'node:path';
import type { AssetInfo } from '../../../interface/contract/asset-info/index.ts';
import type { GenerationConfig } from '../../../interface/contract/generation-config/index.ts';
import type { ParsedExports } from '../../../interface/contract/parsed-exports/index.ts';
import type { ParsedImports } from '../../../interface/contract/parsed-imports/index.ts';
import type { StoryFileEntry } from '../../../interface/contract/story-file-entry/index.ts';
import type { StoryInfo } from '../../../interface/contract/story-info/index.ts';
import type { SvelteFileEntry } from '../../../interface/contract/svelte-file-entry/index.ts';
import type { SvelteInfo } from '../../../interface/contract/svelte-info/index.ts';
import type { TreeNodeStructure } from '../../../interface/contract/tree-node-structure/index.ts';
import type { TsCompareStructure } from '../../../interface/contract/ts-compare-structure/index.ts';
import type { TsFileEntry } from '../../../interface/contract/ts-file-entry/index.ts';
import type { TsInfo } from '../../../interface/contract/ts-info/index.ts';
import type { TsMerge } from '../../../interface/contract/ts-merge/index.ts';
import type { TsParser } from '../../../interface/contract/ts-parser/index.ts';
import { SourceText } from '../../../class/adapter/source-text/index.ts';
import { IndexStructureBuilder } from '../../../class/builder/index-structure/index.ts';
import { IndexationSettings } from '../../../class/registry/indexation-settings/index.ts';
import { TsAstParser } from '../../../class/strategy/ts-ast-parser/index.ts';

/** Analysis entries of the files of a tree node, by file kind. */
export class FileEntryFactory {
  private static readonly tsParser: TsParser = new TsAstParser();

  static processFragFile(filePath: string): AssetInfo {
    return FileEntryFactory.readAsset(
      filePath,
      'Fragment shader file not found',
    );
  }

  static processSvgFile(filePath: string): AssetInfo {
    return FileEntryFactory.readAsset(filePath, 'SVG file not found');
  }

  static processVertFile(filePath: string): AssetInfo {
    return FileEntryFactory.readAsset(filePath, 'Vertex shader file not found');
  }

  static processStoryFile(filePath: string): StoryFileEntry {
    const basicInfo = FileEntryFactory.getStoryInfo(filePath);
    return { read: basicInfo };
  }

  static processSvelteFile(
    filePath: string,
    _runDetailedStatistics?: boolean,
  ): SvelteFileEntry {
    const basicInfo = FileEntryFactory.getSvelteInfo(filePath);
    return { read: basicInfo };
  }

  static processTsFile(
    filePath: string,
    treeNode?: Record<string, unknown>,
    generationConfig?: GenerationConfig,
  ): TsFileEntry {
    let readData: Partial<TsInfo>;

    try {
      const raw = FileEntryFactory.getTsInfo(filePath);
      readData = FileEntryFactory.removeEmptyArrays(raw);
    } catch (e) {
      if (
        (e as NodeJS.ErrnoException).code === 'ENOENT' ||
        (e as Error).message?.includes('does not exist')
      ) {
        readData = {
          file: 'index.ts',
          file_path: filePath,
          raw_content: '',
          rows_count: 0,
        };
      } else {
        throw e;
      }
    }

    const fileName = path.basename(filePath);
    const isIndexFile = fileName === 'index.ts';

    if (!isIndexFile || !treeNode) {
      return { read: readData };
    }

    const buildData = IndexStructureBuilder.buildTsStructureFromNode(
      treeNode as TreeNodeStructure,
      generationConfig,
    );
    const mergeData = FileEntryFactory.compareTsStructures(
      readData as TsCompareStructure,
      buildData as TsCompareStructure,
    );

    if (!mergeData.is_match) {
      mergeData.action = 'update_required';
      mergeData.reason =
        'Exports mismatch between current file and expected structure';
    } else {
      mergeData.action = 'no_update_needed';
      mergeData.reason = 'File matches expected structure';
    }

    return { read: readData, build: buildData, merge: mergeData };
  }

  static getStoryInfo(filePath: string): StoryInfo {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Story file does not exist: ${filePath}`);
    }

    const content = SourceText.readText(filePath);

    return {
      file: path.basename(filePath),
      file_path: filePath,
      raw_content: content,
      line_count: SourceText.splitLines(content).length,
    };
  }

  static getSvelteInfo(filePath: string): SvelteInfo {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Svelte file does not exist: ${filePath}`);
    }

    const content = SourceText.readText(filePath);
    const fileName = path.basename(filePath);
    const fileDir = path.dirname(filePath);
    const dirName = path.basename(fileDir);

    let componentName: string;
    let exportPath: string;

    if (fileName === 'index.svelte') {
      componentName = FileEntryFactory.normalizeComponentName(dirName);
      exportPath = './index.svelte';
    } else {
      const nameWithoutExt = path.basename(fileName, '.svelte');
      componentName = FileEntryFactory.normalizeComponentName(nameWithoutExt);
      exportPath = `./${nameWithoutExt}.svelte`;
    }

    // <domain>/component/<level>/<family>/<file>: configured domain names.
    const parts = filePath.replace(/\\/g, '/').split('/');
    if (parts.length >= 5 && parts[parts.length - 4] === 'component') {
      const domain = parts[parts.length - 5];
      const { componentPrefixes, componentNames } = IndexationSettings.config;
      const exact = componentNames[`${domain}/${dirName}`];
      if (exact) componentName = exact;
      else if (componentPrefixes[domain])
        componentName = componentPrefixes[domain] + componentName;
    }
    return {
      file: fileName,
      file_path: filePath,
      raw_content: content,
      line_count: SourceText.splitLines(content).length,
      default: {
        name: componentName,
        from: exportPath,
      },
    };
  }

  static getTsInfo(filePath: string): TsInfo {
    if (!fs.existsSync(filePath)) {
      throw new Error(`TS file does not exist: ${filePath}`);
    }

    const content = SourceText.readText(filePath);
    const importsData = FileEntryFactory.tsParser.parseImports(
      content,
      filePath,
    );
    const exportsData = FileEntryFactory.tsParser.parseExports(
      content,
      filePath,
    );

    return {
      file: path.basename(filePath),
      file_path: filePath,
      raw_content: content,
      rows_count: SourceText.splitLines(content).length,
      exports: exportsData,
      imports: importsData,
    };
  }

  static compareTsStructures(
    read: TsCompareStructure,
    expected: TsCompareStructure,
  ): TsMerge {
    const difference = FileEntryFactory.nameDifference;
    const missing = difference(
      expected.exports?.default ?? [],
      read.exports?.default ?? [],
    );
    const extra = difference(
      read.exports?.default ?? [],
      expected.exports?.default ?? [],
    );
    const missingType = difference(
      expected.exports?.type ?? [],
      read.exports?.type ?? [],
    );
    const missingInterface = difference(
      expected.exports?.interface ?? [],
      read.exports?.interface ?? [],
    );
    return {
      is_match:
        !missing.length &&
        !extra.length &&
        !missingType.length &&
        !missingInterface.length,
      missing_exports: missing,
      extra_exports: extra,
      missing_type_exports: missingType,
      extra_type_exports: difference(
        read.exports?.type ?? [],
        expected.exports?.type ?? [],
      ),
      missing_interface_exports: missingInterface,
      extra_interface_exports: difference(
        read.exports?.interface ?? [],
        expected.exports?.interface ?? [],
      ),
      extra_type_imports: difference(
        read.imports?.type ?? [],
        expected.imports?.type ?? [],
      ),
      extra_data_imports: difference(
        read.imports?.data ?? [],
        expected.imports?.data ?? [],
      ),
    };
  }

  private static readAsset(
    filePath: string,
    missingMessage: string,
  ): AssetInfo {
    const fileName = path.basename(filePath);

    if (!fs.existsSync(filePath)) {
      throw new Error(`${missingMessage}: ${filePath}`);
    }

    const stat = fs.statSync(filePath);
    if (!stat.isFile()) {
      throw new Error(`Path is not a file: ${filePath}`);
    }

    const rawContent = SourceText.readText(filePath);

    return {
      file: fileName,
      file_path: filePath,
      rows_count: SourceText.splitLines(rawContent).length,
      size_bytes: stat.size,
      raw_content: rawContent,
    };
  }

  private static normalizeComponentName(name: string): string {
    if (name.includes('-')) {
      return name
        .split('-')
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
        .join('');
    }
    if (!name) return name;
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  private static removeEmptyArrays(data: TsInfo): Partial<TsInfo> {
    const result: Partial<TsInfo> = {};

    for (const [k, v] of Object.entries(data)) {
      if (k !== 'exports' && k !== 'imports') {
        (result as Record<string, unknown>)[k] = v;
      }
    }

    if (data.exports) {
      const exports: Partial<ParsedExports> = {};
      for (const [key, value] of Object.entries(data.exports)) {
        if (Array.isArray(value) && value.length > 0) {
          (exports as Record<string, unknown>)[key] = value;
        }
      }
      if (Object.keys(exports).length > 0)
        result.exports = exports as ParsedExports;
    }

    if (data.imports) {
      const imports: Partial<ParsedImports> = {};
      for (const [key, value] of Object.entries(data.imports)) {
        if (Array.isArray(value) && value.length > 0) {
          (imports as Record<string, unknown>)[key] = value;
        }
      }
      if (Object.keys(imports).length > 0)
        result.imports = imports as ParsedImports;
    }

    return result;
  }

  private static nameDifference<T extends { name?: string }>(
    left: T[],
    right: T[],
  ): T[] {
    const names = new Set(
      right.filter((entry) => entry.name).map((entry) => entry.name),
    );
    return left.filter((entry) => !names.has(entry.name));
  }
}
