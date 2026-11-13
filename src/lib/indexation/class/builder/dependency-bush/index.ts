import * as path from 'node:path';
import type { BushGraphNode } from '../../../interface/contract/bush-graph-node/index.ts';
import type { BushNode } from '../../../interface/contract/bush-node/index.ts';
import type { BushStats } from '../../../interface/contract/bush-stats/index.ts';
import type { BushEdge } from '../../../interface/contract/bush-edge/index.ts';
import type { DependencyBushes } from '../../../interface/contract/dependency-bushes/index.ts';
import type { DependencySummary } from '../../../interface/contract/dependency-summary/index.ts';
import type { FileMap } from '../../../interface/contract/file-map/index.ts';
import type { TreeNodeBush } from '../../../interface/contract/tree-node-bush/index.ts';
import { IndexationSettings } from '../../../class/registry/indexation-settings/index.ts';
import { TsAstParser } from '../../../class/strategy/ts-ast-parser/index.ts';

/** Dependency bushes of component entries, built from the enriched tree. */
export class DependencyBushBuilder {
  static buildComponentDependencyBushes(
    enrichedTree: TreeNodeBush,
    maxDepth: number = 8,
  ): DependencyBushes {
    const libRoot = path.normalize(enrichedTree.path ?? '');
    const files = DependencyBushBuilder.extractFiles(enrichedTree);
    const graph = DependencyBushBuilder.collectGraph(files, libRoot);

    const componentRoots = Object.keys(graph)
      .filter((fp) => DependencyBushBuilder.isComponentEntry(fp, libRoot))
      .sort();

    const components: DependencyBushes['components'] = [];

    for (const rootFile of componentRoots) {
      const expanded = new Set<string>();
      const bush = DependencyBushBuilder.buildBushNode(
        rootFile,
        graph,
        libRoot,
        new Set([rootFile]),
        expanded,
        new Set(),
        0,
        maxDepth,
      );
      const {
        nodeCount,
        maxDepth: bushDepth,
        categories,
      } = DependencyBushBuilder.collectBushStats(bush);
      components.push({
        component: DependencyBushBuilder.toRel(rootFile, libRoot),
        nodes_count: nodeCount,
        max_depth: bushDepth,
        categories,
        bush,
      });
    }

    return {
      root_path: libRoot,
      max_depth_limit: maxDepth,
      components_count: components.length,
      components,
    };
  }

  static buildComponentDependencySummary(
    dependencyBushes: DependencyBushes,
  ): DependencySummary {
    const summaryComponents = dependencyBushes.components.map((item) => ({
      component: item.component,
      nodes_count: item.nodes_count,
      max_depth: item.max_depth,
      categories: item.categories,
    }));

    summaryComponents.sort((a, b) => {
      const depthDiff = b.max_depth - a.max_depth;
      if (depthDiff !== 0) return depthDiff;
      return b.nodes_count - a.nodes_count;
    });

    return {
      root_path: dependencyBushes.root_path,
      max_depth_limit: dependencyBushes.max_depth_limit,
      components_count: dependencyBushes.components_count,
      components: summaryComponents,
    };
  }

  private static norm(p: string): string {
    return path.normalize(p).toLowerCase();
  }

  private static toRel(p: string, rootPath: string): string {
    return path.relative(rootPath, p).replace(/\\/g, '/');
  }

  private static extractFiles(enrichedTree: TreeNodeBush): FileMap {
    const files: FileMap = {};

    function walk(node: TreeNodeBush) {
      for (const key of ['svelte', 'ts', 'story'] as const) {
        for (const item of node[key] ?? []) {
          const readData = item.read ?? {};
          const filePath = readData.file_path;
          const raw = readData.raw_content;
          if (filePath && typeof raw === 'string') {
            files[DependencyBushBuilder.norm(filePath)] = raw;
          }
        }
      }
      for (const child of node.children ?? []) {
        walk(child);
      }
    }

    walk(enrichedTree);
    return files;
  }

  private static resolveFromBase(
    basePath: string,
    knownFiles: Set<string>,
  ): string {
    const norm = DependencyBushBuilder.norm;
    const candidates = [
      basePath,
      `${basePath}.ts`,
      `${basePath}.svelte.ts`,
      `${basePath}.svelte`,
      `${basePath}.js`,
      path.join(basePath, 'index.ts'),
      path.join(basePath, 'index.svelte'),
    ];
    for (const candidate of candidates) {
      if (knownFiles.has(norm(candidate))) return norm(candidate);
    }
    return '';
  }

