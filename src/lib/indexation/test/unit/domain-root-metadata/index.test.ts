import { test, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { analyzeProject } from '../../../function/create/analyze-project/index.ts';
import { IndexWriter } from '../../../class/visitor/index-writer/index.ts';
import { SourceProjectRepository } from '../../../class/repository/source-project/index.ts';
import { GenerationModeRegistry } from '../../../class/registry/generation-mode/index.ts';

test('domainRoot metadata traverses clusters and repairs stale self-reexports on repeated generation', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stylist-domain-root-'));
  const write = (relative: string, content: string) => {
    const target = path.join(root, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  };
  try {
    write(
      'module.json',
      JSON.stringify({
        sourceRoot: '.',
        domainRoot: true,
        private: true,
        domains: ['sakartvelo'],
      }),
    );
    write('scripts/ignored.ts', 'export const SHOULD_NOT_EXPORT = true;');
    write('const/value/ready/index.ts', 'export const READY = true;');
    write(
      'type/alias/audience/index.ts',
      "export type Audience = 'buyer' | 'farmer';",
    );
    for (const filename of ['index.ts', 'index.full.ts'])
      write(
        filename,
        "/** AREA: STYLIST CODER MODEL -> AUTO-GENERATED */\nexport { READY } from './index.full';\n",
      );
    const config = SourceProjectRepository.projectGenerationConfig(
      '.',
      GenerationModeRegistry.buildGenerationConfig('full'),
      root,
    );
    expect(config.source_layout).toBe('domain');
    const [tree, enriched] = analyzeProject(root, '.', config);
    expect(tree.domain_root).toBe(true);
    expect(
      (tree.children as Array<{ name: string }>)
        .map((child) => child.name)
        .sort(),
    ).toEqual(['const', 'type']);
    expect(tree.files).not.toContain('index.full.ts');
    IndexWriter.processNode(enriched, [], [], config);
    const result = fs.readFileSync(path.join(root, 'index.ts'), 'utf8');
    expect(result).toContain("from './const'");
    expect(result).toContain("from './type'");
    expect(result).toContain('Audience');
    expect(result).not.toContain("from './index");
    expect(result).not.toContain('SHOULD_NOT_EXPORT');
    expect(fs.readFileSync(path.join(root, 'index.full.ts'), 'utf8')).toBe(
      result,
    );
    const [, repeated] = analyzeProject(root, '.', config);
    const updated: string[] = [];
    IndexWriter.processNode(repeated, updated, [], config);
    expect(updated).toEqual([]);
  } finally {
    if (!root.startsWith(path.join(os.tmpdir(), 'stylist-domain-root-')))
      throw new Error('Unexpected fixture root');
    fs.rmSync(root, { recursive: true, force: true });
  }
});
