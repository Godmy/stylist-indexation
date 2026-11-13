import type { ExportEntry } from '../../../interface/contract/export-entry/index.ts';

/** Enriched tree node as read by the index.ts structure builder. */
export interface TreeNodeStructure {
  export_from?: string;
  architecture_path?: string;
  name?: string;
  path?: string;
  children?: TreeNodeStructure[];
  files?: string[];
  svelte?: Array<{
    read?: { file?: string; default?: { name?: string; from?: string } };
  }>;
  ts?: Array<{
    read?: {
      file?: string;
      exports?: Record<string, ExportEntry[]>;
      raw_content?: string;
    };
    build?: { exports?: Record<string, ExportEntry[]> };
  }>;
  svg?: Array<{ file?: string }>;
}
