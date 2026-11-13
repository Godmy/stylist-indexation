import * as path from 'node:path';
import type { AnyRecord } from '../../../type/record/any-record/index.ts';
import type { GenerationConfig } from '../../../interface/contract/generation-config/index.ts';
import { SourceText } from '../../../class/adapter/source-text/index.ts';
import { FileEntryFactory } from '../../../class/factory/file-entry/index.ts';

/** Visitor that enriches the directory tree with per-file analysis and expected barrel structure. */
export class ComponentParser {
  private treeData: AnyRecord;
  private runDetailedStatistics: boolean;
  private generationConfig: GenerationConfig | undefined;

  constructor(
    treeData: AnyRecord,
    runDetailedStatistics: boolean = false,
    generationConfig?: GenerationConfig,
  ) {
    this.treeData = treeData;
    this.runDetailedStatistics = runDetailedStatistics;
    this.generationConfig = generationConfig;
  }

  static parseComponentTree(
    treeData: AnyRecord,
    runDetailedStatistics: boolean = false,
    generationConfig?: GenerationConfig,
  ): ComponentParser {
    return new ComponentParser(
      treeData,
      runDetailedStatistics,
      generationConfig,
    );
  }

  traverseTreeAndExecuteAlgorithms(): AnyRecord {
    return this._enrichNode({ ...this.treeData });
  }

  getEnrichedComponentByName(name: string): AnyRecord | null {
    const enrichedTree = this.traverseTreeAndExecuteAlgorithms();
    return this._findComponentByName(enrichedTree, name);
  }

  private _enrichNode(node: AnyRecord): AnyRecord {
    const newNode: AnyRecord = {};

    for (const [key, value] of Object.entries(node)) {
      if (key !== 'children') {
        newNode[key] = value;
      } else {
        newNode[key] = [];
      }
    }

    if (Array.isArray(node['children'])) {
      const enrichedChildren: AnyRecord[] = [];
      for (const child of node['children'] as AnyRecord[]) {
        enrichedChildren.push(this._enrichNode(child));
      }
      newNode['children'] = enrichedChildren;
    }

    const filesList = (newNode['files'] as string[]) ?? [];
    const filesSorted = [...filesList].sort((a, b) => {
      const aIsIndex = a === 'index.ts' ? 1 : 0;
      const bIsIndex = b === 'index.ts' ? 1 : 0;
      if (aIsIndex !== bIsIndex) return aIsIndex - bIsIndex;
      return SourceText.compareText(a, b);
    });

    for (const fileName of filesSorted) {
      const filePath = newNode['path']
        ? path.join(newNode['path'] as string, fileName)
        : fileName;

      if (fileName.endsWith('.story.svelte')) {
        if (!newNode['story']) newNode['story'] = [];
        try {
          const storyInfo = FileEntryFactory.processStoryFile(filePath);
          (newNode['story'] as unknown[]).push(storyInfo);
        } catch (e) {
          (newNode['story'] as unknown[]).push({
            file: fileName,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      } else if (
        fileName.endsWith('.svelte') &&
        !fileName.endsWith('.story.svelte')
      ) {
        if (!newNode['svelte']) newNode['svelte'] = [];
        try {
          const svelteInfo = FileEntryFactory.processSvelteFile(
            filePath,
            this.runDetailedStatistics,
          );
          (newNode['svelte'] as unknown[]).push(svelteInfo);
        } catch (e) {
          (newNode['svelte'] as unknown[]).push({
            file: fileName,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      } else if (fileName.endsWith('.ts')) {
        if (!newNode['ts']) newNode['ts'] = [];
        try {
          const tsInfo = FileEntryFactory.processTsFile(
            filePath,
            newNode,
            this.generationConfig,
          );
          (newNode['ts'] as unknown[]).push(tsInfo);
        } catch (e) {
          (newNode['ts'] as unknown[]).push({
            file: fileName,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      } else if (fileName.endsWith('.svg')) {
        if (!newNode['svg']) newNode['svg'] = [];
        try {
          const svgInfo = FileEntryFactory.processSvgFile(filePath);
          (newNode['svg'] as unknown[]).push(svgInfo);
        } catch (e) {
          (newNode['svg'] as unknown[]).push({
            file: fileName,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      } else if (fileName.endsWith('.vert')) {
        if (!newNode['vert']) newNode['vert'] = [];
        try {
          const vertInfo = FileEntryFactory.processVertFile(filePath);
          (newNode['vert'] as unknown[]).push(vertInfo);
        } catch (e) {
          (newNode['vert'] as unknown[]).push({
            file: fileName,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      } else if (fileName.endsWith('.frag')) {
        if (!newNode['frag']) newNode['frag'] = [];
        try {
          const fragInfo = FileEntryFactory.processFragFile(filePath);
          (newNode['frag'] as unknown[]).push(fragInfo);
        } catch (e) {
          (newNode['frag'] as unknown[]).push({
            file: fileName,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }
    }

    if (
      newNode['path'] &&
      !((newNode['ts'] as Array<{ read?: { file?: string } }>) ?? []).some(
        (entry) => entry.read?.file === 'index.ts',
      )
    ) {
      const entry = FileEntryFactory.processTsFile(
        path.join(newNode['path'] as string, 'index.ts'),
        newNode,
        this.generationConfig,
      );
      if (!newNode['ts']) newNode['ts'] = [];
      (newNode['ts'] as unknown[]).push(entry);
    }
    return newNode;
  }

  private _findComponentByName(
    node: AnyRecord,
    name: string,
  ): AnyRecord | null {
    if (node['name'] === name) return node;

    for (const child of (node['children'] as AnyRecord[]) ?? []) {
      const result = this._findComponentByName(child, name);
      if (result) return result;
    }

    return null;
  }
}
