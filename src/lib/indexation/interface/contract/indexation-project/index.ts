/** Source project indexed by one run. */
export interface IndexationProject {
  /** Name used by `--projects` and the diagnostics file names. */
  name: string;
  /** Project directory; absolute once the configuration is loaded. */
  path: string;
}
