-- Miete (rent_net) und Nebenkosten (nk) pro Wohnung nachtragen (Stand Excel "Portfolio Schweiz", 28.10.2026).
-- Merge ins bestehende JSONB, andere Felder bleiben erhalten. Management-Objekte haben keine Miete und bleiben unberührt.
UPDATE portfolio_docs AS p
SET data = p.data || v.patch::jsonb,
    version = p.version + 1,
    updated_by = 'import',
    updated_at = now()
FROM (VALUES
  ('randen',    '{"rent_net":1530,"nk":150}'),
  ('cholfirst', '{"rent_net":1570,"nk":150}'),
  ('roggen',    '{"rent_net":1020}'),
  ('uetliberg', '{"rent_net":1978,"nk":145}'),
  ('zugerberg', '{"rent_net":2299,"nk":185}'),
  ('adlisberg', '{"rent_net":2299,"nk":185}'),
  ('hagen',     '{"rent_net":1720,"nk":220}'),
  ('belchen',   '{"rent_net":1250,"nk":100}'),
  ('farnsberg', '{"rent_net":1710,"nk":140}')
) AS v(doc_id, patch)
WHERE p.collection = 'objektkosten' AND p.doc_id = v.doc_id;
