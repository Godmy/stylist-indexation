import type { GenerationConfig } from '../../../interface/contract/generation-config/index.ts';
import { IndexationSettings } from '../../../class/registry/indexation-settings/index.ts';

/** Generation modes and the root domain/cluster filters they apply. */
export class GenerationModeRegistry {
  static buildGenerationConfig(generationMode: string): GenerationConfig {
    const mode = IndexationSettings.config.modes[generationMode];
    if (!mode) {
      throw new Error(`Unsupported generation mode: ${generationMode}`);
    }
    return {
      generation_mode: generationMode,
      excluded_root_domains: [...new Set(mode.excludedRootDomains)].sort(),
      included_root_clusters: [...new Set(mode.includedRootClusters)].sort(),
    };
  }

  static getGenerationModes(): string[] {
    return Object.keys(IndexationSettings.config.modes).sort();
  }

  static getExcludedRootDomains(
    generationConfig?: GenerationConfig,
  ): Set<string> {
    const excluded =
      generationConfig?.excluded_root_domains ??
      GenerationModeRegistry.buildGenerationConfig('full')
        .excluded_root_domains;
    return new Set(excluded);
  }

  static getIncludedRootClusters(
    generationConfig?: GenerationConfig,
  ): Set<string> {
    const included = generationConfig?.included_root_clusters;
    return new Set(
      included?.length
        ? included
        : GenerationModeRegistry.buildGenerationConfig('full')
            .included_root_clusters,
    );
  }

  static isDomainRootPath(
    nodePath: string,
    generationConfig?: GenerationConfig,
  ): boolean {
    const suffix = IndexationSettings.sourceSuffix();
    const normalized = nodePath.replace(/\\/g, '/').replace(/\/$/, '');
    if (generationConfig?.source_layout === 'domain')
      return normalized.endsWith(suffix);
    const idx = normalized.indexOf(suffix + '/');
    if (idx === -1) {
      return false;
    }
    const afterLib = normalized.slice(idx + suffix.length + 1);
    const segments = afterLib.split('/').filter((s) => s.length > 0);
    return segments.length === 1;
  }

  static shouldSkipDomainClusterExport(
    nodePath: string,
    childName: string,
    generationConfig?: GenerationConfig,
  ): boolean {
    if (!GenerationModeRegistry.isDomainRootPath(nodePath, generationConfig)) {
      return false;
    }
    if (IndexationSettings.isServiceFolder(childName)) return true;
    // Other non-cluster folders are plain modules unless `clustersOnly` is set.
    if (!IndexationSettings.isRootCluster(childName))
      return IndexationSettings.config.clustersOnly;
    return !GenerationModeRegistry.getIncludedRootClusters(
      generationConfig,
    ).has(childName);
  }

  static shouldSkipRootChildExport(
    nodePath: string,
    childName: string,
    generationConfig?: GenerationConfig,
  ): boolean {
    const normalizedPath = nodePath.replace(/\\/g, '/');
    if (!normalizedPath.endsWith(IndexationSettings.sourceSuffix())) {
      return false;
    }
    if (generationConfig?.source_layout === 'domain') return false;
    return GenerationModeRegistry.getExcludedRootDomains(generationConfig).has(
      childName,
    );
  }
}
