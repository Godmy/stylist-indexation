import { test } from 'vitest';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { DEFAULT_INDEXATION_CONFIG } from '../../../const/object/default-indexation-config/index.ts';
import { DRY_RUN_ENV } from '../../../const/value/dry-run-env/index.ts';
import { EXCLUDE_MODULES_ENV } from '../../../const/value/exclude-modules-env/index.ts';
import { MODULES_ENV } from '../../../const/value/modules-env/index.ts';
import type { ModuleRegistry } from '../../../interface/contract/module-registry/index.ts';
import { SourceText } from '../../../class/adapter/source-text/index.ts';
import { IndexContentBuilder } from '../../../class/builder/index-content/index.ts';
import { IndexationCli } from '../../../class/facade/indexation-cli/index.ts';
import { FileEntryFactory } from '../../../class/factory/file-entry/index.ts';
import { GenerationModeRegistry } from '../../../class/registry/generation-mode/index.ts';
import { IndexationSettings } from '../../../class/registry/indexation-settings/index.ts';
import { IndexationConfigRepository } from '../../../class/repository/indexation-config/index.ts';
import { ModuleSourceRepository } from '../../../class/repository/module-source/index.ts';
import { SourceProjectRepository } from '../../../class/repository/source-project/index.ts';
import { IndexWriter } from '../../../class/visitor/index-writer/index.ts';
import { analyzeProject } from '../../../function/create/analyze-project/index.ts';

const { processNode } = IndexWriter;
const { buildGenerationConfig } = GenerationModeRegistry;
const { projectGenerationConfig, discoverProjects } = SourceProjectRepository;
const { selectModules, privateDomains, moduleDomains, sourcePath } =
  ModuleSourceRepository;
const { getSvelteInfo } = FileEntryFactory;
const { buildIndexContent } = IndexContentBuilder;
const { parseArgs, main } = IndexationCli;
const { splitLines, readText } = SourceText;

/** Library conventions of stylist-svelte that these fixtures exercise. */
const stylistSettings = {
  ...DEFAULT_INDEXATION_CONFIG,
  svgDomains: ['svg'],
  componentPrefixes: { html: 'Html' },
  componentNames: { 'html/node': 'HtmlNodeRenderer' },
  retiredMarkers: ['LANKATOUR LIB INDEX'],
  clustersOnly: true,
};
function configure(root: string, config: object): void {
  write(root, 'stylist-indexation.config.json', JSON.stringify(config));
  IndexationSettings.use(IndexationConfigRepository.load(root));
}

