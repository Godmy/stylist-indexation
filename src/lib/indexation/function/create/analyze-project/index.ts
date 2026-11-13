import * as path from 'node:path';
import type { AnyRecord } from '../../../type/record/any-record/index.ts';
import type { GenerationConfig } from '../../../interface/contract/generation-config/index.ts';
import { ComponentTreeBuilder } from '../../../class/builder/component-tree/index.ts';
import { GenerationModeRegistry } from '../../../class/registry/generation-mode/index.ts';
import { SourceProjectRepository } from '../../../class/repository/source-project/index.ts';
import { ComponentParser } from '../../../class/visitor/component-parser/index.ts';
import { IndexWriter } from '../../../class/visitor/index-writer/index.ts';

/** Raw and enriched trees of one source project. */
export function analyzeProject(
  projectRoot: string,
  projectName: string,
  generationConfig?: GenerationConfig,
): [AnyRecord, AnyRecord] {
  const componentsPath = path.normalize(
    SourceProjectRepository.projectSourceRoot(projectName, projectRoot),
  );

  const tree = ComponentTreeBuilder.buildComponentTree(componentsPath);
  const treeDict = ComponentTreeBuilder.treeToDict(tree);
  if (IndexWriter.isDomainLibraryRoot(tree, generationConfig))
    generationConfig = GenerationModeRegistry.buildGenerationConfig('full');

  const parser = new ComponentParser(treeDict, false, generationConfig);
  const enrichedTree = parser.traverseTreeAndExecuteAlgorithms();

  return [treeDict, enrichedTree];
}
