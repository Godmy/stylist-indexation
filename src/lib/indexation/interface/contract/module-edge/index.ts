/** Static import or re-export of a module. */
export interface ModuleEdge {
  origin: 'import' | 'reexport';
  specifier: string;
  /** Imported names as declared by the target module (`a` in `import { a as b }`). */
  requested_names: string[];
  /** Names a re-export publishes (`b` in `export { a as b } from`). */
  exported_names: string[];
}