const envKeys = [MODULES_ENV, EXCLUDE_MODULES_ENV, DRY_RUN_ENV];
function fixture(run: (root: string) => void): void {
  const base = path.join(os.tmpdir(), 'stylist-indexation-tests');
  fs.mkdirSync(base, { recursive: true });
  const root = fs.mkdtempSync(path.join(base, 'generation-'));
  const previous = envKeys.map((key) => process.env[key]);
  envKeys.forEach((key) => {
    delete process.env[key];
  });
  IndexationSettings.use(stylistSettings);
  try {
    run(root);
  } finally {
    IndexationSettings.reset();
    envKeys.forEach((key, i) => {
      if (previous[i] === undefined) delete process.env[key];
      else process.env[key] = previous[i];
    });
    assert.equal(path.dirname(root), base);
    fs.rmSync(root, { recursive: true, force: true });
  }
}
function write(root: string, relative: string, content: string): string {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
  return target;
}
function generate(root: string, project = '.', mode = 'full'): string[] {
  const config = projectGenerationConfig(
    project,
    buildGenerationConfig(mode),
    root,
  );
  const [, tree] = analyzeProject(root, project, config);
  const updated: string[] = [];
  processNode(tree, updated, [], config);
  return updated;
}
const modules: ModuleRegistry = {
  common: {
    path: 'modules/common',
    sourceRoot: '.',
    domains: ['button', 'html', 'svg'],
  },
  travel: {
    path: 'modules/business/travel',
    sourceRoot: '.',
    domains: ['booking'],
    private: true,
  },
  geo: {
    path: 'modules/geo',
    domainRoot: true,
    private: true,
    domains: ['geo'],
  },
};
function library(root: string): void {
  fs.mkdirSync(path.join(root, 'src/lib'), { recursive: true });
  write(root, 'modules.json', JSON.stringify(modules));
  write(
    root,
    'modules/common/button/const/value/ready/index.ts',
    'export const BUTTON = true;\n',
  );
  write(
    root,
    'modules/common/button/class/manager/button/index.ts',
    'export class ButtonManager {}\n',
  );
  write(
    root,
    'modules/common/button/component/atom/button/index.svelte',
    '<button>Button</button>\n',
  );
  write(
    root,
    'modules/common/html/component/atom/button/index.svelte',
    '<button>Native</button>\n',
  );
  write(
    root,
    'modules/common/html/component/atom/node/index.svelte',
    '<div>Node</div>\n',
  );
  write(root, 'modules/common/svg/icons/arrow.svg', '<svg/>\r\n');
  write(root, 'modules/common/svg/icons/add.svg', '<svg/>\n');
  write(
    root,
    'modules/business/travel/booking/const/value/ready/index.ts',
    'export const BOOKING = true;\n',
  );
  write(
    root,
    'modules/business/travel/module.json',
    JSON.stringify({ sourceRoot: '.', domains: ['booking'], private: true }),
  );
  write(
    root,
    'modules/business/travel/svelte.config.js',
    'export default {};\n',
  );
  write(
    root,
    'modules/geo/const/value/ready/index.ts',
    'export const GEO = true;\n',
  );
}

test('module selection, private domains, exclusions and unknown module validation', () =>
  fixture((root) => {
    library(root);
    assert.deepEqual(Object.keys(selectModules(modules, 'public', '')), [
      'common',
    ]);
    assert.deepEqual(Object.keys(selectModules(modules, 'common,geo', 'geo')), [
      'common',
    ]);
    assert.throws(
      () => selectModules(modules, 'all', 'missing'),
      /Unknown modules: missing/,
    );
    assert.deepEqual(
      [...privateDomains(path.join(root, 'src/lib'))],
      ['booking', 'geo'],
    );
    assert.equal(
      moduleDomains(path.join(root, 'src/lib')).geo,
      path.join(root, 'modules/geo'),
    );
    assert.equal(
      sourcePath(
        path.join(root, 'src/lib'),
        'button/const/value/ready/index.ts',
      ),
      path.join(root, 'modules/common/button/const/value/ready/index.ts'),
    );
    assert.throws(
      () => sourcePath(path.join(root, 'src/lib'), '../secret'),
      /Invalid logical/,
    );
  }));

for (const mode of ['full', 'package'])
  test(`module roots, complete internals and repeat without changes (${mode})`, () =>
    fixture((root) => {
      library(root);
      assert.ok(generate(root, '.', mode).length);
      const publicRoot = readText(path.join(root, 'src/lib/index.ts'));
      const fullRoot = readText(path.join(root, 'src/lib/index.full.ts'));
      assert.match(publicRoot, /\.\.\/\.\.\/modules\/common\/button/);
      assert.match(publicRoot, /ButtonManager/);
      assert.match(publicRoot, /HtmlButton/);
      assert.match(publicRoot, /HtmlNodeRenderer/);
      assert.doesNotMatch(publicRoot, /BOOKING|GEO/);
      assert.match(fullRoot, /BOOKING/);
      assert.match(fullRoot, /GEO/);
      assert.match(
        readText(path.join(root, 'modules/common/svg/index.ts')),
        /\/modules\/common\/svg\/icons\/\*\.svg/,
      );
      assert.ok(!fs.existsSync(path.join(root, 'src/lib/button')));
      assert.deepEqual(generate(root, '.', mode), []);
    }));

