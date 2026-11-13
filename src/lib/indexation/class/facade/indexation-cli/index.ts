import * as fs from 'node:fs';
import * as path from 'node:path';
import { CONFIG_FILE_NAME } from '../../../const/value/config-file-name/index.ts';
import { DRY_RUN_ENV } from '../../../const/value/dry-run-env/index.ts';
import { EXCLUDE_MODULES_ENV } from '../../../const/value/exclude-modules-env/index.ts';
import { MODULES_ENV } from '../../../const/value/modules-env/index.ts';
import type { CliArgs } from '../../../interface/contract/cli-args/index.ts';
import { SourceText } from '../../../class/adapter/source-text/index.ts';
import { GenerationModeRegistry } from '../../../class/registry/generation-mode/index.ts';
import { IndexationSettings } from '../../../class/registry/indexation-settings/index.ts';
import { IndexationConfigRepository } from '../../../class/repository/indexation-config/index.ts';
import { SourceProjectRepository } from '../../../class/repository/source-project/index.ts';
import { IndexWriter } from '../../../class/visitor/index-writer/index.ts';
import { analyzeProject } from '../../../function/create/analyze-project/index.ts';

/** Command line entry of the index generation. */
export class IndexationCli {
  static parseArgs(argv: string[]): CliArgs {
    const result: CliArgs = {
      generationMode: 'full',
      modules: 'all',
      excludeModules: '',
      dryRun: false,
      check: false,
      projects: '',
      config: '',
      outDir: '',
      help: false,
    };
    const values: Record<string, keyof CliArgs> = {
      '--generation-mode': 'generationMode',
      '--modules': 'modules',
      '--exclude-modules': 'excludeModules',
      '--projects': 'projects',
      '--config': 'config',
      '--out-dir': 'outDir',
    };
    for (let i = 0; i < argv.length; i++) {
      const [flag, ...tail] = argv[i].split('=');
      if (flag in values) {
        const value = tail.length ? tail.join('=') : argv[++i];
        if (value === undefined || value.startsWith('--'))
          throw new Error(`argument ${flag}: expected one argument`);
        (result as unknown as Record<string, unknown>)[values[flag]] = value;
      } else if (
        ['--dry-run', '--check', '--help', '-h'].includes(flag) &&
        !tail.length
      ) {
        if (flag === '--dry-run') result.dryRun = true;
        else if (flag === '--check') result.check = true;
        else result.help = true;
      } else throw new Error(`unrecognized arguments: ${argv[i]}`);
    }
    if (result.check) result.dryRun = true;
    return result;
  }

