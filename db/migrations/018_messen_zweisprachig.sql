-- Messen: eine Messe in beiden Sprachen. prize_title/prize_detail sind Deutsch, die _en-Felder Englisch.
-- lang ist die Standardsprache (wenn weder ?lang= noch die Browsersprache passt).
ALTER TABLE messe_events ADD COLUMN IF NOT EXISTS prize_title_en TEXT NOT NULL DEFAULT '';
ALTER TABLE messe_events ADD COLUMN IF NOT EXISTS prize_detail_en TEXT NOT NULL DEFAULT '';
-- Bisher englische Messen: der Gewinn stand auf Englisch im deutschen Feld
UPDATE messe_events SET prize_title_en = prize_title, prize_detail_en = prize_detail
WHERE lang = 'en' AND prize_title_en = '' AND prize_detail_en = '';
