import { test } from 'vitest';
import assert from 'node:assert/strict';
import { TsAstParser } from '../../../class/strategy/ts-ast-parser/index.ts';

const astParser = new TsAstParser();
const parseExports = astParser.parseExports.bind(astParser);
const parseImports = astParser.parseImports.bind(astParser);
const { collectModuleEdges } = TsAstParser;

test('re-exports keep the barrel buckets', () => {
  const exports = parseExports(`
    export { default as Button } from './index.svelte';
    export { a, b as c, ButtonProps } from './x';
    export type { T1, T2 as T3 } from './types';
    export { type T4, d } from './mixed';
    export * from './transit';
  `);
  assert.deepEqual(exports.default, [
    { name: 'Button', from: './index.svelte' },
    { name: 'a', from: './x' },
    { name: 'c', from: './x' },
    { name: 'd', from: './mixed' },
  ]);
  assert.deepEqual(exports.interface, [{ name: 'ButtonProps', from: './x' }]);
  assert.deepEqual(exports.type, [
    { name: 'T1', from: './types' },
    { name: 'T3', from: './types' },
    { name: 'T4', from: './mixed' },
  ]);
  assert.deepEqual(exports.transit, [{ from: './transit' }]);
});

test('multi-line re-exports and comments are read as code, not text', () => {
  const exports = parseExports(`
    // export const Commented = 1;
    /* export { Hidden } from './hidden'; */
    const text = "export const InString = 1";
    export {
      Alpha,
      Beta,
    } from './greek';
  `);
  assert.deepEqual(exports.default, [
    { name: 'Alpha', from: './greek' },
    { name: 'Beta', from: './greek' },
  ]);
});

test('declarations', () => {
  const exports = parseExports(`
    export type Size<T extends string = 'md'> = T | 'lg';
    export interface IProps extends Base<{ a: 1 }> { size: Size; nested: { x: 1 } }
    export enum Kind { A = 'a', B = 'b' }
    export const enum Flag { On, Off }
    export class Manager {}
    export abstract class Base {}
    export function make(a: string): void;
    export function make(a: number): void;
    export function make(a: unknown) {}
    export async function load<T>() {}
    export const SIZES: readonly string[] = ['sm', 'md'];
    export const a = 1, b = { c: 2 };
    export let mutable;
    export const { x, y: [z] } = point;
  `);
  assert.deepEqual(exports.type, [{ name: 'Size', assign: "T | 'lg'" }]);
  assert.deepEqual(exports.interface, [
    { name: 'IProps', assign: '{ size: Size; nested: { x: 1 } }' },
  ]);
  assert.deepEqual(exports.default, [
    { name: 'Kind', from: 'enum' },
    { name: 'Flag', from: 'enum' },
    { name: 'Manager', from: 'class' },
    { name: 'Base', from: 'class' },
    { name: 'make', from: 'function' },
    { name: 'load', from: 'function' },
    { name: 'SIZES', assign: "readonly string[] = ['sm', 'md']" },
    { name: 'a', assign: '1' },
    { name: 'b', assign: '{ c: 2 }' },
    { name: 'mutable' },
    { name: 'x' },
    { name: 'z' },
  ]);
});

test('default exports use the declared name', () => {
  assert.deepEqual(
    parseExports('const Thing = 1;\nexport default Thing;').default,
    [{ name: 'Thing', from: 'default' }],
  );
  assert.deepEqual(
    parseExports('export default function render() {}').default,
    [{ name: 'render', from: 'default' }],
  );
  assert.deepEqual(parseExports('export default class Store {}').default, [
    { name: 'Store', from: 'default' },
  ]);
  assert.deepEqual(parseExports('export default { a: 1 };').default, []);
});

test('local export lists resolve the declaration kind', () => {
  const exports = parseExports(`
    import type { External } from './external';
    import { helper } from './helper';
    type Local = string;
    interface Shape { a: 1 }
    const value = 1;
    export { value, Local, Shape, External, helper as renamed };
  `);
  assert.deepEqual(exports.default, [
    { name: 'value', from: 'local' },
    { name: 'renamed', from: 'local' },
  ]);
  assert.deepEqual(exports.type, [
    { name: 'Local', from: 'local' },
    { name: 'External', from: 'local' },
  ]);
  assert.deepEqual(exports.interface, [{ name: 'Shape', from: 'local' }]);
});

test('names that cannot be re-exported by name are skipped', () => {
  const exports = parseExports(`
    export * as ns from './ns';
    export type * from './types';
    export { x as default } from './x';
    declare module 'virtual' { export const inner: string; }
  `);
  assert.deepEqual(exports, {
    default: [],
    type: [],
    transit: [],
    interface: [],
  });
});

test('imports', () => {
  const imports = parseImports(`
    import 'side-effect.css';
    import Button, { a, b as c, type T1 } from './x';
    import type { T2 as T3 } from './types';
    import type Default from './default';
    import * as ns from './ns';
    // import { Commented } from './commented';
    const lazy = await import('./lazy');
  `);
  assert.deepEqual(imports.data, [
    { name: 'Button', from: './x' },
    { name: 'a', from: './x' },
    { name: 'c', from: './x' },
    { name: 'ns', from: './ns' },
  ]);
  assert.deepEqual(imports.type, [
    { name: 'T1', from: './x' },
    { name: 'T3', from: './types' },
    { name: 'Default', from: './default' },
  ]);
});

test('module edges read every script block of a Svelte file', () => {
  const edges = collectModuleEdges(
    `<script module lang="ts">
  export { default as Inner } from './inner.svelte';
</script>
<script lang="ts">
  import { a as b, type T } from '$stylist/x';
  import Icon from './icon.svelte';
</script>
<p>import { NotCode } from './markup';</p>`,
    'c:/lib/component/atom/button/index.svelte',
  );
  assert.deepEqual(edges, [
    {
      origin: 'reexport',
      specifier: './inner.svelte',
      requested_names: [],
      exported_names: ['Inner'],
    },
    {
      origin: 'import',
      specifier: '$stylist/x',
      requested_names: ['a', 'T'],
      exported_names: [],
    },
    {
      origin: 'import',
      specifier: './icon.svelte',
      requested_names: [],
      exported_names: [],
    },
  ]);
});
