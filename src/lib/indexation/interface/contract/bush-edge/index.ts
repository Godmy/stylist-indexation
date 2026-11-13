/** Resolved import or re-export edge of the dependency bushes. */
export interface BushEdge {
  specifier: string;
  resolved: string;
  category: string;
  origin: 'import' | 'reexport';
  requested_names: string[];
  exported_names: string[];
}
