export type TechCategory = 'ai' | 'cloud' | 'devops' | 'security' | 'data' | 'web' | 'systems';
export type CareerCategory = 'trend' | 'tip' | 'stat';
export type FeedCategory = TechCategory | CareerCategory;

export interface TechNewsItem {
  id: string;
  category: TechCategory;
  headline: string;
  summary: string;
  source: string;
  sourceUrl: string;
  sourceIsSearch?: boolean;
  tags: string[];
  upvotes: number;
  comments: number;
  timeAgo: string;
  readTime: string;
}

export interface CareerIntelItem {
  id: string;
  category: CareerCategory;
  headline: string;
  summary: string;
  tags: string[];
  timeAgo: string;
  readTime: string;
}

export type TechChronicleItem = TechNewsItem | CareerIntelItem;

export function isCareerItem(item: TechChronicleItem): item is CareerIntelItem {
  return item.category === 'trend' || item.category === 'tip' || item.category === 'stat';
}
