/** One modules.json entry. */
export interface ModuleSource {
  path: string;
  domains: string[];
  sourceRoot?: string;
  domainRoot?: boolean;
  private?: boolean;
}
