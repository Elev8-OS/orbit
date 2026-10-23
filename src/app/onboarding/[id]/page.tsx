import { notFound } from "next/navigation";
import { getDraft, listEvents } from "@/lib/onboarding/store";
import { portalConfigured } from "@/lib/onboarding/service";
import { contactUrl, ghlConfigured } from "@/lib/offerten/ghl";
import { DraftEditor } from "@/components/onboarding/DraftEditor";

export const dynamic = "force-dynamic";

/** Prüfseite eines Onboarding-Entwurfs: Angaben prüfen, anpassen, senden oder verwerfen. */
export default async function DraftPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const draft = await getDraft(id);
  if (!draft) notFound();
  const events = await listEvents(id);
  const ghlUrl = draft.ghlContactId && ghlConfigured() ? contactUrl(draft.ghlContactId) : null;
  return (
    <div className="ob-page">
      <p className="ob-back">
        <a href="/onboarding">← Alle Entwürfe</a>
      </p>
      <DraftEditor draft={draft} events={events} ghlUrl={ghlUrl} portalReady={portalConfigured()} />
    </div>
  );
}
