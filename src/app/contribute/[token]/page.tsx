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
        <p className="pub-muted">
          We send our guests to {venue.spotName}, and we would love to show you to them on Instagram as one of our tips around Pererenan. Please add 3 to 5 of your best photos, ideally some in landscape and some in portrait, and a few words on what each one shows. We will tag you.
        </p>
        <p className="pub-muted">
          {brand.instagram ? (
            <>
              We are{" "}
              <a href={`https://www.instagram.com/${encodeURIComponent(brand.instagram)}/`} target="_blank" rel="noreferrer">
                @{brand.instagram}
              </a>{" "}
              on Instagram.{" "}
            </>
          ) : null}
          Since we actively send guests your way, we would be happy if you tagged us in a post too. Together we are stronger. 🤝
        </p>
      </div>
      <UploadForm token={token} venueName={venue.spotName} remaining={Math.max(0, MAX_PHOTOS - used)} prefill={{ contactName: venue.contactName, instagram: venue.instagram }} />
    </VenueShell>
  );
}
