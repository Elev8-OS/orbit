import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { UploadForm } from "@/components/venues/UploadForm";
import { VenueShell } from "@/components/venues/VenueShell";
import { resolveBrand } from "@/lib/venues/brand";
import { getProfile } from "@/lib/venues/profile";
import { MAX_PHOTOS, countPhotos, getVenueByToken, markOpened } from "@/lib/venues/store";

export const dynamic = "force-dynamic";

// Link-Vorschau: Titel, Beschreibung und Bild kommen vom Betreiber und sind englisch. Das Bild liefert opengraph-image.tsx
// neben dieser Datei. Die Hauptvorlage von Orbit setzt sonst für jede Seite "Elev8 Orbit" und eine deutsche Beschreibung;
// darum werden Titel, Beschreibung, Sprache, App-Name und Symbol hier alle ausdrücklich überschrieben.
// metadataBase muss gesetzt sein, sonst trägt die Bildadresse localhost statt der echten Domain.
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const venue = await getVenueByToken(token).catch(() => null);
  const brand = await resolveBrand();
  const title = venue ? `${venue.spotName}: a free Instagram feature from ${brand.name}` : `Photo upload · ${brand.name}`;
  const description = venue
    ? `We send our guests to ${venue.spotName}. Add 3 to 5 photos and we feature you, tagged. Takes 2 minutes.`
    : "Add 3 to 5 photos and we feature you on our Instagram, tagged. Takes 2 minutes.";
  return {
    metadataBase: new URL((process.env.AUTH_URL ?? "https://myorbit.elev8-suite.com").replace(/\/$/, "")),
    title,
    description,
    applicationName: brand.name,
    robots: { index: false, follow: false },
    ...(brand.logoUrl ? { icons: { icon: brand.logoUrl, apple: brand.logoUrl } } : {}),
    openGraph: { title, description, type: "website", siteName: brand.name, locale: "en_US" },
    twitter: { card: "summary_large_image", title, description }
  };
}

/** Vorschau-Roboter (WhatsApp, Facebook, Slack …) holen die Seite schon beim Schreiben der Nachricht. Das ist kein Öffnen durch den Betrieb. */
const BOT = /whatsapp|facebookexternalhit|facebot|meta-externalagent|slackbot|twitterbot|linkedinbot|telegrambot|discordbot|skypeuripreview|googlebot|bingbot|bot\b|crawler|spider|preview/i;

/** Öffentlich (ohne Login): ein Betrieb lädt Fotos hoch. Zugang ist der Token im Link. Absender ist der Betreiber, nicht die Software. */
export default async function ContributePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const venue = await getVenueByToken(token);
  if (!venue) notFound();
  const agent = (await headers()).get("user-agent") ?? "";
  if (!BOT.test(agent)) await markOpened(venue.id);
  const used = await countPhotos(venue.id);
  const brand = await resolveBrand();
  // Was der Betrieb schon geschrieben hat, steht beim nächsten Öffnen wieder da. Ein Fehler hier darf die Seite nie sperren.
  const profile = await getProfile(venue.id).catch(() => ({ about: "", tip: "" }));

  return (
    <VenueShell brand={brand} label="Photo upload">
      <div className="pub-hero">
        <p className="pub-kicker">Thank you for joining in</p>
        <h1>{venue.spotName}</h1>
        <p className="pub-muted">We send our guests to {venue.spotName}. Now we would love to show you to them.</p>

        <ul className="vp-list">
          <li>
            <strong>A free feature</strong> on our Instagram{brand.instagram ? <> (@{brand.instagram})</> : null}, as one of our local tips around Pererenan and Canggu
          </li>
          <li>
            <strong>A tag to your account</strong>, so people who see the post find you
          </li>
          <li>
            <strong>It takes 2 minutes</strong>: 3 to 5 photos and a few words on each
          </li>
        </ul>

        <p className="pub-muted">
          Vertical (portrait) photos look best on Instagram. Leave a little space around what you want to show. The originals from your phone or camera are best.{" "}
          {brand.instagram ? (
            <>
              If you tag{" "}
              <a href={`https://www.instagram.com/${encodeURIComponent(brand.instagram)}/`} target="_blank" rel="noreferrer">
                @{brand.instagram}
              </a>{" "}
              in a post of your own, even better:{" "}
            </>
          ) : (
            <>If you tag us in a post of your own, even better: </>
          )}
          we keep sending guests your way. Together we are stronger. 🤝
        </p>
        <p className="pub-muted">We may invite you as a collaborator on the post, so it also appears on your profile. You decide whether to accept.</p>
      </div>
      <UploadForm token={token} venueName={venue.spotName} remaining={Math.max(0, MAX_PHOTOS - used)} prefill={{ contactName: venue.contactName, instagram: venue.instagram, about: profile.about, tip: profile.tip }} />

      {brand.whatsapp || brand.website ? (
        <p className="pub-muted" style={{ marginTop: 24 }}>
          Questions?{" "}
          {brand.whatsapp ? (
            <a href={`https://wa.me/${brand.whatsapp}`} target="_blank" rel="noreferrer">
              Message us on WhatsApp
            </a>
          ) : null}
          {brand.whatsapp && brand.website ? " · " : null}
          {brand.website ? (
            <a href={brand.website} target="_blank" rel="noreferrer">
              {brand.website.replace(/^https?:\/\//, "")}
            </a>
          ) : null}
        </p>
      ) : null}
    </VenueShell>
  );
}
