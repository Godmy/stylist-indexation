/** Directory tree of a source root, with module checkouts projected onto logical domains. */
export interface ComponentTree {
  export_from?: string;
  architecture_path?: string;
  library_root?: boolean;
  domain_root?: boolean;
  private_root?: boolean;
  name: string;
  path: string;
  children: ComponentTree[];
  files: string[];
}
