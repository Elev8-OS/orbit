import { cache } from "react";
import { cookies, headers } from "next/headers";
import { auth } from "@/auth";
import { hasOffertenAccess } from "@/lib/offerten/access";
import { currentSalesUser } from "./access";
import * as ghl from "./ghl";
import { resolveViewer, validTimeZone } from "./service";

/** Cookie mit der GHL-User-ID, deren Ansicht ein Manager gerade geöffnet hat. */
export const VIEW_AS_COOKIE = "SALES_VIEW_AS";

/** Für Seiten: angemeldeter Sales-User, zugeordneter GHL-User und ob Offerten erlaubt sind. Pro Request einmal. */
export const pageContext = cache(async () => {
  const user = await currentSalesUser();
  if (!user) return { user: null } as const;
  const roles = (await auth())?.user?.roles ?? [];
  const as = user.isManager ? (await cookies()).get(VIEW_AS_COOKIE)?.value ?? null : null;
  const result = await resolveViewer(user, as).catch((err) => {
    console.error("Sales: GHL-User nicht ermittelt:", err);
    return { ok: false as const, reason: "ghl_failed" as const, email: user.email };
  });
  const team = user.isManager && result.ok ? await ghl.listUsers().catch(() => []) : [];
  const embedded = (await headers()).get("sec-fetch-dest") === "iframe";
  const timeZone = validTimeZone((await cookies()).get("SALES_TZ")?.value);
  return { user, result, team, canOffer: hasOffertenAccess(roles), embedded, timeZone } as const;
});
