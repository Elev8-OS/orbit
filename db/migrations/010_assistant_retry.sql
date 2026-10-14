-- E-Mail-Assistent: Mails, die wegen zu strenger Prüfung der Antwort als Fehler abgelegt wurden,
-- nochmals verarbeiten lassen. Der nächste Lauf holt sie erneut (innerhalb des Rückblicks von 48 Stunden).
DELETE FROM assistant_items WHERE status = 'error' AND error = 'Antwort des Assistenten nicht lesbar';
