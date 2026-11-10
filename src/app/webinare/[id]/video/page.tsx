import { notFound } from "next/navigation";
import { currentWebinarUser, portalUrl } from "@/lib/webinare/access";
import { getWebinar } from "@/lib/webinare/store";
import { storageConfigured } from "@/lib/venues/s3";
import { formatInZone } from "@/lib/messen/time";
import { ActionButton } from "@/components/messen/MessenForms";
import { CopyField } from "@/components/webinare/CopyField";
import { VideoPlanEditor } from "@/components/webinare/VideoPlanEditor";
import { RefreshWhile } from "@/components/webinare/RefreshWhile";
import { clipsWithoutWords, emptyPlan, getVideoJob, mmss, plannedSeconds, TARGET, youtubeDescription, youtubeFallback } from "@/lib/webinare/video";
import { cancelVideoAction, cleanNarrationAction, prepareAudioAction, renderVideoAction, saveVideoPlanAction, suggestVideoPlanAction, suggestYoutubeAction } from "../../video-actions";
import "./video.css";

export const dynamic = "force-dynamic";
const ZONE = "Europe/Zurich";

const STATUS = {
  draft: { label: "Entwurf", cls: "wb-state" },
  queued: { label: "In der Warteschlange", cls: "wb-state" },
  rendering: { label: "Wird gerendert", cls: "wb-state" },
  done: { label: "Fertig", cls: "wb-state wb-state-ok" },
  failed: { label: "Fehlgeschlagen", cls: "wb-state wb-state-bad" }
} as const;

