import type { SvelteInfo } from '../../../interface/contract/svelte-info/index.ts';

/** Analysis entry of a Svelte file. */
export interface SvelteFileEntry {
  read: SvelteInfo;
}
