import type { TsStructureResult } from '../ts-structure-result/index.ts';

/** Node of the enriched tree as the index writer reads it. */
export interface EnrichedNode {
  [key: string]: unknown;
  path?: string;
  architecture_path?: string;
  files?: string[];
  children?: EnrichedNode[];
  library_root?: boolean;
  private_root?: boolean;
  ts?: Array<{
    read?: { file?: string; file_path?: string; raw_content?: string };
    build?: TsStructureResult;
  }>;
}
