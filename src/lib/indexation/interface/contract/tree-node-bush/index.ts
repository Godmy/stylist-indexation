/** Enriched tree node as read by the component dependency bushes. */
export interface TreeNodeBush {
  path?: string;
  svelte?: Array<{ read?: { file_path?: string; raw_content?: string } }>;
  ts?: Array<{ read?: { file_path?: string; raw_content?: string } }>;
  story?: Array<{ read?: { file_path?: string; raw_content?: string } }>;
  children?: TreeNodeBush[];
}