  /**
   * Runs the generation from `projectRoot`; `outputBase` overrides the
   * configured diagnostics directory. Returns the process exit code.
   */
  static main(
    argv: string[],
    projectRoot: string,
    outputBase?: string,
  ): number {
    let args: CliArgs;
    try {
      args = IndexationCli.parseArgs(argv);
    } catch (error) {
      console.error(`Error: ${(error as Error).message}`);
      return 2;
    }
    if (args.help) {
      console.log(
        [
          'Generate index.ts barrels and the enriched export/dependency tree.',
          '',
          `--config <file>            Configuration (default: ./${CONFIG_FILE_NAME})`,
          '--out-dir <dir>            Diagnostics directory (default: config outDir)',
          '--generation-mode <mode>   Configured mode, full by default',
          '--modules all|public|name,...',
          '--exclude-modules name,...',
          '--projects name,...',
          '--dry-run                  Report changes without writing source files',
          '--check                    Dry run; exit 1 when generated files are stale',
        ].join('\n'),
      );
      return 0;
    }
    try {
      IndexationSettings.use(
        IndexationConfigRepository.load(projectRoot, args.config || undefined),
      );
    } catch (error) {
      console.error(`Error: ${(error as Error).message}`);
      return 2;
    }
    const modes = GenerationModeRegistry.getGenerationModes();
    if (!modes.includes(args.generationMode)) {
      console.error(
        `Error: argument --generation-mode: invalid choice: '${args.generationMode}' (choose from ${modes.join(', ')})`,
      );
      return 2;
    }
    const base =
      outputBase ??
      (args.outDir
        ? path.resolve(projectRoot, args.outDir)
        : IndexationSettings.config.outDir);
    const config = GenerationModeRegistry.buildGenerationConfig(
      args.generationMode,
    );
    process.env[MODULES_ENV] = args.modules;
    process.env[EXCLUDE_MODULES_ENV] = args.excludeModules;
    process.env[DRY_RUN_ENV] = args.dryRun ? '1' : '';
    const output = args.dryRun ? path.join(base, 'dry-run') : base;
    try {
      let projects = SourceProjectRepository.discoverProjects();
      if (args.projects) {
        const wanted = new Set(
          args.projects
            .split(',')
            .map((name) => name.trim())
            .filter(Boolean),
        );
        const unknown = [...wanted]
          .filter((name) => !projects.some(([, basename]) => name === basename))
          .sort(SourceText.compareText);
        if (unknown.length) {
          console.error(
            `Error: projects not found from ${projectRoot}: ${unknown.join(', ')}`,
          );
          return 1;
        }
        projects = projects.filter(([, name]) => wanted.has(name));
      }
      const updated: string[] = [],
        unchanged: string[] = [];
      console.log(
        `Index generation mode: ${config.generation_mode} (excluded root domains: ${config.excluded_root_domains.join(', ')}; included root clusters: ${config.included_root_clusters.join(', ')})`,
      );
      console.log(
        `Module selection: ${args.modules}${args.excludeModules ? ` excluding ${args.excludeModules}` : ''}${args.dryRun ? ' [dry run: no files written]' : ''}`,
      );
      if (!projects.length) {
        console.log(
          `No project with a ${IndexationSettings.sourceRoot()} directory found; skipping index generation.`,
        );
        return 0;
      }
      for (const [project, basename] of projects) {
        const sourceConfig = SourceProjectRepository.projectGenerationConfig(
          project,
          config,
          projectRoot,
        );
        console.log(
          `Start index.ts generation in components tree: ${SourceProjectRepository.projectSourceRoot(project, projectRoot)}`,
        );
        const [tree, enriched] = analyzeProject(
          projectRoot,
          project,
          sourceConfig,
        );
        IndexationCli.saveAnalysis(output, basename, tree, enriched);
        IndexWriter.processNode(enriched, updated, unchanged, sourceConfig);
      }
      const lines = [
        `Index.ts generation summary:${args.dryRun ? ' (dry run)' : ''}`,
      ];
      if (!updated.length) lines.push('No generated index.ts files');
      else
        for (const target of [...updated].sort(SourceText.compareText))
          lines.push(
            `[+] [${args.dryRun ? 'Would generate' : 'Generated'}](${path.relative(projectRoot, target).replace(/\\/g, '/')})`,
          );
      for (const line of lines) console.log(line);
      console.log('\nAnalysis completed successfully!');
      const target = path.join(output, 'result.md');
      fs.mkdirSync(output, { recursive: true });
      fs.writeFileSync(
        target,
        '# Index.ts Generation Summary\n\n' +
          lines.join('\n') +
          `\n\nResult file saved at: ${target}\nAnalysis completed successfully!\n`,
        'utf8',
      );
      console.log(`Result file saved at: ${target}`);
      if (args.check && updated.length) {
        console.log(
          `Check failed: ${updated.length} generated file(s) are stale. Run the generation without --check.`,
        );
        return 1;
      }
      return 0;
    } catch (error) {
      console.error(`Error: ${(error as Error).message}`);
      return 1;
    }
  }

  private static saveAnalysis(
    output: string,
    basename: string,
    tree: object,
    enriched: object,
  ): void {
    fs.mkdirSync(output, { recursive: true });
    for (const [filename, data, label] of [
      [`${basename}-components.json`, tree, 'Original tree'],
      [`${basename}.json`, enriched, 'Parser results (enriched tree)'],
    ] as const) {
      const target = path.join(output, filename);
      fs.writeFileSync(target, JSON.stringify(data, null, 2) + '\n', 'utf8');
      console.log(`${label} saved to: ${target}`);
    }
  }
}
