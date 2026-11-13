import type { IndexationConfig } from '../../../interface/contract/indexation-config/index.ts';

/** Settings used when the configuration file leaves a key out. */
export const DEFAULT_INDEXATION_CONFIG: IndexationConfig = {
  projects: [],
  sourceRoot: 'src/lib',
  rootClusters: [
    'class',
    'component',
    'const',
    'data',
    'function',
    'interface',
    'type',
  ],
  serviceFolders: ['server', 'test'],
  modes: {
    full: {
      excludedRootDomains: ['server'],
      includedRootClusters: [
        'class',
        'component',
        'const',
        'data',
        'function',
        'interface',
        'type',
      ],
    },
    package: {
      excludedRootDomains: ['server'],
      includedRootClusters: ['component', 'const', 'interface', 'type'],
    },
  },
  marker: 'STYLIST CODER MODEL',
  retiredMarkers: [],
  outDir: '.stylist-indexation',
  svgDomains: [],
  componentPrefixes: {},
  componentNames: {},
  aliases: ['$lib'],
};
