import * as fs from 'node:fs';
import * as path from 'node:path';
import { CONFIG_FILE_NAME } from '../../../const/value/config-file-name/index.ts';
import { DEFAULT_INDEXATION_CONFIG } from '../../../const/object/default-indexation-config/index.ts';
import type { IndexationConfig } from '../../../interface/contract/indexation-config/index.ts';
import type { IndexationProject } from '../../../interface/contract/indexation-project/index.ts';

/** Reads `stylist-indexation.config.json`, its `extends` chain and the defaults. */
export class IndexationConfigRepository {
  /**
   * Configuration for a launch directory: `configPath` when given, otherwise
   * `stylist-indexation.config.json` in `cwd`, otherwise the defaults with
   * `cwd` as the only project.
   */
  static load(cwd: string, configPath?: string): IndexationConfig {
    const file = configPath
      ? path.resolve(cwd, configPath)
      : path.join(cwd, CONFIG_FILE_NAME);
    if (!fs.existsSync(file)) {
      if (configPath) throw new Error(`Config not found: ${file}`);
      return IndexationConfigRepository.finish(
        { ...DEFAULT_INDEXATION_CONFIG },
        cwd,
        [{ name: IndexationConfigRepository.projectName(cwd), path: cwd }],
      );
    }
    const raw = IndexationConfigRepository.readChain(file, new Set());
    const dir = path.dirname(file);
    return IndexationConfigRepository.finish(
      { ...DEFAULT_INDEXATION_CONFIG, ...raw },
      dir,
      raw.projects ?? [
        { name: IndexationConfigRepository.projectName(dir), path: dir },
      ],
    );
  }

  /** Raw settings of `file` merged over its `extends` chain; project paths become absolute. */
  private static readChain(
    file: string,
    seen: Set<string>,
  ): Partial<IndexationConfig> {
    if (seen.has(file)) throw new Error(`Config extends itself: ${file}`);
    seen.add(file);
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
    } catch (error) {
      throw new Error(`Invalid config ${file}: ${(error as Error).message}`);
    }
    IndexationConfigRepository.validate(data, file);
    const dir = path.dirname(file);
    const own = { ...data } as Partial<IndexationConfig> & {
      extends?: string;
    };
    delete own.extends;
    if (own.projects)
      own.projects = own.projects.map((project) => ({
        name: project.name,
        path: path.resolve(dir, project.path),
      }));
    if (own.outDir) own.outDir = path.resolve(dir, own.outDir);
    if (typeof data.extends !== 'string') return own;
    const base = IndexationConfigRepository.readChain(
      path.resolve(dir, data.extends),
      seen,
    );
    const names = new Set((own.projects ?? []).map((project) => project.name));
    return {
      ...base,
      ...own,
      projects: [
        ...(base.projects ?? []).filter((project) => !names.has(project.name)),
        ...(own.projects ?? []),
      ],
      modes: { ...base.modes, ...own.modes },
      componentPrefixes: {
        ...base.componentPrefixes,
        ...own.componentPrefixes,
      },
      componentNames: { ...base.componentNames, ...own.componentNames },
    };
  }

  private static finish(
    config: IndexationConfig,
    baseDir: string,
    projects: IndexationProject[],
  ): IndexationConfig {
    return {
      ...config,
      projects,
      modes: { ...DEFAULT_INDEXATION_CONFIG.modes, ...config.modes },
      outDir: path.resolve(baseDir, config.outDir),
    };
  }

  private static validate(data: Record<string, unknown>, file: string): void {
    const fail = (message: string): never => {
      throw new Error(`Invalid config ${file}: ${message}`);
    };
    if (!data || typeof data !== 'object' || Array.isArray(data))
      fail('expected a JSON object');
    const known = new Set([
      '$schema',
      'extends',
      ...Object.keys(DEFAULT_INDEXATION_CONFIG),
    ]);
    for (const key of Object.keys(data))
      if (!known.has(key)) fail(`unknown key "${key}"`);
    const strings = (key: string): void => {
      const value = data[key];
      if (
        value !== undefined &&
        (!Array.isArray(value) ||
          value.some((item) => typeof item !== 'string'))
      )
        fail(`"${key}" must be an array of strings`);
    };
    const records = (key: string): void => {
      const value = data[key];
      if (
        value !== undefined &&
        (typeof value !== 'object' ||
          Array.isArray(value) ||
          Object.values(value as object).some(
            (item) => typeof item !== 'string',
          ))
      )
        fail(`"${key}" must map names to strings`);
    };
    if (
      data.clustersOnly !== undefined &&
      typeof data.clustersOnly !== 'boolean'
    )
      fail('"clustersOnly" must be true or false');
    for (const key of ['extends', 'sourceRoot', 'marker', 'outDir'])
      if (data[key] !== undefined && typeof data[key] !== 'string')
        fail(`"${key}" must be a string`);
    if (typeof data.sourceRoot === 'string') {
      const root = data.sourceRoot.replace(/\\/g, '/');
      if (
        path.isAbsolute(root) ||
        root.split('/').some((part) => part === '..') ||
        !root.replace(/^\.\/?/, '').replace(/\/+$/, '')
      )
        fail('"sourceRoot" must be a directory below the project');
    }
    for (const key of [
      'rootClusters',
      'serviceFolders',
      'retiredMarkers',
      'skipFolders',
      'svgDomains',
      'aliases',
    ])
      strings(key);
    for (const key of ['componentPrefixes', 'componentNames']) records(key);
    if (data.projects !== undefined) {
      if (
        !Array.isArray(data.projects) ||
        data.projects.some(
          (project) =>
            !project ||
            typeof project.name !== 'string' ||
            !project.name ||
            typeof project.path !== 'string',
        )
      )
        fail('"projects" must be an array of { "name", "path" }');
    }
    if (data.modes !== undefined) {
      if (typeof data.modes !== 'object' || Array.isArray(data.modes))
        fail('"modes" must be an object');
      for (const [name, mode] of Object.entries(data.modes as object)) {
        const value = mode as Record<string, unknown>;
        for (const key of ['excludedRootDomains', 'includedRootClusters'])
          if (
            !Array.isArray(value?.[key]) ||
            (value[key] as unknown[]).some((item) => typeof item !== 'string')
          )
            fail(`"modes.${name}.${key}" must be an array of strings`);
      }
    }
  }

  private static projectName(cwd: string): string {
    try {
      const name = JSON.parse(
        fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'),
      ).name;
      if (typeof name === 'string' && name)
        return name.replace(/^@[^/]+\//, '');
    } catch {
      // No readable package.json: fall back to the directory name.
    }
    return path.basename(cwd);
  }
}