  private static resolveSpecifier(
    specifier: string,
    fromFile: string,
    libRoot: string,
    knownFiles: Set<string>,
  ): string {
    if (specifier.startsWith('.')) {
      const base = path.normalize(path.join(path.dirname(fromFile), specifier));
      return DependencyBushBuilder.resolveFromBase(base, knownFiles);
    }

    const aliasPrefixes = IndexationSettings.config.aliases.map(
      (alias) => alias.replace(/\/+$/, '') + '/',
    );
    for (const prefix of aliasPrefixes) {
      if (specifier.startsWith(prefix)) {
        const relPart = specifier.slice(prefix.length).replace(/\//g, path.sep);
        const base = path.join(libRoot, relPart);
        return DependencyBushBuilder.resolveFromBase(base, knownFiles);
      }
    }

    return '';
  }

  private static categorize(text: string): string {
    const value = text.toLowerCase();
    if (value.includes('token')) return 'tokens';
    if (value.includes('util')) return 'utils';
    if (value.includes('state')) return 'state';
    if (value.includes('preset')) return 'preset';
    if (value.includes('class')) return 'classes';
    if (value.includes('contract')) return 'contracts';
    if (value.includes('prop')) return 'props';
    if (value.includes('component')) return 'components';
    return 'other';
  }

  private static collectGraph(
    files: FileMap,
    libRoot: string,
  ): Record<string, BushGraphNode> {
    const knownFiles = new Set(Object.keys(files));
    const graph: Record<string, BushGraphNode> = {};

    for (const [filePath, rawContent] of Object.entries(files)) {
      // Imports first, then re-exports, as the edge lists were always ordered.
      const moduleEdges = TsAstParser.collectModuleEdges(
        rawContent,
        filePath,
      ).sort(
        (a, b) =>
          Number(a.origin === 'reexport') - Number(b.origin === 'reexport'),
      );
      const edges: BushEdge[] = moduleEdges.map((edge) => ({
        specifier: edge.specifier,
        resolved: DependencyBushBuilder.resolveSpecifier(
          edge.specifier,
          filePath,
          libRoot,
          knownFiles,
        ),
        category: DependencyBushBuilder.categorize(edge.specifier),
        origin: edge.origin,
        requested_names: [...new Set(edge.requested_names)].sort(),
        exported_names: [...new Set(edge.exported_names)].sort(),
      }));

      graph[filePath] = { edges };
    }

    return graph;
  }

  private static isComponentEntry(filePath: string, libRoot: string): boolean {
    const rel = DependencyBushBuilder.toRel(filePath, libRoot).toLowerCase();
    return rel.startsWith('components/') && rel.endsWith('/index.svelte');
  }

  private static buildBushNode(
    nodePath: string,
    graph: Record<string, BushGraphNode>,
    libRoot: string,
    stack: Set<string>,
    expanded: Set<string>,
    requiredNames: Set<string>,
    depth: number,
    maxDepth: number,
  ): BushNode {
    const toRel = DependencyBushBuilder.toRel;
    const categorize = DependencyBushBuilder.categorize;
    const rel = toRel(nodePath, libRoot);
    const node: BushNode = {
      id: rel,
      kind: 'file',
      category: categorize(rel),
      depth,
      children: [],
    };

    if (depth >= maxDepth) return node;

    expanded.add(nodePath);

    const nodeData = graph[nodePath] ?? { edges: [] };
    let selectedEdges = nodeData.edges;

    if (path.basename(nodePath) === 'index.ts') {
      if (!requiredNames.size) {
        node.truncated = 'barrel_without_symbols';
        return node;
      }

      const filtered = nodeData.edges.filter((edge) => {
        if (edge.origin !== 'reexport') return false;
        const exportedNames = new Set(edge.exported_names);
        return (
          exportedNames.size > 0 &&
          [...exportedNames].some((n) => requiredNames.has(n))
        );
      });

      selectedEdges = filtered.length > 0 ? filtered : [];
    }

    for (const edge of selectedEdges) {
      const { resolved, specifier, category: edgeCategory } = edge;

      if (
        IndexationSettings.config.aliases.some((alias) =>
          specifier.startsWith(alias.replace(/\/+$/, '') + '/components'),
        )
      ) {
        node.children.push({
          id: specifier,
          kind: 'component_ref',
          category: 'components',
          via: specifier,
          depth: depth + 1,
          children: [],
        });
        continue;
      }

      if (!resolved) {
        node.children.push({
          id: specifier,
          kind: 'external',
          category: edgeCategory,
          via: specifier,
          depth: depth + 1,
          children: [],
        });
        continue;
      }

      if (stack.has(resolved)) {
        node.children.push({
          id: toRel(resolved, libRoot),
          kind: 'cycle',
          category: categorize(toRel(resolved, libRoot)),
          via: specifier,
          depth: depth + 1,
          children: [],
        });
        continue;
      }

      if (expanded.has(resolved)) {
        node.children.push({
          id: toRel(resolved, libRoot),
          kind: 'ref',
          category: categorize(toRel(resolved, libRoot)),
          via: specifier,
          depth: depth + 1,
          children: [],
        });
        continue;
      }

      const nextRequired = new Set([
        ...edge.requested_names,
        ...edge.exported_names,
      ]);

      const child = DependencyBushBuilder.buildBushNode(
        resolved,
        graph,
        libRoot,
        new Set([...stack, resolved]),
        expanded,
        nextRequired,
        depth + 1,
        maxDepth,
      );
      child.via = specifier;
      node.children.push(child);
    }

    return node;
  }

  private static collectBushStats(bush: BushNode): BushStats {
    let nodeCount = 0;
    let maxDepth = 0;
    const categories: Record<string, number> = {};

    function walk(node: BushNode) {
      if (node.kind === 'file') {
        nodeCount++;
        maxDepth = Math.max(maxDepth, node.depth);
        const cat = node.category ?? 'other';
        categories[cat] = (categories[cat] ?? 0) + 1;
      }
      for (const child of node.children) walk(child);
    }

    walk(bush);
    return { nodeCount, maxDepth, categories };
  }
}
