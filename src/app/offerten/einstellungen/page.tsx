import { currentOffertenUser } from "@/lib/offerten/access";
import { DEFAULT_SETTINGS, getSettings } from "@/lib/offerten/settings";
import { SettingsEditor } from "@/components/offerten/SettingsEditor";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await currentOffertenUser();
  if (!user) return null;
  return <SettingsEditor initial={await getSettings()} defaults={DEFAULT_SETTINGS} canEdit={user.canManageSettings} />;
}
