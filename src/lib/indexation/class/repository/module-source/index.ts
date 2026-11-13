import * as fs from 'node:fs';
import * as path from 'node:path';
import { EXCLUDE_MODULES_ENV } from '../../../const/value/exclude-modules-env/index.ts';
import { MODULES_ENV } from '../../../const/value/modules-env/index.ts';
import type { ModuleRegistry } from '../../../interface/contract/module-registry/index.ts';
import { IndexationSettings } from '../../../class/registry/indexation-settings/index.ts';

/** modules.json registry and the physical domain checkouts it maps. */
export class ModuleSourceRepository {
  static isDirectory(target: string): boolean {
    try {
      return fs.statSync(target).isDirectory();
    } catch {
      return false;
    }
  }

  static readRegistry(sourceLib: string): [string | undefined, ModuleRegistry] {
    const suffix = IndexationSettings.sourceSuffix();
    const normalized = path.resolve(sourceLib).replace(/\\/g, '/');
    if (!normalized.endsWith(suffix)) return [undefined, {}];
    const packageRoot = ModuleSourceRepository.resolveRealPath(
      normalized.slice(0, -suffix.length),
    );
    const registry = path.join(packageRoot, 'modules.json');
    return [
      packageRoot,
      fs.existsSync(registry)
        ? JSON.parse(fs.readFileSync(registry, 'utf8').replace(/^\ufeff/, ''))
        : {},
    ];
  }

  static selectModules(
    modules: ModuleRegistry,
    selection?: string,
    excluded?: string,
  ): ModuleRegistry {
    selection = (selection ?? process.env[MODULES_ENV] ?? '').trim() || 'all';
    const excludedNames = ModuleSourceRepository.splitNames(
      excluded ?? process.env[EXCLUDE_MODULES_ENV],
    );
    const chosen =
      selection === 'all'
        ? new Set(Object.keys(modules))
        : selection === 'public'
          ? new Set(
              Object.keys(modules).filter((name) => !modules[name].private),
            )
          : ModuleSourceRepository.splitNames(selection);
    const unknown = [...new Set([...chosen, ...excludedNames])]
      .filter((name) => !(name in modules))
      .sort();
    if (unknown.length)
      throw new Error(`Unknown modules: ${unknown.join(', ')}`);
    return Object.fromEntries(
      Object.entries(modules).filter(
        ([name]) => chosen.has(name) && !excludedNames.has(name),
      ),
    );
  }

  static allModulesSelected(): boolean {
    return (
      ((process.env[MODULES_ENV] ?? '').trim() || 'all') === 'all' &&
      !ModuleSourceRepository.splitNames(process.env[EXCLUDE_MODULES_ENV]).size
    );
  }

  static privateDomains(sourceLib: string): Set<string> {
    return new Set(
      Object.values(ModuleSourceRepository.readRegistry(sourceLib)[1])
        .filter((module) => module.private)
        .flatMap((module) => module.domains),
    );
  }

  static moduleDomains(sourceLib: string): Record<string, string> {
    const [packageRoot, modules] =
      ModuleSourceRepository.readRegistry(sourceLib);
    if (!Object.keys(modules).length) return {};
    const result: Record<string, string> = {};
    for (const module of Object.values(
      ModuleSourceRepository.selectModules(modules),
    )) {
      for (const domain of module.domains) {
        if (domain in result)
          throw new Error(`Duplicate module domain: ${domain}`);
        const target = ModuleSourceRepository.resolveRealPath(
          path.resolve(
            packageRoot!,
            module.path,
            ...(module.domainRoot
              ? []
              : [module.sourceRoot ?? IndexationSettings.sourceRoot(), domain]),
          ),
        );
        if (!ModuleSourceRepository.isWithin(target, packageRoot!))
          throw new Error(`Module escapes package: ${domain}`);
        result[domain] = target;
      }
    }
    return result;
  }

  static domainDirectories(sourceLib: string): Record<string, string> {
    const result = Object.fromEntries(
      fs
        .readdirSync(sourceLib)
        .filter(
          (name) =>
            !name.startsWith('.') &&
            ModuleSourceRepository.isDirectory(path.join(sourceLib, name)),
        )
        .map((name) => [name, path.join(sourceLib, name)]),
    );
    return {
      ...result,
      ...Object.fromEntries(
        Object.entries(ModuleSourceRepository.moduleDomains(sourceLib)).filter(
          ([, target]) => ModuleSourceRepository.isDirectory(target),
        ),
      ),
    };
  }

  static sourcePath(sourceLib: string, logicalPath: string): string {
    const parts = logicalPath
      .split(/[\\/]/)
      .filter((part) => part && part !== '.');
    if (!parts.length || path.isAbsolute(logicalPath) || parts.includes('..'))
      throw new Error(`Invalid logical source path: ${logicalPath}`);
    const owner =
      ModuleSourceRepository.moduleDomains(sourceLib)[parts[0]] ??
      path.join(sourceLib, parts[0]);
    const target = ModuleSourceRepository.resolveRealPath(
      path.resolve(owner, ...parts.slice(1)),
    );
    if (
      !ModuleSourceRepository.isWithin(
        target,
        ModuleSourceRepository.resolveRealPath(owner),
      )
    )
      throw new Error(`Source escapes domain: ${logicalPath}`);
    return target;
  }

  private static splitNames(value?: string): Set<string> {
    return new Set(
      (value ?? '')
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean),
    );
  }

  private static resolveRealPath(target: string): string {
    // Resolve existing ancestors of missing checkouts as well.
    if (fs.existsSync(target)) return fs.realpathSync(target);
    const parent = path.dirname(target);
    return parent === target
      ? target
      : path.join(
          ModuleSourceRepository.resolveRealPath(parent),
          path.basename(target),
        );
  }

  private static isWithin(target: string, owner: string): boolean {
    const relative = path.relative(owner, target);
    return (
      relative !== '..' &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative)
    );
  }
}
