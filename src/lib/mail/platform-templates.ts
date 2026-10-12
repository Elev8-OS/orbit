import type { Locale } from "@/i18n/config";
import { renderEmail } from "./layout";

const orbitUrl = () => process.env.AUTH_URL || "https://orbit.example.com";
const FOOTER = {
  de: "Diese E-Mail wurde von Orbit gesendet, dem Tool-Portal von Elev8.",
  en: "This email was sent by Orbit, Elev8's tool portal."
};

/** An die anfragende Person, wenn die Administration entschieden hat. */
export function accessDecisionEmail(locale: Locale, name: string, appName: string, approved: boolean, note: string | null, roleAssigned: boolean) {
  const de = locale === "de";
  const first = name.split(/\s+/)[0] || name;
  const subject = approved
    ? de
      ? `${appName} ist für dich freigeschaltet`
      : `${appName} is now enabled for you`
    : de
      ? `Deine Anfrage für ${appName}`
      : `Your request for ${appName}`;
  const body = approved
    ? roleAssigned
      ? de
        ? `Gute Nachricht: ${appName} ist für dich freigeschaltet. Melde dich in Orbit einmal ab und wieder an, dann erscheint die Kachel.`
        : `Good news: ${appName} is enabled for you. Sign out of Orbit and back in, and the tile will appear.`
      : de
        ? `Deine Anfrage für ${appName} wurde bewilligt. Die Freischaltung folgt in Kürze; danach erscheint die Kachel beim nächsten Anmelden.`
        : `Your request for ${appName} was approved. Access will be set up shortly; the tile appears the next time you sign in.`
    : de
      ? `Deine Anfrage für ${appName} wurde dieses Mal nicht bewilligt.`
      : `Your request for ${appName} was not approved this time.`;
  return {
    subject,
    ...renderEmail({
      lang: locale,
      preheader: body,
      heading: de ? `Hallo ${first}` : `Hi ${first}`,
      blocks: [{ type: "paragraph", text: body }, ...(note ? [{ type: "quote" as const, text: note }] : [])],
      cta: approved ? { label: de ? "Orbit öffnen" : "Open Orbit", url: orbitUrl() } : undefined,
      footer: FOOTER[locale]
    })
  };
}