test('public selection and exclusions preserve the full root and unselected modules', () =>
  fixture((root) => {
    library(root);
    generate(root);
    const full = fs.readFileSync(path.join(root, 'src/lib/index.full.ts'));
    const privateIndex = path.join(root, 'modules/geo/index.ts');
    fs.writeFileSync(privateIndex, 'private manual sentinel\n');
    process.env[MODULES_ENV] = 'public';
    const [, tree] = analyzeProject(root, '.', buildGenerationConfig('full'));
    assert.deepEqual(
      (tree.children as Array<{ name: string }>).map((child) => child.name),
      ['button', 'html', 'svg'],
    );
    generate(root);
    assert.deepEqual(
      fs.readFileSync(path.join(root, 'src/lib/index.full.ts')),
      full,
    );
    assert.equal(readText(privateIndex), 'private manual sentinel\n');
    process.env[MODULES_ENV] = 'all';
    process.env[EXCLUDE_MODULES_ENV] = 'travel,geo';
    generate(root);
    assert.deepEqual(
      fs.readFileSync(path.join(root, 'src/lib/index.full.ts')),
      full,
    );
  }));

test('flat private module generates both roots without config/script exports', () =>
  fixture((root) => {
    library(root);
    generate(root, 'modules/business/travel');
    for (const name of ['index.ts', 'index.full.ts']) {
      const content = readText(
        path.join(root, 'modules/business/travel', name),
      );
      assert.match(content, /BOOKING/);
      assert.match(content, /'\.\/booking'/);
      assert.doesNotMatch(content, /config|scripts/);
    }
    assert.ok(!fs.existsSync(path.join(root, 'modules/business/travel/src')));
    assert.deepEqual(generate(root, 'modules/business/travel'), []);
  }));

for (const existing of [false, true])
  test(`single domain completes value and type exports in one pass (existing root: ${existing})`, () =>
    fixture((root) => {
      write(root, 'src/lib/class/tour/index.ts', 'export class Tour {}\n');
      write(
        root,
        'src/lib/type/alias/tour-id/index.ts',
        'export type TourId = string;\n',
      );
      write(
        root,
        'src/lib/server/index.ts',
        'export const PRIVATE_SECRET = 1;\n',
      );
      if (existing) write(root, 'src/lib/index.ts', '');
      const config = projectGenerationConfig(
        '.',
        buildGenerationConfig('full'),
        root,
      );
      const [, enriched] = analyzeProject(root, '.', config);
      assert.ok(!fs.existsSync(path.join(root, 'src/lib/class/index.ts')));
      processNode(enriched, [], [], config);
      const content = readText(path.join(root, 'src/lib/index.ts'));
      assert.match(content, /export \{ Tour \} from '\.\/class';/);
      assert.match(content, /export type \{ TourId \} from '\.\/type';/);
      assert.doesNotMatch(content, /PRIVATE_SECRET/);
      assert.deepEqual(generate(root), []);
    }));

test('stories and tests remain analyzed but never appear in generated barrels', () =>
  fixture((root) => {
    for (const suffix of ['story', 'test', 'spec'])
      write(
        root,
        `src/lib/button/const/value/ready/index.${suffix}.ts`,
        `export const ${suffix.toUpperCase()} = 1;\n`,
      );
    write(
      root,
      'src/lib/button/const/value/ready/runtime.ts',
      'export const RUNTIME = 1;\n',
    );
    generate(root);
    const content = readText(path.join(root, 'src/lib/index.ts'));
    assert.match(content, /RUNTIME/);
    assert.doesNotMatch(content, /STORY|TEST|SPEC/);
  }));

test('removed source clears an empty generated joint barrel', () =>
  fixture((root) => {
    const source = write(
      root,
      'src/lib/button/const/value/ready/index.ts',
      'export const READY = true;\n',
    );
    generate(root);
    fs.unlinkSync(source);
    generate(root);
    assert.equal(
      fs.readFileSync(
        path.join(root, 'src/lib/button/const/value/index.ts'),
        'utf8',
      ),
      '',
    );
  }));

