import { requireOffertenUser } from "@/lib/offerten/access";
import { DEFAULT_SETTINGS, getSettings, saveSettings, settingsSchema } from "@/lib/offerten/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const access = await requireOffertenUser();
  if ("response" in access) return access.response;
  return Response.json({ settings: await getSettings(), defaults: DEFAULT_SETTINGS });
}

export async function PUT(request: Request) {
  const access = await requireOffertenUser();
  if ("response" in access) return access.response;
  if (!access.user.canManageSettings) return Response.json({ error: "forbidden" }, { status: 403 });
  const parsed = settingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: "invalid_body", issues: parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`) },
      { status: 400 }
    );
  }
  await saveSettings(parsed.data, access.user.email || access.user.name);
  return Response.json({ settings: parsed.data });
}
