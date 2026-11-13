/** Root domain and cluster filters of one generation mode. */
export interface GenerationConfig {
  source_layout?: 'domain' | 'domains';
  generation_mode: string;
  excluded_root_domains: string[];
  included_root_clusters: string[];
}
