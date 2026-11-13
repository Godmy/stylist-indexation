/** Root domain and cluster filters of one generation mode. */
export interface IndexationMode {
  /** Root domains left out of the barrel. */
  excludedRootDomains: string[];
  /** Domain-root clusters exported by the barrel. */
  includedRootClusters: string[];
}
