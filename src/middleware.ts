// Schützt alle Seiten und APIs ausser Login, Health-Check und statischen Dateien.
// Die Seiten prüfen die Session zusätzlich selbst (Defense in Depth).
export { auth as middleware } from "@/auth";

export const config = {
  matcher: ["/((?!api/auth|api/health|api/pass/jwks|api/offerten/webhooks|signin|_next/static|_next/image|favicon.ico|icon.svg|icons/).*)"]
};
