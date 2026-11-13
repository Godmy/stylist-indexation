/** Node of a component dependency bush. */
export interface BushNode {
  id: string;
  kind: string;
  category: string;
  depth: number;
  via?: string;
  truncated?: string;
  children: BushNode[];
}
