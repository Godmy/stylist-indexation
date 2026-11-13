import type { DependencyBushes } from '../../../interface/contract/dependency-bushes/index.ts';

/** Dependency bushes without the bush trees, sorted by depth. */
export interface DependencySummary extends Omit<
  DependencyBushes,
  'components'
> {
  components: Array<Omit<DependencyBushes['components'][0], 'bush'>>;
}
