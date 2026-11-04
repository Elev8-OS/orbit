import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicShell } from "@/components/offerten/public/PublicShell";
import { UploadForm } from "@/components/venues/UploadForm";
import { MAX_PHOTOS, countPhotos, getVenueByToken, markOpened } from "@/lib/venues/store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "The R Villas Bali – Photo upload", robots: { index: false, follow: false } };

/** Öffentlich (ohne Login): ein Betrieb lädt Fotos hoch. Zugang ist der Token im Link. */
export default async function ContributePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const venue = await getVenueByToken(token);
  if (!venue) notFound();
  await markOpened(venue.id);
  const used = await countPhotos(venue.id);

  return (
    <PublicShell label="Photo upload" meta={venue.spotName} footer="The R Villas Bali · Pererenan">
      <div className="pub-hero">
        <p className="pub-kicker">Thank you for joining in</p>
        <h1>{venue.spotName}</h1>
        <p className="pub-muted">
          We would love to show {venue.spotName} to our guests on Instagram, as one of our tips around Pererenan. Please add 3 to 5 of your best photos, ideally some in landscape and some in portrait, and a few words on what each one shows. We will tag you.
        </p>
      </div>
      <UploadForm token={token} venueName={venue.spotName} remaining={Math.max(0, MAX_PHOTOS - used)} prefill={{ contactName: venue.contactName, instagram: venue.instagram }} />
    </PublicShell>
  );
}
