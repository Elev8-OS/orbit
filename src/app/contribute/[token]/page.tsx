import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UploadForm } from "@/components/venues/UploadForm";
import { VenueShell } from "@/components/venues/VenueShell";
import { tenantBrand } from "@/lib/venues/brand";
import { MAX_PHOTOS, countPhotos, getVenueByToken, markOpened } from "@/lib/venues/store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Photo upload", robots: { index: false, follow: false } };

/** Öffentlich (ohne Login): ein Betrieb lädt Fotos hoch. Zugang ist der Token im Link. Absender ist der Betreiber, nicht die Software. */
export default async function ContributePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const venue = await getVenueByToken(token);
  if (!venue) notFound();
  await markOpened(venue.id);
  const used = await countPhotos(venue.id);
  const brand = tenantBrand();

  return (
    <VenueShell brand={brand} label="Photo upload">
      <div className="pub-hero">
        <p className="pub-kicker">Thank you for joining in</p>
        <h1>{venue.spotName}</h1>
        <p className="pub-muted">We send our guests to {venue.spotName}. Now we would love to show you to them.</p>

        <ul className="vp-list">
          <li>
            <strong>A free feature</strong> on our Instagram{brand.instagram ? <> (@{brand.instagram})</> : null}, as one of our local tips around Pererenan
          </li>
          <li>
            <strong>A tag to your account</strong>, so people who see the post find you
          </li>
          <li>
            <strong>It takes 2 minutes</strong>: 3 to 5 photos and a few words on each
          </li>
        </ul>

        <p className="pub-muted">
          Landscape and portrait photos both work, the originals from your phone or camera are best.{" "}
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
      </div>
      <UploadForm token={token} venueName={venue.spotName} remaining={Math.max(0, MAX_PHOTOS - used)} prefill={{ contactName: venue.contactName, instagram: venue.instagram }} />
    </VenueShell>
  );
}
