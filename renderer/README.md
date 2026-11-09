# Render-Dienst für Erklärvideos

Eigener Railway-Dienst (Wurzelverzeichnis `renderer/`). Holt Aufträge aus `webinar_videos` (status `queued`),
schneidet die Clips aus dem Bunny-Video, legt die Elev8-Einblendungen darüber und lädt MP4 und
YouTube-Vorschaubild in den Bucket. Die Schnittliste entsteht in Orbit unter `/webinare/[id]/video`.

Variablen (als Referenzen auf den Orbit-Dienst): `DATABASE_URL`, `BUNNY_CDN_HOST`, `S3_ENDPOINT`, `S3_BUCKET`,
`S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`.
Profistimme: `ELEVENLABS_API_KEY` (Referenz auf Orbit) und `ELEVENLABS_VIDEO_VOICE_ID` (eine feste Stimme für alle Erklärvideos).

Ablauf pro Auftrag:
1. Quelle: höchste Auflösung aus der Bunny-Playlist (sonst `play_720p.mp4`).
2. Prüfung: zeigt jeder Clip die Bildschirmfreigabe? Sonst Abbruch mit Hinweis (ausser „Ansicht mit Teilnehmenden zulassen“).
3. Schnittpunkte rasten auf die nächste Sprechpause (±1.2 s) ein.
4. Profistimme (Standard): ElevenLabs liest den von Claude bereinigten Sprechertext aus Orbit (ohne Füllwörter und Versprecher).
   Jede Zeile startet dort, wo sie im Original gesagt wurde; wird es eng, bis 15 % schneller, sonst läuft das Bild etwas langsamer.
   Gesprochene Zeilen liegen zwischengespeichert unter `webinare/videos/stimme/`. Mit „Originalstimme“ bleibt der Ton der Aufnahme,
   dann mit Sprecher-Kreis.
5. Eröffnung, Clips mit Kapitel und Kernaussage, Abschluss; Lautheit −16 LUFS.
6. Upload als `webinare/videos/<webinar>/v<n>.mp4` und `.png`; die vorherige Fassung wird gelöscht.

Lokal testen: `SOURCE_OVERRIDE=/pfad/aufnahme.mp4 NO_UPLOAD=1 OUT_DIR=/tmp DATABASE_URL=… node src/index.mjs`
