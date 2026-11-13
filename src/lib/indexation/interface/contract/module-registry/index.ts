import type { ModuleSource } from '../../../interface/contract/module-source/index.ts';

/** Entries of modules.json by module name. */
export interface ModuleRegistry {
  [name: string]: ModuleSource;
}
