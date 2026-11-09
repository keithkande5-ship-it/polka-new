DROP POLICY IF EXISTS "Anyone or signed-in users can submit issues" ON public.issues;
CREATE POLICY "Anyone or signed-in users can submit issues" ON public.issues
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    category IN ('market', 'mpesa', 'bug', 'account', 'other')
    AND length(trim(description)) BETWEEN 1 AND 4000
    AND coalesce(status, 'open') = 'open'
    AND (user_id IS NULL OR user_id = auth.uid())
    AND (email IS NULL OR (length(trim(email)) BETWEEN 3 AND 254 AND email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'))
    AND (reference IS NULL OR length(trim(reference)) <= 120)
    AND (contact IS NULL OR length(trim(contact)) <= 100)
    AND (page IS NULL OR (length(trim(page)) <= 200 AND page LIKE '/%' AND page NOT LIKE '//%'))
    AND (created_at IS NULL OR created_at BETWEEN now() - interval '5 minutes' AND now() + interval '5 minutes')
  );