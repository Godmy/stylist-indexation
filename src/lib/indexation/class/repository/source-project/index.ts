import * as fs from 'node:fs';
import * as path from 'node:path';
import type { GenerationConfig } from '../../../interface/contract/generation-config/index.ts';
import { GenerationModeRegistry } from '../../../class/registry/generation-mode/index.ts';
import { IndexationSettings } from '../../../class/registry/indexation-settings/index.ts';
import { ModuleSourceRepository } from '../../../class/repository/module-source/index.ts';

/** Configured source projects and the layout of each one. */
export class SourceProjectRepository {
  /** Source directory of a project: `module.json` sourceRoot or the configured root. */
  static projectSourceRoot(
    projectPath: string,
    projectRoot = process.cwd(),
  ): string {
    const root = path.resolve(projectRoot, projectPath);
    const metadata = path.join(root, 'module.json');
    return fs.existsSync(metadata)
      ? path.resolve(
          root,
          JSON.parse(fs.readFileSync(metadata, 'utf8')).sourceRoot,
        )
      : path.join(root, IndexationSettings.sourceRoot());
  }

  static projectGenerationConfig(
    projectPath: string,
    config: GenerationConfig,
    projectRoot = process.cwd(),
  ): GenerationConfig {
    const source = SourceProjectRepository.projectSourceRoot(
      projectPath,
      projectRoot,
    );
    const metadataPath = path.join(
      path.resolve(projectRoot, projectPath),
      'module.json',
    );
    const domainRoot =
      fs.existsSync(metadataPath) &&
      JSON.parse(fs.readFileSync(metadataPath, 'utf8')).domainRoot === true;
    const directories = fs
      .readdirSync(source)
      .filter(
        (name) =>
          !name.startsWith('.') &&
          ModuleSourceRepository.isDirectory(path.join(source, name)),
      );
    const isDomain =
      domainRoot ||
      (directories.some((name) => IndexationSettings.isRootCluster(name)) &&
        directories.every(
          (name) =>
            IndexationSettings.isRootCluster(name) ||
            IndexationSettings.isServiceFolder(name),
        ));
    return {
      ...(isDomain
        ? config
        : GenerationModeRegistry.buildGenerationConfig('full')),
      source_layout: isDomain ? 'domain' : 'domains',
    };
  }

  /**
   * `[path, name]` of every configured project with a source directory,
   * leaving out checkouts of modules that the module selection skips.
   */
  static discoverProjects(): Array<[string, string]> {
    const { projects } = IndexationSettings.config;
    const skipped = new Set<string>();
    for (const project of projects) {
      const [packageRoot, modules] = ModuleSourceRepository.readRegistry(
        SourceProjectRepository.projectSourceRoot(project.path),
      );
      if (!packageRoot || !Object.keys(modules).length) continue;
      const selected = ModuleSourceRepository.selectModules(modules);
      for (const [name, module] of Object.entries(modules))
        if (!(name in selected))
          skipped.add(path.resolve(project.path, module.path));
    }
    return projects
      .filter(
        (project) =>
          !skipped.has(path.resolve(project.path)) &&
          ModuleSourceRepository.isDirectory(
            SourceProjectRepository.projectSourceRoot(project.path),
          ),
      )
      .map((project) => [project.path, project.name]);
  }
}
