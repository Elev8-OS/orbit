import { icons, type LucideIcon } from "lucide-react";

/**
 * Rendert das Icon einer App auf dem Server, damit nicht alle Lucide-Icons im Browser landen.
 * "icon" ist entweder ein Lucide-Name (z.B. "TrendingUp") oder ein Pfad/URL zu einem Bild.
 */
export function AppIcon({ icon }: { icon: string }) {
  if (icon.startsWith("/") || icon.startsWith("https://")) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={icon} alt="" width={22} height={22} />;
  }
  const Icon: LucideIcon = (icons as Record<string, LucideIcon>)[icon] ?? icons.AppWindow;
  return <Icon size={22} strokeWidth={1.75} aria-hidden="true" />;
}