test('configured component prefixes and PascalCase naming', () =>
  fixture((root) => {
    const native = write(root, 'html/component/atom/button/index.svelte', '');
    const nested = write(
      root,
      'html/other/component/atom/button/index.svelte',
      '',
    );
    const mixed = write(root, 'button/component/atom/foo-BAR/index.svelte', '');
    assert.equal(getSvelteInfo(native).default.name, 'HtmlButton');
    assert.equal(getSvelteInfo(nested).default.name, 'Button');
    assert.equal(getSvelteInfo(mixed).default.name, 'FooBar');
  }));

test('protected section deduplication, retired headers and trailing newlines', () => {
  IndexationSettings.use(stylistSettings);
  const generated = '/** header */\nexport { A } from "./a";';
  assert.equal(
    buildIndexContent(
      { raw_content: generated },
      {
        raw_content:
          '/** AREA: LANKATOUR LIB INDEX -> AUTO-GENERATED */\nexport { A } from "./a";',
      },
    ),
    '/** AREA: STYLIST CODER MODEL -> AUTO-GENERATED */\nexport { A } from "./a";\n',
  );
  assert.equal(
    buildIndexContent(
      { raw_content: '' },
      { raw_content: 'export { MANUAL } from "./manual";' },
    ),
    '/** AREA: STYLIST CODER MODEL -> AUTO-PROTECTED */\n\nexport { MANUAL } from "./manual";\n',
  );
  assert.equal(buildIndexContent({}, {}), '\n');
  assert.deepEqual(splitLines('a\r\nb\n'), ['a', 'b']);
  assert.deepEqual(splitLines(''), []);
  IndexationSettings.reset();
});

test('configured projects, site root and private module omission', () =>
  fixture((root) => {
    library(path.join(root, 'stylist-svelte'));
    fs.mkdirSync(path.join(root, 'site/src/lib'), { recursive: true });
    fs.mkdirSync(path.join(root, 'site/no-sources'), { recursive: true });
    configure(path.join(root, 'site'), {
      projects: [
        { name: 'stylist-svelte', path: '../stylist-svelte' },
        {
          name: 'stylist-svelte-travel',
          path: '../stylist-svelte/modules/business/travel',
        },
        { name: 'site', path: '.' },
        { name: 'missing', path: 'no-sources' },
      ],
    });
    const projects = new Map(
      discoverProjects().map(([project, name]) => [name, project]),
    );
    assert.equal(
      projects.get('stylist-svelte'),
      path.join(root, 'stylist-svelte'),
    );
    assert.equal(
      projects.get('stylist-svelte-travel'),
      path.join(root, 'stylist-svelte/modules/business/travel'),
    );
    assert.equal(projects.get('site'), path.join(root, 'site'));
    assert.ok(!projects.has('missing'));
    process.env[MODULES_ENV] = 'public';
    assert.ok(
      !discoverProjects().some(([, name]) => name === 'stylist-svelte-travel'),
    );
  }));

