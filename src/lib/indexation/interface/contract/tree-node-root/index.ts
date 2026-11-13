import type { TreeNodeStructure } from '../../../interface/contract/tree-node-structure/index.ts';

/** Library root node that may carry module.json metadata flags. */
export interface TreeNodeRoot extends TreeNodeStructure {
  library_root?: boolean;
  domain_root?: boolean;
  private_root?: boolean;
}
