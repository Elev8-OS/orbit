import { z } from "zod";
import { auth } from "@/auth";
import { requestableApps, loadAppsConfig } from "@/lib/apps";
import {
  MAX_REQUESTS_PER_HOUR,
  countRecentRequests,
  createRequest,
  deleteRequest,
  hasOpenRequest
} from "@/lib/access-requests";
import { getLocale } from "next-intl/server";
import { recipientsFromEnv, sendMail, mailConfigured } from "@/lib/mail/send";
import { accessRequestAdminEmail, accessRequestConfirmationEmail } from "@/lib/mail/templates";
import { defaultLocale, isLocale } from "@/i18n/config";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  appId: z.string().max(64),
  message: z.string().trim().max(500).optional()
});

const fail = (error: string, status: number) => Response.json({ error }, { status });

export async function POST(request: Request) {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) return fail("unauthorized", 401);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("invalid_body", 400);

  const admins = recipientsFromEnv("ORBIT_ACCESS_REQUEST_TO");
  if (!mailConfigured() || admins.length === 0) return fail("mail_not_configured", 503);

  const config = await loadAppsConfig();
  const app = requestableApps(config, user.roles).find((a) => a.id === parsed.data.appId);
  if (!app) return fail("not_requestable", 404);

  try {
    if ((await countRecentRequests(user.id)) >= MAX_REQUESTS_PER_HOUR) return fail("rate_limited", 429);
    if (await hasOpenRequest(user.id, app.id)) return fail("already_requested", 409);
  } catch (err) {
    console.error("Zugriffsanfrage – DB nicht erreichbar:", err);
    return fail("db_unavailable", 503);
  }

  const name = user.name || user.email || "Unbekannt";
  const message = parsed.data.message || null;
  const requestId = await createRequest({
    userId: user.id,
    userName: user.name ?? null,
    userEmail: user.email ?? null,
    appId: app.id,
    message
  });

  const adminMail = accessRequestAdminEmail(defaultLocale, {
    requesterName: name,
    requesterEmail: user.email ?? "–",
    appName: app.name[defaultLocale],
    appId: app.id,
    requiredRoles: app.roles,
    message
  });
  const sent = await sendMail({
    to: admins,
    replyTo: user.email ?? undefined,
    tags: [{ name: "type", value: "access_request" }],
    ...adminMail
  });
  if (!sent.ok) {
    await deleteRequest(requestId).catch(() => {});
    return fail("mail_failed", 502);
  }

  // Bestätigung an die anfragende Person (Fehler hier sind nicht kritisch)
  if (user.email) {
    const current = await getLocale();
    const locale = isLocale(current) ? current : defaultLocale;
    await sendMail({
      to: user.email,
      tags: [{ name: "type", value: "access_request_confirmation" }],
      ...accessRequestConfirmationEmail(locale, name, app.name[locale])
    });
  }

  return Response.json({ ok: true });
}
