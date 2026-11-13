import * as path from 'node:path';
import { DEFAULT_INDEXATION_CONFIG } from '../../../const/object/default-indexation-config/index.ts';
import type { IndexationConfig } from '../../../interface/contract/indexation-config/index.ts';

/** Configuration of the current run, read by every generation step. */
export class IndexationSettings {
  private static current: IndexationConfig = DEFAULT_INDEXATION_CONFIG;

  static get config(): IndexationConfig {
    return IndexationSettings.current;
  }

  static use(config: IndexationConfig): void {
    IndexationSettings.current = config;
  }

  static reset(): void {
    IndexationSettings.current = DEFAULT_INDEXATION_CONFIG;
  }

  /** Barrel header line of the configured marker. */
  static marker(kind: 'AUTO-GENERATED' | 'AUTO-PROTECTED'): string {
    return `/** AREA: ${IndexationSettings.current.marker} -> ${kind} */`;
  }

  /** `/`-separated source root, e.g. `src/lib`. */
  static sourceRoot(): string {
    return path.posix
      .normalize(IndexationSettings.current.sourceRoot.replace(/\\/g, '/'))
      .replace(/^\.\/|\/+$/g, '');
  }

  /** `/src/lib`: suffix of a project source root in normalized paths. */
  static sourceSuffix(): string {
    return '/' + IndexationSettings.sourceRoot();
  }

  static isRootCluster(name: string): boolean {
    return IndexationSettings.current.rootClusters.includes(name);
  }

  static isServiceFolder(name: string): boolean {
    return IndexationSettings.current.serviceFolders.includes(name);
  }
}
