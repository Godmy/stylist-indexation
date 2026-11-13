import type { ExportEntry } from '../../../interface/contract/export-entry/index.ts';
import type { ImportEntry } from '../../../interface/contract/import-entry/index.ts';

/** Differences between the current and the expected barrel. */
export interface TsMerge {
  is_match: boolean;
  missing_exports: ExportEntry[];
  extra_exports: ExportEntry[];
  missing_type_exports: ExportEntry[];
  extra_type_exports: ExportEntry[];
  missing_interface_exports: ExportEntry[];
  extra_interface_exports: ExportEntry[];
  extra_type_imports: ImportEntry[];
  extra_data_imports: ImportEntry[];
  action?: string;
  reason?: string;
}
