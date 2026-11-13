import type { BushEdge } from '../../../interface/contract/bush-edge/index.ts';

/** File of the dependency bush graph with its edges. */
export interface BushGraphNode {
  edges: BushEdge[];
}
