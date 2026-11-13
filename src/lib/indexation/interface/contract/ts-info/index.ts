import type { ParsedExports } from '../../../interface/contract/parsed-exports/index.ts';
import type { ParsedImports } from '../../../interface/contract/parsed-imports/index.ts';

/** Read result of a TS file with parsed exports and imports. */
export interface TsInfo {
  file: string;
  file_path: string;
  raw_content: string;
  rows_count: number;
  exports: ParsedExports;
  imports: ParsedImports;
}
