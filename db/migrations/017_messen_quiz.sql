-- Messen: Quizfrage wie auf der Papierkarte, dazu Firma und PMS.
-- quiz_correct: NULL = ohne Quiz teilgenommen (ältere Leads), sonst richtig/falsch. In die Ziehung kommt nur, wer nicht falsch geantwortet hat.
ALTER TABLE messe_leads ADD COLUMN IF NOT EXISTS quiz_answer TEXT NOT NULL DEFAULT '';
ALTER TABLE messe_leads ADD COLUMN IF NOT EXISTS quiz_correct BOOLEAN;
ALTER TABLE messe_leads ADD COLUMN IF NOT EXISTS company TEXT NOT NULL DEFAULT '';
ALTER TABLE messe_leads ADD COLUMN IF NOT EXISTS pms TEXT NOT NULL DEFAULT '';
