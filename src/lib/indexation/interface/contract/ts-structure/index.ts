import type { TsStructureExports } from '../../../interface/contract/ts-structure-exports/index.ts';
import type { TsStructureImports } from '../../../interface/contract/ts-structure-imports/index.ts';

/** Exports and imports from which barrel text is generated. */
export interface TsStructure {
  exports: TsStructureExports;
  imports: TsStructureImports;
}
