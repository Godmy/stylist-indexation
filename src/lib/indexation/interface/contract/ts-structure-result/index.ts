import type { ExportEntry } from '../../../interface/contract/export-entry/index.ts';
import type { TransitEntry } from '../../../interface/contract/transit-entry/index.ts';

/** Expected barrel of a node: generated text and its exports. */
export interface TsStructureResult {
  file: string;
  file_path: string;
  raw_content: string;
  rows_count: number;
  exports: Record<string, ExportEntry[] | TransitEntry[]>;
  imports: Record<string, unknown[]>;
}
