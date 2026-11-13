import * as fs from 'node:fs';
import * as path from 'node:path';
import { DRY_RUN_ENV } from '../../../const/value/dry-run-env/index.ts';
import type { AnyRecord } from '../../../type/record/any-record/index.ts';
import type { EnrichedNode } from '../../../interface/contract/enriched-node/index.ts';
import type { GenerationConfig } from '../../../interface/contract/generation-config/index.ts';
import type { TreeNodeStructure } from '../../../interface/contract/tree-node-structure/index.ts';
import type { TreeNodeRoot } from '../../../interface/contract/tree-node-root/index.ts';
import { SourceText } from '../../../class/adapter/source-text/index.ts';
import { IndexContentBuilder } from '../../../class/builder/index-content/index.ts';
import { IndexStructureBuilder } from '../../../class/builder/index-structure/index.ts';
import { GenerationModeRegistry } from '../../../class/registry/generation-mode/index.ts';
import { IndexationSettings } from '../../../class/registry/indexation-settings/index.ts';
import { ModuleSourceRepository } from '../../../class/repository/module-source/index.ts';

/** Walks the enriched tree and writes stale generated index files. */
export class IndexWriter {
  static processNode(
    tree: AnyRecord,
    updated: string[],
    unchanged: string[],
    config?: GenerationConfig,
  ): void {
    const nonempty = IndexWriter.isNonempty;
    const node = tree as EnrichedNode;
    if ((node as TreeNodeRoot).domain_root) {
      IndexWriter.writeDomainEntrypoints(
        node as TreeNodeRoot,
        updated,
        unchanged,
      );
      for (const child of node.children ?? [])
        IndexWriter.processNode(child, updated, unchanged, config);
      return;
    }
    if (IndexWriter.isDomainLibraryRoot(node as TreeNodeRoot, config)) {
      IndexWriter.writeRootEntrypoints(
        node as TreeNodeRoot,
        updated,
        unchanged,
      );
      for (const child of node.children ?? [])
        IndexWriter.processNode(child, updated, unchanged, config);
      return;
    }
    if (node.path) {
      const files = node.files ?? [];
      const hasSvelte = files.some((file) => file.endsWith('.svelte'));
      const hasTs = files.some(
        (file) => file.endsWith('.ts') && file !== 'index.ts',
      );
      const hasChildren = (node.children ?? []).length > 0;
      const normalizedPath = (
        node.architecture_path ??
        node.path ??
        ''
      ).replace(/\\/g, '/');
      const suffix = IndexationSettings.sourceSuffix() + '/';
      const relativeParts = normalizedPath.includes(suffix)
        ? normalizedPath.split(suffix)[1].split('/').filter(Boolean)
        : [];
      const generatedOnlyJoint =
        files.includes('index.ts') &&
        !hasSvelte &&
        !hasTs &&
        !hasChildren &&
        relativeParts.length === 3;
      if (hasSvelte || hasTs || hasChildren || generatedOnlyJoint) {
        const index = (node.ts ?? []).find(
          (entry) => entry.read?.file === 'index.ts',
        );
        if (index) {
          const build = index.build;
          const read = index.read ?? {};
          if (build && nonempty(build)) {
            const target = build.file_path || read.file_path;
            if (target) {
              const current = read.raw_content ?? '';
              const auto = current.includes(
                IndexationSettings.marker('AUTO-GENERATED'),
              );
              if (
                !auto &&
                !IndexationSettings.config.retiredMarkers.some((label) =>
                  current.includes(`AREA: ${label} -> AUTO-GENERATED`),
                ) &&
                !build.raw_content &&
                !nonempty(build.exports) &&
                !nonempty(build.imports)
              )
                unchanged.push(target);
              else {
                let desired = IndexContentBuilder.buildIndexContent(
                  build,
                  read,
                );
                if (!desired.trim()) {
                  if (auto && current.trim()) {
                    IndexWriter.writeGenerated(target, '');
                    updated.push(target);
                  } else unchanged.push(target);
                } else {
                  if (IndexWriter.isSvgDomain(node.architecture_path, target)) {
                    const marker = desired.indexOf(
                      IndexationSettings.marker('AUTO-PROTECTED'),
                    );
                    if (marker !== -1)
                      desired = desired.slice(0, marker).trimEnd();
                  }
                  const currentLines = SourceText.splitLines(current).filter(
                    (line) => line.trim(),
                  ).length;
                  const desiredLines = SourceText.splitLines(desired).filter(
                    (line) => line.trim(),
                  ).length;
                  if (
                    !auto &&
                    currentLines > 3 &&
                    desiredLines < Math.floor(currentLines / 2)
                  ) {
                    console.log(
                      `[SKIP] ${target}: line count dropped ${currentLines} -> ${desiredLines}, skipping`,
                    );
                    unchanged.push(target);
                  } else if (
                    current.replace(/\r\n/g, '\n') !==
                    desired.replace(/\r\n/g, '\n')
                  ) {
                    IndexWriter.writeGenerated(target, desired);
                    updated.push(target);
                  } else unchanged.push(target);
                }
              }
            }
          }
        } else {
          const target = path.join(node.path, 'index.ts');
          const desired = IndexContentBuilder.buildIndexContent(
            IndexStructureBuilder.buildTsStructureFromNode(
              node as TreeNodeStructure,
              config,
            ),
            { raw_content: '' },
          );
          if (!desired.trim()) unchanged.push(target);
          else {
            IndexWriter.writeGenerated(target, desired);
            updated.push(target);
          }
        }
      }
    }
    for (const child of node.children ?? [])
      IndexWriter.processNode(child, updated, unchanged, config);
  }