export default async function VideoPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentWebinarUser();
  if (!user) return null;
  const { id } = await params;
  const w = await getWebinar(id);
  if (!w) notFound();
  const job = await getVideoJob(w);
  const plan = job?.plan ?? emptyPlan(w);
  const ro = !user.canEdit;
  const status = job?.status ?? "draft";
  const busy = status === "queued" || status === "rendering";
  const off = w.transcriptOffsetSec;
  const lines = w.transcript.map((s) => ({ start: s.start + off, end: s.end + off, text: s.de }));
  const planned = plannedSeconds(plan);
  const hasClips = plan.chapters.some((c) => c.clips.length);
  const fileUrl = `/api/webinare/video/${w.id}?f=mp4`;
  const stale = Boolean(job?.finishedAt && job.updatedAt > job.finishedAt && status === "done");
  const hasYt = Boolean(plan.youtube.title && plan.youtube.description);
  const yt = hasYt ? plan.youtube : youtubeFallback(w, plan);
  const savedClips = Boolean(job?.plan.chapters.some((c) => c.clips.length));
  const hasNarration = plan.chapters.some((c) => c.clips.some((k) => k.lines?.length));
  const captions = job?.result?.captions ?? [];
  const preparing = job?.task !== undefined && job.task !== "render";
  const unprepared = clipsWithoutWords(plan);

  return (
    <div className="me-page">
      <RefreshWhile active={busy} />
      <header className="me-head">
        <div>
          <a href={`/webinare/${w.id}`} className="me-back">
            ← {w.titleDe}
          </a>
          <h1>Erklärvideo</h1>
          <p className="me-sub">
            Aus der Aufzeichnung ein Video von {mmss(TARGET.min)} bis {mmss(TARGET.max)} Minuten im Elev8-Design, für YouTube und die Website.
          </p>
        </div>
      </header>

      <div className="wb-steps">
        {(!w.bunnyVideoDe || !w.transcript.length || !storageConfigured()) && (
          <p className="wb-warn">
            {!w.bunnyVideoDe
              ? "Zuerst die Bunny-Video-ID im Abschnitt Aufzeichnung des Webinars eintragen."
              : !w.transcript.length
                ? "Zuerst das Transkript im Abschnitt Aufzeichnung laden. Daraus entsteht der Vorschlag für die Schnittliste."
                : "Der Datei-Speicher ist in Orbit nicht eingerichtet."}
          </p>
        )}

        <section className="me-card">
          <div className="wb-step-head">
            <h2>Schnittliste</h2>
            <span className="wb-state">{hasClips ? `${plan.chapters.length} Kapitel, Clips ${mmss(planned)}` : "Noch leer"}</span>
          </div>
          {!ro && (
            <div className="wb-actions" style={{ marginBottom: "1rem" }}>
              <ActionButton
                action={suggestVideoPlanAction}
                fields={{ id: w.id }}
                label={hasClips ? "Neuen Vorschlag von Claude" : "Vorschlag von Claude"}
                pending="Claude liest das Transkript …"
                confirm={hasClips ? "Die aktuelle Schnittliste wird durch einen neuen Vorschlag ersetzt. Fortfahren?" : undefined}
                variant={hasClips ? "secondary" : "primary"}
              />
              {plan.voice === "pro" && savedClips && !busy && (
                <ActionButton
                  action={prepareAudioAction}
                  fields={unprepared ? { id: w.id } : { id: w.id, all: "1" }}
                  label={unprepared ? "Ton bereinigen" : "Ton neu bereinigen"}
                  pending="Reiht ein …"
                  variant={unprepared ? "primary" : "secondary"}
                  confirm={unprepared ? undefined : "Alle Clips werden neu transkribiert, eigene Streichungen gehen verloren. Fortfahren?"}
                />
              )}
              {plan.voice === "script" && savedClips && (
                <ActionButton
                  action={cleanNarrationAction}
                  fields={{ id: w.id }}
                  label={hasNarration ? "Sprechertext neu bereinigen" : "Sprechertext bereinigen"}
                  pending="Claude glättet den Text …"
                  variant="secondary"
                  confirm={hasNarration ? "Der Sprechertext aller Clips wird neu erstellt, eigene Anpassungen gehen verloren. Fortfahren?" : undefined}
                />
              )}
            </div>
          )}
          {preparing && busy && (
            <div className="wb-vid-progress">
              <div className="wb-bar" aria-hidden="true">
                <span style={{ width: `${Math.max(3, job?.progress ?? 0)}%` }} />
              </div>
              <p className="me-muted">{job?.message ?? "…"}</p>
            </div>
          )}
          {preparing && !busy && job?.message && <p className={/fehlgeschlagen/i.test(job.message) ? "wb-warn" : "wb-note"}>{job.message}</p>}
          <p className="wb-hint">
            Claude wählt die Demo-Teile aus und lässt Begrüssung, Fragen zu Kundenkonten und Namen von Teilnehmenden weg. Prüfe die Auswahl am
            Transkripttext unter jedem Clip. Die Schnitte rasten beim Rendern auf die nächste Sprechpause ein. Mit der synchronen Profistimme
            transkribiert „Ton bereinigen“ jeden Clip Wort für Wort und streicht Füllwörter und Versprecher; prüfe die Streichungen unter jedem
            Clip. Die englischen Untertitel übersetzt Claude beim Rendern.
          </p>
          <VideoPlanEditor
            webinarId={w.id}
            initial={plan}
            lines={lines}
            readOnly={ro || status === "rendering"}
            action={saveVideoPlanAction}
            target={TARGET}
          />
        </section>

        <section className="me-card">
          <div className="wb-step-head">
            <h2>Video</h2>
            <span className={STATUS[status].cls}>{busy && preparing ? "Ton wird bereinigt" : STATUS[status].label}</span>
          </div>
          {busy && !preparing && (
            <div className="wb-vid-progress">
              <div className="wb-bar" aria-hidden="true">
                <span style={{ width: `${Math.max(3, job?.progress ?? 0)}%` }} />
              </div>
              <p className="me-muted">
                {job?.message ?? "…"} {status === "rendering" && `(${job?.progress ?? 0} %)`}
              </p>
            </div>
          )}
          {status === "failed" && job?.message && <p className="wb-warn">{job.message}</p>}
          {stale && <p className="wb-note">Die Schnittliste wurde nach dem letzten Rendern geändert. Für die Änderungen neu rendern.</p>}
          {status === "done" && job?.fileKey && (
            <div className="wb-vid-result">
              <video src={fileUrl} controls preload="metadata" poster={`/api/webinare/video/${w.id}?f=png`} />
              <p className="me-muted">
                {job.result ? `${mmss(job.result.durationSec)} Minuten, ${(job.result.size / 1_000_000).toFixed(0)} MB` : ""}
                {job.finishedAt ? `, gerendert ${formatInZone(job.finishedAt, ZONE)}` : ""}
              </p>
              <div className="wb-actions">
                <a className="me-btn me-btn-primary" href={`${fileUrl}&download=1`}>
                  Video herunterladen
                </a>
                <a className="me-btn me-btn-secondary" href={`/api/webinare/video/${w.id}?f=png&download=1`}>
                  YouTube-Vorschaubild
                </a>
                {captions.some((c) => c.en) && (
                  <a className="me-btn me-btn-secondary" href={`/api/webinare/video/${w.id}?f=srt&lang=en`}>
                    Untertitel Englisch (.srt)
                  </a>
                )}
                {captions.some((c) => c.de) && (
                  <a className="me-btn me-btn-secondary" href={`/api/webinare/video/${w.id}?f=srt&lang=de`}>
                    Untertitel Deutsch (.srt)
                  </a>
                )}
              </div>
              {captions.length > 0 && (
                <p className="me-muted">
                  Die Untertitel sind im MP4 als zuschaltbare Spuren enthalten. Für YouTube die .srt-Dateien in YouTube Studio unter Untertitel hochladen.
                </p>
              )}
            </div>
          )}
          {!ro && (
            <div className="wb-actions" style={{ marginTop: "1rem" }}>
              {status !== "rendering" && status !== "queued" && (
                <ActionButton
                  action={renderVideoAction}
                  fields={{ id: w.id }}
                  label={status === "done" ? "Neu rendern" : "Video rendern"}
                  pending="Reiht ein …"
                  variant={status === "done" && !stale ? "secondary" : "primary"}
                  confirm={status === "done" ? "Das bestehende Video wird ersetzt. Fortfahren?" : undefined}
                />
              )}
              {status === "queued" && <ActionButton action={cancelVideoAction} fields={{ id: w.id }} label="Zurücknehmen" pending="…" variant="secondary" />}
              <span className="me-muted">Gespeicherte Schnittliste wird gerendert. Dauer etwa das Doppelte der Videolänge.</span>
            </div>
          )}
        </section>

        <section className="me-card">
          <div className="wb-step-head">
            <h2>Für YouTube</h2>
            <span className="wb-state">{job?.result ? "Kapitelmarken aus dem fertigen Schnitt" : "Kapitelmarken geschätzt, nach dem Rendern exakt"}</span>
          </div>
          {!ro && (
            <div className="wb-actions" style={{ marginBottom: "1rem" }}>
              <ActionButton
                action={suggestYoutubeAction}
                fields={{ id: w.id }}
                label={hasYt ? "YouTube-Texte neu formulieren" : "YouTube-Texte von Claude"}
                pending="Claude schreibt …"
                variant={hasYt ? "secondary" : "primary"}
                confirm={hasYt ? "Titel, Beschreibung und Tags werden ersetzt. Fortfahren?" : undefined}
              />
              <span className="me-muted">{savedClips ? "Aus Kapiteln, Kernaussagen und dem Gesagten im gespeicherten Schnitt." : "Zuerst eine Schnittliste mit Clips speichern."}</span>
            </div>
          )}
          {!hasYt && <p className="wb-note">Noch nicht formuliert. Unten steht ein Entwurf aus den Webinar-Daten.</p>}
          <div className="wb-vid-yt">
            <CopyField label={`Titel (${yt.title.length}/100)`} text={yt.title} />
            <CopyField label="Beschreibung mit Kapiteln" text={youtubeDescription({ ...plan, youtube: yt }, job?.result ?? null, portalUrl())} rows={14} />
            <CopyField label={`Tags (${yt.tags.join(",").length}/500 Zeichen)`} text={yt.tags.join(", ")} />
          </div>
        </section>
      </div>
    </div>
  );
}
