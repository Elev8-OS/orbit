-- Vor der Korrektur (12.10.2026, 12:00 UTC) wurde die Willkommensmail als gesendet markiert,
-- auch wenn Resend noch nicht eingerichtet war. Diese Markierungen zurücksetzen,
-- damit die Mail beim nächsten Besuch nachgeholt wird.
UPDATE user_preferences
SET welcomed_at = NULL
WHERE welcomed_at < TIMESTAMPTZ '2026-10-12 12:00:00+00';
