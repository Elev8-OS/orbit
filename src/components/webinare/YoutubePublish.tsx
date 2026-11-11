"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import type { VideoFormState } from "@/app/webinare/video-actions";

/** Formular zum Hochladen des fertigen Erklärvideos auf YouTube: Sichtbarkeit, geplante Veröffentlichung, Playlist. */

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="me-btn me-btn-primary" disabled={pending}>
      {pending ? "Reiht ein …" : label}
    </button>
  );
}

export function YoutubePublish({
  webinarId,
  action,
  label,
  confirm,
  synthetic,
  playlist
}: {
  webinarId: string;
  action: (state: VideoFormState, form: FormData) => Promise<VideoFormState>;
  label: string;
  confirm?: string;
  synthetic: boolean;
  playlist: string;
}) {
  const [state, formAction] = useActionState(action, null);
  const [privacy, setPrivacy] = useState("public");
  const [local, setLocal] = useState("");
  // datetime-local hat keine Zeitzone: im Browser in einen genauen Zeitpunkt umrechnen
  const publishAt = local ? new Date(local).toISOString() : "";
  return (
    <form
      action={formAction}
      className="me-form wb-yt-form"
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={webinarId} />
      <input type="hidden" name="publishAt" value={publishAt} />
      <div className="me-row">
        <label className="me-field">
          <span>Sichtbarkeit</span>
          <select name="privacy" value={privacy} onChange={(e) => setPrivacy(e.target.value)}>
            <option value="public">Öffentlich</option>
            <option value="unlisted">Nicht gelistet (nur mit Link)</option>
            <option value="private">Privat</option>
            <option value="scheduled">Geplant veröffentlichen</option>
          </select>
        </label>
        {privacy === "scheduled" ? (
          <label className="me-field">
            <span>Veröffentlichen am</span>
            <input type="datetime-local" value={local} onChange={(e) => setLocal(e.target.value)} required />
          </label>
        ) : (
          <label className="me-field">
            <span>Playlist <em>(optional, ID oder Link)</em></span>
            <input name="playlist" defaultValue={playlist} maxLength={200} placeholder="https://www.youtube.com/playlist?list=…" />
          </label>
        )}
      </div>
      {privacy === "scheduled" && (
        <label className="me-field">
          <span>Playlist <em>(optional, ID oder Link)</em></span>
          <input name="playlist" defaultValue={playlist} maxLength={200} placeholder="https://www.youtube.com/playlist?list=…" />
        </label>
      )}
      <div className="wb-vid-checks">
        <label>
          <input className="wb-check" type="checkbox" name="synthetic" value="1" defaultChecked={synthetic} />
          <span>Als KI-bearbeitet kennzeichnen (Profistimme)</span>
        </label>
      </div>
      <div className="me-form-foot">
        <Submit label={label} />
        {state && (
          <p className={state.error ? "me-msg me-msg-error" : "me-msg me-msg-ok"} role={state.error ? "alert" : "status"}>
            {state.error ?? state.ok}
          </p>
        )}
      </div>
    </form>
  );
}
