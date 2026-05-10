-- v2.16: ingredient_aliases — canonical-mapping voor receptzoek (restjes-modus).
-- Doel: 'rode uien' / 'middelgrote uien' / 'uien' worden allemaal canonical 'ui'.
-- Gebruikt door de zoek-laag in BuildView. De boodschappenlijst-aggregator
-- (lib/shopping.js) gebruikt deze tabel bewust NIET — voor inkopen blijft
-- 'rode ui' apart van 'ui' omdat het verschillende producten zijn.

CREATE TABLE IF NOT EXISTS public.ingredient_aliases (
  raw_key text PRIMARY KEY,
  canonical_key text,
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ingredient_aliases_canonical_idx
  ON public.ingredient_aliases(canonical_key);

ALTER TABLE public.ingredient_aliases ENABLE ROW LEVEL SECURITY;

-- Read voor authenticated; write alleen via service-role (admin/import).
DROP POLICY IF EXISTS "ingredient_aliases_read" ON public.ingredient_aliases;
CREATE POLICY "ingredient_aliases_read"
  ON public.ingredient_aliases
  FOR SELECT
  TO authenticated
  USING (true);
