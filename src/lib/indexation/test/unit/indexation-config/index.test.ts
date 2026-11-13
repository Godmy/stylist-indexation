import { afterEach, test } from 'vitest';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { IndexationSettings } from '../../../class/registry/indexation-settings/index.ts';
import { IndexationConfigRepository } from '../../../class/repository/indexation-config/index.ts';
import { IndexationCli } from '../../../class/facade/indexation-cli/index.ts';

const { load } = IndexationConfigRepository;

function workspace(): string {
  const base = path.join(os.tmpdir(), 'stylist-indexation-tests');
  fs.mkdirSync(base, { recursive: true });
  return fs.mkdtempSync(path.join(base, 'config-'));
}
function write(root: string, relative: string, content: string): string {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
  return target;
}
const roots: string[] = [];
function fixture(): string {
  const root = workspace();
  roots.push(root);
  return root;
}
afterEach(() => {
  IndexationSettings.reset();
  for (const root of roots.splice(0))
    fs.rmSync(root, { recursive: true, force: true });
});

test('without a config file the launch directory is the only project', () => {
  const root = fixture();
  write(root, 'package.json', JSON.stringify({ name: '@acme/shop' }));
  const config = load(root);
  assert.deepEqual(config.projects, [{ name: 'shop', path: root }]);
  assert.equal(config.sourceRoot, 'src/lib');
  assert.equal(config.outDir, path.join(root, '.stylist-indexation'));
  assert.deepEqual(Object.keys(config.modes).sort(), ['full', 'package']);
});

test('extends resolves paths from each file and merges maps and projects', () => {
  const root = fixture();
  write(
    root,
    'library/stylist-indexation.config.json',
    JSON.stringify({
      projects: [
        { name: 'library', path: '.' },
        { name: 'shared', path: 'modules/shared' },
      ],
      marker: 'LIBRARY',
      componentPrefixes: { html: 'Html' },
      modes: {
        package: { excludedRootDomains: ['admin'], includedRootClusters: [] },
      },
    }),
  );
  write(
    root,
    'site/stylist-indexation.config.json',
    JSON.stringify({
      extends: '../library/stylist-indexation.config.json',
      projects: [
        { name: 'shared', path: '../library/modules/shared-v2' },
        { name: 'site', path: '.' },
      ],
      componentPrefixes: { svg: 'Svg' },
      outDir: 'reports',
    }),
  );
  const config = load(path.join(root, 'site'));
  assert.deepEqual(config.projects, [
    { name: 'library', path: path.join(root, 'library') },
    { name: 'shared', path: path.join(root, 'library/modules/shared-v2') },
    { name: 'site', path: path.join(root, 'site') },
  ]);
  assert.equal(config.marker, 'LIBRARY');
  assert.deepEqual(config.componentPrefixes, { html: 'Html', svg: 'Svg' });
  assert.deepEqual(config.modes.package.excludedRootDomains, ['admin']);
  assert.ok(config.modes.full);
  assert.equal(config.outDir, path.join(root, 'site/reports'));
});

test('invalid configurations are rejected with the file and the key', () => {
  const root = fixture();
  const file = (data: object | string): string =>
    write(
      root,
      'stylist-indexation.config.json',
      typeof data === 'string' ? data : JSON.stringify(data),
    );
  file({ sourceRot: 'src/lib' });
  assert.throws(() => load(root), /unknown key "sourceRot"/);
  file({ sourceRoot: '../outside' });
  assert.throws(() => load(root), /sourceRoot/);
  file({ projects: [{ path: '.' }] });
  assert.throws(() => load(root), /projects/);
  file({ modes: { full: { excludedRootDomains: 'server' } } });
  assert.throws(() => load(root), /modes\.full\.excludedRootDomains/);
  file('{ not json');
  assert.throws(() => load(root), /Invalid config/);
  file({ extends: './stylist-indexation.config.json' });
  assert.throws(() => load(root), /extends itself/);
  assert.throws(() => load(root, 'missing.json'), /Config not found/);
});

test('a plain SvelteKit library gets barrels without any configuration', () => {
  const root = fixture();
  write(root, 'package.json', JSON.stringify({ name: 'plain-app' }));
  write(
    root,
    'src/lib/components/Button.svelte',
    '<script lang="ts">\n  let { label }: { label: string } = $props();\n</script>\n<button>{label}</button>\n',
  );
  write(
    root,
    'src/lib/utils/format.ts',
    'export function formatPrice(v: number): string {\n  return v.toFixed(2);\n}\nexport type Price = number;\n',
  );
  write(root, 'src/lib/server/db.ts', 'export const SECRET = 1;\n');
  assert.equal(IndexationCli.main([], root), 0);
  const index = fs.readFileSync(path.join(root, 'src/lib/index.ts'), 'utf8');
  assert.match(
    index,
    /^\/\*\* AREA: STYLIST CODER MODEL -> AUTO-GENERATED \*\//,
  );
  assert.match(index, /export \{ Button \} from '\.\/components';/);
  assert.match(index, /export \{ formatPrice \} from '\.\/utils';/);
  assert.match(index, /export type \{ Price \} from '\.\/utils';/);
  assert.doesNotMatch(index, /SECRET/);
  assert.ok(
    fs.existsSync(path.join(root, '.stylist-indexation/plain-app.json')),
  );
  assert.equal(IndexationCli.main(['--check'], root), 0);
});

test('custom source root, marker and output directory', () => {
  const root = fixture();
  write(
    root,
    'stylist-indexation.config.json',
    JSON.stringify({
      sourceRoot: 'src/app',
      marker: 'ACME INDEX',
      projects: [{ name: 'app', path: '.' }],
    }),
  );
  write(root, 'src/app/utils/format.ts', 'export const PRICE = 1;\n');
  write(root, 'src/app/models/user.ts', 'export interface User {}\n');
  assert.equal(IndexationCli.main(['--out-dir', 'reports'], root), 0);
  const index = fs.readFileSync(path.join(root, 'src/app/index.ts'), 'utf8');
  assert.match(index, /^\/\*\* AREA: ACME INDEX -> AUTO-GENERATED \*\//);
  assert.match(index, /PRICE/);
  assert.match(index, /User/);
  assert.ok(fs.existsSync(path.join(root, 'reports/app.json')));
  assert.ok(!fs.existsSync(path.join(root, '.stylist-indexation')));
});

test('regeneration keeps the line endings of an existing barrel', () => {
  const root = fixture();
  write(root, 'src/lib/utils/format.ts', 'export const PRICE = 1;\n');
  write(root, 'src/lib/models/user.ts', 'export const USER = 1;\n');
  assert.equal(IndexationCli.main([], root), 0);
  const target = path.join(root, 'src/lib/index.ts');
  const lf = fs.readFileSync(target, 'utf8');
  assert.ok(!lf.includes('\r'));
  fs.writeFileSync(target, lf.replace(/\n/g, '\r\n'));
  write(root, 'src/lib/utils/extra.ts', 'export const EXTRA = 1;\n');
  assert.equal(IndexationCli.main([], root), 0);
  const crlf = fs.readFileSync(target, 'utf8');
  assert.match(crlf, /EXTRA/);
  assert.ok(crlf.includes('\r\n'));
  assert.ok(!/[^\r]\n/.test(crlf));
});