  static isDomainLibraryRoot(
    node: TreeNodeRoot,
    config?: GenerationConfig,
  ): boolean {
    if (node.library_root) return true;
    if (
      !(node.path ?? '')
        .replace(/\\/g, '/')
        .replace(/\/+$/, '')
        .endsWith(IndexationSettings.sourceSuffix())
    )
      return false;
    if (config?.source_layout === 'domain') return false;
    return (node.children ?? []).some(
      (child) =>
        !IndexationSettings.isRootCluster(child.name ?? '') &&
        !IndexationSettings.isServiceFolder(child.name ?? ''),
    );
  }

  /** The node is the folder of a configured SVG domain. */
  static isSvgDomain(
    architecturePath: string | undefined,
    target: string,
  ): boolean {
    const suffix = IndexationSettings.sourceSuffix();
    const folder = (architecturePath ?? '').replace(/\\/g, '/');
    const file = target.replace(/\\/g, '/');
    return IndexationSettings.config.svgDomains.some(
      (domain) =>
        folder.endsWith(`${suffix}/${domain}`) ||
        file.endsWith(`${suffix}/${domain}/index.ts`),
    );
  }

  static isDryRun(): boolean {
    return process.env[DRY_RUN_ENV] === '1';
  }

  private static writeRootEntrypoints(
    node: TreeNodeRoot,
    updated: string[],
    unchanged: string[],
  ): void {
    const root = node.path!;
    for (const [filename, mode] of [
      ['index.ts', 'package'],
      ['index.full.ts', 'full'],
    ]) {
      if (mode === 'full' && !ModuleSourceRepository.allModulesSelected())
        continue;
      let config = GenerationModeRegistry.buildGenerationConfig(mode);
      if (mode === 'package')
        config = {
          ...config,
          excluded_root_domains: [
            ...new Set([
              ...config.excluded_root_domains,
              ...ModuleSourceRepository.privateDomains(root),
            ]),
          ].sort(),
        };
      if (node.private_root) config = { ...config, excluded_root_domains: [] };
      const content = IndexContentBuilder.buildIndexContent(
        IndexStructureBuilder.buildTsStructureFromNode(node, config),
        { raw_content: '' },
      );
      const target = path.join(root, filename);
      const previous = fs.existsSync(target)
        ? fs.readFileSync(target, 'utf8').replace(/\r\n/g, '\n')
        : '';
      if (previous === content) unchanged.push(target);
      else {
        IndexWriter.writeGenerated(target, content);
        updated.push(target);
      }
    }
  }

  /** Single-domain metadata roots export clusters, never their own entrypoints. */
  private static writeDomainEntrypoints(
    node: TreeNodeRoot,
    updated: string[],
    unchanged: string[],
  ): void {
    const content = IndexContentBuilder.buildIndexContent(
      IndexStructureBuilder.buildTsStructureFromNode(
        node,
        GenerationModeRegistry.buildGenerationConfig('full'),
      ),
      { raw_content: '' },
    );
    // Keep an existing generated full entrypoint compatible, but do not add one.
    for (const filename of ['index.ts', 'index.full.ts']) {
      const target = path.join(node.path!, filename);
      const previous = fs.existsSync(target)
        ? fs.readFileSync(target, 'utf8')
        : '';
      if (filename === 'index.full.ts' && !previous.includes('AUTO-GENERATED'))
        continue;
      if (previous.replace(/\r\n/g, '\n') === content) unchanged.push(target);
      else {
        IndexWriter.writeGenerated(target, content);
        updated.push(target);
      }
    }
  }

  private static writeGenerated(target: string, content: string): void {
    if (IndexWriter.isDryRun()) return;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    SourceText.writeText(target, content);
  }

  private static isNonempty(value: unknown): boolean {
    return (
      !!value && (typeof value !== 'object' || Object.keys(value).length > 0)
    );
  }
}
