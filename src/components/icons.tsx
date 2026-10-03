import {
  Archive,
  BookOpen,
  BookText,
  CircleHelp,
  Clapperboard,
  Clock,
  Cuboid,
  Database,
  Download,
  Film,
  Flame,
  FolderOpen,
  Gamepad2,
  Globe,
  Image,
  Layers,
  LayoutGrid,
  Library,
  Mic,
  Music,
  Play,
  Settings2,
  Shirt,
  Sparkles,
  TrendingUp,
  Tv,
  Users,
  Video,
  Wrench
} from 'lucide-preact';
import type { ComponentType } from 'preact';

type Icon = ComponentType<{ size?: number; strokeWidth?: number; class?: string }>;

const BY_SECTION: Record<string, Icon> = {
  anime: Play,
  donghua: Tv,
  hentai: Flame,
  hentairead: Flame,
  manga: LayoutGrid,
  manhwa: Layers,
  novel: BookText,
  drama: Video,
  game: Gamepad2,
  apps: Library,
  download: Download,
  music: Music,
  schedule: Clock,
  database: Database,
  western: Globe,
  tools: Wrench,
  utils: Settings2,
  quiz: CircleHelp,
  trend: TrendingUp,
  wiki: BookOpen,
  artboard: Image,
  vtuber: Mic,
  gacha: Cuboid,
  cosplay: Shirt,
  amv: Film,
  forums: Users
};

export function SectionIcon({ id, size = 16 }: { id: string; size?: number }) {
  const Glyph = BY_SECTION[id] ?? Sparkles;
  return <Glyph size={size} strokeWidth={2} />;
}

export { Archive, Clapperboard, FolderOpen };
