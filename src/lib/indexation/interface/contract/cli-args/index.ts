/** Parsed index generation command line. */
export interface CliArgs {
  generationMode: string;
  modules: string;
  excludeModules: string;
  dryRun: boolean;
  check: boolean;
  projects: string;
  /** `--config` file, empty for the default lookup. */
  config: string;
  /** `--out-dir`, empty for the configured directory. */
  outDir: string;
  help: boolean;
}
