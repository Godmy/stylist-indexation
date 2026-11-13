/** Read result of an svg, frag or vert file. */
export interface AssetInfo {
  file: string;
  file_path: string;
  rows_count: number;
  size_bytes: number;
  raw_content: string;
}
