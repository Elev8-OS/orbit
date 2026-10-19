import { requireScanUser } from "@/lib/scan/access";

export const dynamic = "force-dynamic";

/**
 * Optionale Anreicherung über People Data Labs (LinkedIn-URL, Titel, Firma), wenn PDL_API_KEY gesetzt ist.
 * Body: { firstName, lastName, company, email, linkedin }. Braucht LinkedIn-URL, E-Mail oder Name + Firma.
 */
export async function POST(req: Request) {
  const guard = await requireScanUser();
  if ("response" in guard) return guard.response;
  const key = process.env.PDL_API_KEY;
  if (!key) return Response.json({ found: false, reason: "not_configured" });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const [firstName, lastName, company, email, linkedin, title] = [b.firstName, b.lastName, b.company, b.email, b.linkedin, b.title].map(s);
  if (!linkedin && !email && !(firstName && lastName && company)) return Response.json({ found: false, reason: "too_little_signal" });

  const params = new URLSearchParams();
  if (linkedin) params.set("profile", linkedin);
  if (email) params.set("email", email);
  if (firstName) params.set("first_name", firstName);
  if (lastName) params.set("last_name", lastName);
  if (company) params.set("company", company);
  if (title) params.set("job_title", title);
  params.set("min_likelihood", linkedin ? "4" : "6");
  try {
    const r = await fetch(`https://api.peopledatalabs.com/v5/person/enrich?${params}`, {
      headers: { "X-Api-Key": key, Accept: "application/json" },
      signal: AbortSignal.timeout(15_000)
    });
    if (r.status === 404) return Response.json({ found: false });
    if (!r.ok) return Response.json({ found: false, reason: `pdl_${r.status}` });
    const data = (await r.json()) as { status?: number; likelihood?: number; data?: Record<string, unknown> };
    const p = data.data;
    if (data.status !== 200 || !p) return Response.json({ found: false });
    const url = (v: unknown) => (typeof v === "string" && v ? `https://${v.replace(/^https?:\/\//, "")}` : null);
    return Response.json({
      found: true,
      likelihood: data.likelihood ?? null,
      linkedin: url(p.linkedin_url),
      title: s(p.job_title) || null,
      company: s(p.job_company_name) || null,
      industry: s(p.industry) || s(p.job_company_industry) || null,
      location: s(p.location_name) || null
    });
  } catch (err) {
    return Response.json({ found: false, reason: err instanceof Error ? err.message : "error" });
  }
}
