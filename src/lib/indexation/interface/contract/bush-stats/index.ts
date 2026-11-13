/** File count, depth and categories of a bush. */
export interface BushStats {
  nodeCount: number;
  maxDepth: number;
  categories: Record<string, number>;
}
