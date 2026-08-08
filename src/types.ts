export interface MirrorLink {
  label: string;
  url: string;
}

export interface SiteItem {
  id: string;
  name: string;
  section: string;
  categoryName: string;
  positive: string[];
  negative: string[];
  info: string;
  altlinks: MirrorLink[];
  exAltlinks: MirrorLink[];
  domains: string[];
  safetyScore?: number;
  isLowSec?: boolean;
  isDead?: boolean;
  iconUrl?: string;
}

export interface SectionMeta {
  id: string;
  key: string;
  title: string;
  iconName: string;
  siteCount: number;
}


