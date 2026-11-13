import type { IndexationMode } from '../../../interface/contract/indexation-mode/index.ts';
import type { IndexationProject } from '../../../interface/contract/indexation-project/index.ts';

/** Settings of an index generation run (`stylist-indexation.config.json`). */
export interface IndexationConfig {
  /** Projects to index; paths are absolute once loaded. */
  projects: IndexationProject[];
  /** Source directory inside a project, relative and below it. */
  sourceRoot: string;
  /** Clusters allowed at a domain root. */
  rootClusters: string[];
  /** Non-cluster folders allowed at a domain root, never exported. */
  serviceFolders: string[];
  /** Strict SAMO: domain folders that are not root clusters stay out of barrels. */
  clustersOnly: boolean;
  /** Filters of each generation mode; `full` and `package` are built in. */
  modes: Record<string, IndexationMode>;
  /** Label of the barrel header `/** AREA: <marker> -> AUTO-GENERATED *\/`. */
  marker: string;
  /** Former header labels whose lines are dropped from protected sections. */
  retiredMarkers: string[];
  /** Diagnostics directory; absolute once loaded. */
  outDir: string;
  /** Folders never re-exported: `name` anywhere or `parent/path/name`. */
  skipFolders: string[];
  /** Domains whose SVG folders get glob constants and name lists. */
  svgDomains: string[];
  /** Component name prefix per domain, e.g. `{ "html": "Html" }`. */
  componentPrefixes: Record<string, string>;
  /** Exact component names per `domain/family`, overriding the prefix. */
  componentNames: Record<string, string>;
  /** Import alias prefixes resolved against the source root, e.g. `$lib`. */
  aliases: string[];
}
