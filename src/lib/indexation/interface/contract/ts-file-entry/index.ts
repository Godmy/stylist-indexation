import type { TsInfo } from '../../../interface/contract/ts-info/index.ts';
import type { TsMerge } from '../../../interface/contract/ts-merge/index.ts';
import type { TsStructureResult } from '../../../interface/contract/ts-structure-result/index.ts';

/** Analysis entry of a TS file: what was read, the expected barrel and their comparison. */
export interface TsFileEntry {
  read: Partial<TsInfo>;
  build?: TsStructureResult;
  merge?: TsMerge;
}
