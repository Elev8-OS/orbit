import type { Locale } from "@/i18n/config";
import { renderEmail } from "./layout";

const orbitUrl = () => process.env.AUTH_URL || "https://orbit.example.com";

const FOOTER = {
  de: "Diese E-Mail wurde von Orbit gesendet, dem Tool-Portal von Elev8.",
  en: "This email was sent by Orbit, Elev8's tool portal."
};

export function welcomeEmail(locale: Locale, name: string, appNames: string[]) {
  const first = name.split(/\s+/)[0] || name;
  const de = locale === "de";
  return {
    subject: de ? "Dein Orbit ist bereit" : "Your Orbit is ready",
    ...renderEmail({
      lang: locale,
      preheader: de ? "Alle deine Tools, ein Login." : "All your tools, one login.",
      heading: de ? `Willkommen bei Orbit, ${first}` : `Welcome to Orbit, ${first}`,
      blocks: [
        {
          type: "paragraph",
          text: de
            ? "Ab jetzt öffnest du alle deine Tools an einem Ort – mit deinem Microsoft-Konto, ohne weitere Passwörter."
            : "From now on you open all your tools in one place – with your Microsoft account, no extra passwords."
        },
        ...(appNames.length
          ? [
              { type: "paragraph" as const, text: de ? "Für dich freigeschaltet:" : "Enabled for you:" },
              { type: "list" as const, items: appNames }
            ]
          : []),
        {
          type: "paragraph",
          text: de
            ? "Ordne die Kacheln per Drag & Drop so an, wie du arbeitest. Orbit merkt sich die Reihenfolge auf jedem Gerät."
            : "Drag the tiles into the order you work in. Orbit remembers it on every device."
        }
      ],
      cta: { label: de ? "Orbit öffnen" : "Open Orbit", url: orbitUrl() },
      footer: FOOTER[locale]
    })
  };
}

type AccessRequest = {
  requesterName: string;
  requesterEmail: string;
  appName: string;
  appId: string;
  requiredRoles: string[];
  message: string | null;
};

/** Geht an die Administration – immer in der Standardsprache von Orbit. */
export function accessRequestAdminEmail(locale: Locale, req: AccessRequest) {
  const de = locale === "de";
  return {
    subject: de ? `Zugriffsanfrage: ${req.appName} für ${req.requesterName}` : `Access request: ${req.appName} for ${req.requesterName}`,
    ...renderEmail({
      lang: locale,
      preheader: de ? `${req.requesterName} möchte ${req.appName} nutzen.` : `${req.requesterName} wants to use ${req.appName}.`,
      heading: de ? `${req.requesterName} möchte ${req.appName} nutzen` : `${req.requesterName} wants to use ${req.appName}`,
      blocks: [
        {
          type: "details",
          rows: [
            [de ? "Person" : "Person", req.requesterName],
            ["E-Mail", req.requesterEmail],
            ["App", `${req.appName} (${req.appId})`],
            [de ? "Benötigte Rolle" : "Required role", req.requiredRoles.join(", ")]
          ]
        },
        ...(req.message ? [{ type: "quote" as const, text: req.message }] : []),
        {
          type: "paragraph",
          text: de
            ? "Freigeben: Entra Admin Center → Enterprise applications → Orbit → Users and groups → Rolle zuweisen. Die Person sieht die App nach der nächsten Anmeldung. Antworte auf diese E-Mail, um die Person direkt zu erreichen."
            : "To approve: Entra admin center → Enterprise applications → Orbit → Users and groups → assign the role. The person sees the app after their next sign-in. Reply to this email to reach them directly."
        }
      ],
      cta: { label: de ? "Entra Admin Center öffnen" : "Open Entra admin center", url: "https://entra.microsoft.com/" },
      footer: FOOTER[locale]
    })
  };
}

/** Bestätigung an die anfragende Person – in ihrer Sprache. */
export function accessRequestConfirmationEmail(locale: Locale, name: string, appName: string) {
  const first = name.split(/\s+/)[0] || name;
  const de = locale === "de";
  return {
    subject: de ? `Anfrage für ${appName} erhalten` : `Request for ${appName} received`,
    ...renderEmail({
      lang: locale,
      preheader: de ? "Die Administration prüft deine Anfrage." : "Your administrator is reviewing your request.",
      heading: de ? `Danke, ${first}. Deine Anfrage ist da.` : `Thanks, ${first}. We've got your request.`,
      blocks: [
        {
          type: "paragraph",
          text: de
            ? `Die Administration prüft deinen Zugriff auf ${appName}. Sobald er freigeschaltet ist, erscheint die Kachel nach deiner nächsten Anmeldung in Orbit.`
            : `Your administrator is reviewing your access to ${appName}. Once it's enabled, the tile appears in Orbit after your next sign-in.`
        }
      ],
      cta: { label: de ? "Orbit öffnen" : "Open Orbit", url: orbitUrl() },
      footer: FOOTER[locale]
    })
  };
}
