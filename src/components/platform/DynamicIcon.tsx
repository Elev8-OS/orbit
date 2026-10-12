import { AppWindow, Bell, Building2, CircleAlert, FilePen, Inbox, LifeBuoy, ListChecks, Mail, MessageCircle, Search, ShieldCheck, Sparkles, Target, TrendingUp, ChartNoAxesCombined, Users, type LucideIcon } from "lucide-react";

/**
 * Kleine Auswahl an Icons für Suche, Mein Tag und Noah (im Browser, deshalb nicht alle Lucide-Icons).
 * Unbekannte Namen zeigen ein neutrales App-Symbol.
 */
const ICONS: Record<string, LucideIcon> = {
  AppWindow,
  Bell,
  Building2,
  ChartNoAxesCombined,
  CircleAlert,
  FilePen,
  Inbox,
  LifeBuoy,
  ListChecks,
  Mail,
  MessageCircle,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Users
};

export function DynamicIcon({ name, size = 18 }: { name?: string; size?: number }) {
  const Icon = (name && ICONS[name]) || AppWindow;
  return <Icon size={size} strokeWidth={1.75} aria-hidden="true" />;
}
