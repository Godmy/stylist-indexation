import type { ExportEntry } from '../../../interface/contract/export-entry/index.ts';
import type { TransitEntry } from '../../../interface/contract/transit-entry/index.ts';

/** Barrel exports by bucket. */
export interface TsStructureExports {
  default?: ExportEntry[];
  transit?: TransitEntry[];
  type?: ExportEntry[];
  interface?: ExportEntry[];
}
