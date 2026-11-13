import type { SvelteDefault } from '../../../interface/contract/svelte-default/index.ts';

/** Read result of a Svelte file with its component name. */
export interface SvelteInfo {
  file: string;
  file_path: string;
  raw_content: string;
  line_count: number;
  default: SvelteDefault;
}
