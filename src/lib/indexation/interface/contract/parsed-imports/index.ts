import type { ImportEntry } from '../../../interface/contract/import-entry/index.ts';

/** Top-level imports of a TS file, type-only and value. */
export interface ParsedImports {
  type: ImportEntry[];
  data: ImportEntry[];
}
