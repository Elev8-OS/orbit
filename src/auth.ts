import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

/**
 * Login über Microsoft Entra ID.
 *
 * - Die App Roles des Users kommen über den "roles"-Claim im ID-Token.
 *   Sie werden beim Login ins (verschlüsselte) Session-Cookie übernommen.
 * - Rollenänderungen in Entra greifen beim nächsten Login. Die Session läuft
 *   deshalb nach 8 Stunden ab, damit entzogene Rechte zeitnah wirken.
 * - Diese Datei darf nichts Node-spezifisches importieren, weil sie auch in der
 *   Middleware (Edge Runtime) läuft.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    MicrosoftEntraID({
      // Kein Profilbild von Graph laden: hält das Cookie klein und funktioniert auch für Gäste.
      profile(profile) {
        return {
          id: (profile.oid as string | undefined) ?? profile.sub,
          name: profile.name,
          email: (profile.email as string | undefined) ?? (profile.preferred_username as string | undefined),
          image: null
        };
      }
    })
  ],
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: { signIn: "/signin", error: "/signin" },
  callbacks: {
    authorized({ auth, request }) {
      if (auth?.user) return true;
      if (request.nextUrl.pathname.startsWith("/api/")) {
        return Response.json({ error: "unauthorized" }, { status: 401 });
      }
      return false; // → Weiterleitung auf /signin
    },
    jwt({ token, profile }) {
      if (profile) {
        token.oid = (profile.oid as string | undefined) ?? token.sub ?? "";
        token.tid = (profile.tid as string | undefined) ?? "";
        token.roles = Array.isArray(profile.roles) ? (profile.roles as string[]) : [];
      }
      delete token.picture;
      return token;
    },
    session({ session, token }) {
      session.user.id = token.oid ?? token.sub ?? "";
      session.user.roles = token.roles ?? [];
      session.user.tenantId = token.tid ?? "";
      return session;
    }
  }
});
