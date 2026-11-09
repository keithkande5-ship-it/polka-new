ALTER TABLE public.markets ALTER COLUMN is_public SET DEFAULT false;

DROP POLICY IF EXISTS "Public can view market comments" ON public.market_comments;
CREATE POLICY "Public can view market comments" ON public.market_comments
  FOR SELECT TO anon, authenticated
  USING (
    length(trim(text)) BETWEEN 1 AND 2000
    AND length(trim(user_handle)) BETWEEN 1 AND 40
    AND length(trim(market_id)) BETWEEN 1 AND 200
    AND EXISTS (
      SELECT 1 FROM public.markets m
      WHERE m.id = market_comments.market_id
        AND m.is_public IS TRUE
        AND m.state IN ('open', 'closed', 'proposed', 'settled')
    )
  );