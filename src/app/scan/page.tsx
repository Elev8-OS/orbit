import { currentScanUser } from "@/lib/scan/access";
import { Scanner } from "@/components/scan/Scanner";

export const dynamic = "force-dynamic";

export default async function ScanPage() {
  const user = await currentScanUser();
  if (!user) return null; // Layout zeigt den Hinweis
  return <Scanner />;
}
