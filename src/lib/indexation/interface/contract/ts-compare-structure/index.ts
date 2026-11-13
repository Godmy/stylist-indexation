import type { ExportEntry } from '../../../interface/contract/export-entry/index.ts';
import type { ImportEntry } from '../../../interface/contract/import-entry/index.ts';

/** Exports and imports compared between the current and the expected barrel. */
export interface TsCompareStructure {
  exports?: {
    default?: ExportEntry[];
    type?: ExportEntry[];
    interface?: ExportEntry[];
  };
  imports?: { type?: ImportEntry[]; data?: ImportEntry[] };
}