test('split business repositories are discovered as private single-domain roots', () =>
  fixture((root) => {
    const umbrella = path.join(root, 'stylist-svelte');
    fs.mkdirSync(path.join(umbrella, 'src/lib'), { recursive: true });
    const registry: ModuleRegistry = {};
    for (const name of ['booking', 'admin', 'travel']) {
      const project = `modules/business/${name}`;
      registry[name] = {
        path: project,
        domainRoot: true,
        private: true,
        domains: [name],
      };
      write(
        umbrella,
        `${project}/module.json`,
        JSON.stringify({ sourceRoot: '.', domainRoot: true }),
      );
      write(
        umbrella,
        `${project}/const/value/ready/index.ts`,
        `export const READY = true;\n`,
      );
    }
    write(umbrella, 'modules.json', JSON.stringify(registry));
    configure(root, {
      projects: [
        { name: 'stylist-svelte', path: 'stylist-svelte' },
        ...['booking', 'admin', 'travel'].map((name) => ({
          name: `stylist-svelte-${name}`,
          path: `stylist-svelte/modules/business/${name}`,
        })),
      ],
    });
    const projects = new Map(
      discoverProjects().map(([project, name]) => [name, project]),
    );
    for (const name of ['booking', 'admin', 'travel']) {
      const project = path.join(
        root,
        `stylist-svelte/modules/business/${name}`,
      );
      assert.equal(projects.get(`stylist-svelte-${name}`), project);
      assert.equal(
        projectGenerationConfig(project, buildGenerationConfig('full'), root)
          .source_layout,
        'domain',
      );
    }
    process.env[MODULES_ENV] = 'public';
    assert.ok(
      !discoverProjects().some(([, name]) =>
        /^stylist-svelte-(booking|admin|travel)$/.test(name),
      ),
    );
  }));

test('module validation rejects duplicate domains and escaped source roots', () =>
  fixture((root) => {
    library(root);
    write(
      root,
      'modules.json',
      JSON.stringify({
        a: { path: 'modules/a', domains: ['same'] },
        b: { path: 'modules/b', domains: ['same'] },
      }),
    );
    assert.throws(
      () => moduleDomains(path.join(root, 'src/lib')),
      /Duplicate module domain/,
    );
    write(
      root,
      'modules.json',
      JSON.stringify({
        a: { path: '../outside', domainRoot: true, domains: ['a'] },
      }),
    );
    assert.throws(
      () => moduleDomains(path.join(root, 'src/lib')),
      /Module escapes package/,
    );
  }));

test('CLI check leaves source bytes untouched, reports stale files and passes after one generation', () =>
  fixture((root) => {
    library(path.join(root, 'packages/stylist-svelte'));
    write(
      root,
      'stylist-indexation.config.json',
      JSON.stringify({
        ...stylistSettings,
        outDir: undefined,
        projects: [{ name: 'stylist-svelte', path: 'packages/stylist-svelte' }],
      }),
    );
    const output = path.join(root, 'diagnostics');
    const args = ['--modules', 'public', '--projects', 'stylist-svelte'];
    assert.equal(main([...args, '--check'], root, output), 1);
    assert.ok(
      !fs.existsSync(
        path.join(root, 'packages/stylist-svelte/src/lib/index.ts'),
      ),
    );
    assert.ok(
      fs.existsSync(
        path.join(output, 'dry-run/stylist-svelte-components.json'),
      ),
    );
    assert.equal(main(args, root, output), 0);
    const target = path.join(root, 'packages/stylist-svelte/src/lib/index.ts');
    const before = fs.readFileSync(target),
      mtime = fs.statSync(target).mtimeMs;
    assert.equal(main([...args, '--check'], root, output), 0);
    assert.deepEqual(fs.readFileSync(target), before);
    assert.equal(fs.statSync(target).mtimeMs, mtime);
    assert.ok(
      !fs.existsSync(
        path.join(root, 'packages/stylist-svelte/src/lib/index.full.ts'),
      ),
    );
    assert.equal(main(['--projects', 'missing', '--check'], root, output), 1);
  }));

test('CLI defaults, equals values, dry-run implication and invalid arguments', () =>
  fixture((root) => {
    assert.equal(parseArgs(['--check']).dryRun, true);
    assert.equal(parseArgs(['--modules=public']).modules, 'public');
    assert.throws(() => parseArgs(['--dry-rnu']), /unrecognized/);
    assert.throws(() => parseArgs(['--modules']), /expected one argument/);
    assert.equal(parseArgs(['--config', 'a.json']).config, 'a.json');
    assert.equal(main(['--generation-mode', 'invalid'], root), 2);
    assert.equal(main(['--config', 'missing.json'], root), 2);
    assert.equal(main([], root, path.join(root, 'output')), 0);
    assert.ok(!fs.existsSync(path.join(root, 'output')));
  }));
