import * as fs from 'node:fs';
import * as path from 'node:path';
import type { AnyRecord } from '../../../type/record/any-record/index.ts';
import type { ComponentTree } from '../../../interface/contract/component-tree/index.ts';
import { IndexationSettings } from '../../../class/registry/indexation-settings/index.ts';
import { ModuleSourceRepository } from '../../../class/repository/module-source/index.ts';

/** Directory tree of a source root, with module checkouts projected onto their logical domains. */
export class ComponentTreeBuilder {
  static buildComponentTree(rootPath: string): ComponentTree {
    if (!fs.existsSync(rootPath)) {
      throw new Error(`Path does not exist: ${rootPath}`);
    }

    const stat = fs.statSync(rootPath);
    if (!stat.isDirectory()) {
      throw new Error(`Path is not a directory: ${rootPath}`);
    }

    const rootName = path.basename(rootPath);
    const dirs: Array<[string, string]> = [];
    const files: string[] = [];

    for (const item of fs.readdirSync(rootPath)) {
      const itemPath = path.join(rootPath, item);
      if (fs.statSync(itemPath).isDirectory()) {
        dirs.push([item, itemPath]);
      } else {
        files.push(item);
      }
    }

    const root: ComponentTree = {
      name: rootName,
      path: rootPath,
      children: [],
      files,
    };

    const metadataFile = path.join(rootPath, 'module.json');
    const metadata = fs.existsSync(metadataFile)
      ? JSON.parse(fs.readFileSync(metadataFile, 'utf8'))
      : undefined;
    const domainRoot = metadata?.domainRoot === true;
    if (metadata) {
      root.files = files.filter((name) =>
        (domainRoot ? ['index.ts'] : ['index.ts', 'index.full.ts']).includes(
          name,
        ),
      );
      root.library_root = !domainRoot;
      if (domainRoot) root.domain_root = true;
      root.private_root = Boolean(metadata.private);
      root.architecture_path = domainRoot
        ? path.join(
            rootPath,
            IndexationSettings.sourceRoot(),
            metadata.domains[0] ?? rootName,
          )
        : path.join(rootPath, IndexationSettings.sourceRoot());
    }

    for (const [dirName, dirPath] of dirs) {
      if (domainRoot && !IndexationSettings.isRootCluster(dirName)) continue;
      if (metadata && !domainRoot && !metadata.domains.includes(dirName))
        continue;
      const child = ComponentTreeBuilder.buildComponentTreeRecursive(
        dirName,
        dirPath,
      );
      if (metadata)
        ComponentTreeBuilder.setArchitecturePaths(
          child,
          path.join(root.architecture_path!, dirName),
        );
      root.children.push(child);
    }

    for (const [domain, target] of Object.entries(
      ModuleSourceRepository.moduleDomains(rootPath),
    )) {
      if (!fs.existsSync(target) || !fs.statSync(target).isDirectory())
        continue;
      root.children = root.children.filter((child) => child.name !== domain);
      const child = ComponentTreeBuilder.buildComponentTreeRecursive(
        domain,
        target,
      );
      child.export_from = path.relative(rootPath, target).replace(/\\/g, '/');
      ComponentTreeBuilder.setArchitecturePaths(
        child,
        path.join(rootPath, domain),
      );
      root.children.push(child);
    }

    return root;
  }

  /** Plain JSON form of the tree, with optional keys only when set. */
  static treeToDict(tree: ComponentTree): AnyRecord {
    return {
      name: tree.name,
      path: tree.path,
      children: tree.children.map(ComponentTreeBuilder.treeToDict),
      files: tree.files,
      ...(tree.export_from !== undefined
        ? { export_from: tree.export_from }
        : {}),
      ...(tree.architecture_path !== undefined
        ? { architecture_path: tree.architecture_path }
        : {}),
      ...(tree.library_root !== undefined
        ? { library_root: tree.library_root }
        : {}),
      ...(tree.domain_root !== undefined
        ? { domain_root: tree.domain_root }
        : {}),
      ...(tree.private_root !== undefined
        ? { private_root: tree.private_root }
        : {}),
    };
  }

  private static buildComponentTreeRecursive(
    name: string,
    dirPath: string,
  ): ComponentTree {
    const dirs: Array<[string, string]> = [];
    const files: string[] = [];

    for (const item of fs.readdirSync(dirPath)) {
      if (['.git', 'node_modules', '.svelte-kit', 'dist'].includes(item))
        continue;
      const itemPath = path.join(dirPath, item);
      if (fs.statSync(itemPath).isDirectory()) {
        dirs.push([item, itemPath]);
      } else {
        files.push(item);
      }
    }

    const node: ComponentTree = { name, path: dirPath, children: [], files };

    for (const [dirName, childPath] of dirs) {
      node.children.push(
        ComponentTreeBuilder.buildComponentTreeRecursive(dirName, childPath),
      );
    }

    return node;
  }

  private static setArchitecturePaths(
    node: ComponentTree,
    architecturePath: string,
  ): void {
    node.architecture_path = architecturePath;
    for (const child of node.children)
      ComponentTreeBuilder.setArchitecturePaths(
        child,
        path.join(architecturePath, child.name),
      );
  }
}
