import type { ExportEntry } from '../../../interface/contract/export-entry/index.ts';
import type { TransitEntry } from '../../../interface/contract/transit-entry/index.ts';

/** Top-level exports of a TS file by bucket. */
export interface ParsedExports {
  default: ExportEntry[];
  type: ExportEntry[];
  transit: TransitEntry[];
  interface: ExportEntry[];
}
