import type { ImportEntry } from '../../../interface/contract/import-entry/index.ts';

/** Barrel imports by bucket. */
export interface TsStructureImports {
  type?: ImportEntry[];
  data?: ImportEntry[];
}
