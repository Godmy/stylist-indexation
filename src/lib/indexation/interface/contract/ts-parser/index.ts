import type { ParsedExports } from '../../../interface/contract/parsed-exports/index.ts';
import type { ParsedImports } from '../../../interface/contract/parsed-imports/index.ts';

/** Strategy for reading top-level exports and imports of TS code. */
export interface TsParser {
  parseExports(content: string, fileName?: string): ParsedExports;
  parseImports(content: string, fileName?: string): ParsedImports;
}
