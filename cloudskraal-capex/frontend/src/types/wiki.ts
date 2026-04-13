export interface WikiPageSummary {
  id: string;
  slug: string;
  title: string;
  category: string | null;
  enterprise: string | null;
  tags: string[];
  pinned: boolean;
  created_at: string;
  updated_at: string;
  snippet?: string;
  snippet_term?: string;
  aliases?: string[];
}

export interface WikiPage extends WikiPageSummary {
  body: string;
  outgoing_links: { slug: string; title: string }[];
  backlinks: { slug: string; title: string; context?: string }[];
  broken_links: { slug: string; title: string }[];
  unlinked_mentions: { slug: string; title: string; count: number }[];
}

export interface WikiGraphData {
  nodes: { id: string; slug: string; title: string; category: string; enterprise: string; linkCount: number }[];
  edges: { source: string; target: string }[];
}

export const WIKI_CATEGORIES: Record<string, { label: string; color: string }> = {
  enterprise: { label: 'Enterprise Guide', color: '#047857' },
  process: { label: 'Processing', color: '#0369a1' },
  pest: { label: 'Pest / Disease', color: '#dc2626' },
  compliance: { label: 'Compliance', color: '#7c3aed' },
  equipment: { label: 'Equipment', color: '#d97706' },
  input: { label: 'Input Product', color: '#0d9488' },
  general: { label: 'Farm Knowledge', color: '#6b7280' },
};
