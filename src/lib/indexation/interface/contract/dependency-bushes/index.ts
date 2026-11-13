import type { BushNode } from '../../../interface/contract/bush-node/index.ts';

/** Dependency bushes of all component entries. */
export interface DependencyBushes {
  root_path: string;
  max_depth_limit: number;
  components_count: number;
  components: Array<{
    component: string;
    nodes_count: number;
    max_depth: number;
    categories: Record<string, number>;
    bush: BushNode;
  }>;
}
