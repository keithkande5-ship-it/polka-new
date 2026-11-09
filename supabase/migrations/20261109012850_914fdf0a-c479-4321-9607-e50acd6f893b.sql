ALTER TABLE public.markets
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;

ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "Public markets read" ON public.markets;
CREATE POLICY "Public markets read" ON public.markets
  FOR SELECT TO anon, authenticated
  USING (
    is_public IS TRUE
    AND state IN ('open', 'closed', 'proposed', 'settled')
    AND jsonb_typeof(outcomes) = 'array'
  );

DROP POLICY IF EXISTS "Public read settings" ON public.site_settings;
CREATE POLICY "Public read settings" ON public.site_settings
  FOR SELECT TO anon, authenticated
  USING (
    is_public IS TRUE
    AND key IN ('community_links', 'site_links', 'global_notice', 'banner_notice', 'market_toggles', 'how_it_works')
  );

CREATE OR REPLACE FUNCTION public.request_withdrawal(p_amount numeric, p_fee numeric, p_phone text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_prof public.profiles%ROWTYPE;
  v_id uuid;
  v_fee numeric;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  IF p_amount IS NULL OR p_amount < 50 OR p_amount > 150000 THEN RAISE EXCEPTION 'Withdraw between KES 50 and KES 150,000'; END IF;
  -- Match the established cashier schedule: provider tier plus KES 5 handling.
  v_fee := CASE
    WHEN p_amount < 500 THEN 16
    WHEN p_amount < 1000 THEN 22
    WHEN p_amount < 1500 THEN 28
    WHEN p_amount < 2500 THEN 33
    WHEN p_amount < 3500 THEN 40
    WHEN p_amount < 5000 THEN 43
    WHEN p_amount < 7500 THEN 50
    WHEN p_amount < 10000 THEN 60
    ELSE 75
  END;
  IF p_amount <= v_fee THEN RAISE EXCEPTION 'Withdrawal amount must exceed processing fees'; END IF;
  IF p_phone !~ '^254(7|1)[0-9]{8}$' THEN RAISE EXCEPTION 'Invalid M-Pesa number'; END IF;
  SELECT * INTO v_prof FROM public.profiles WHERE id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile missing'; END IF;
  IF v_prof.frozen THEN RAISE EXCEPTION 'Account is frozen'; END IF;
  IF v_prof.balance < p_amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
  UPDATE public.profiles SET balance = balance - p_amount WHERE id = v_uid;
  INSERT INTO public.cashier_transactions (user_id, type, amount, fee, net, phone, status, reference)
  VALUES (v_uid::text, 'withdrawal', p_amount, v_fee, p_amount - v_fee, p_phone, 'pending',
          'WD' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)))
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('success', true, 'id', v_id, 'fee', v_fee, 'net', p_amount - v_fee);
END $$;
REVOKE EXECUTE ON FUNCTION public.request_withdrawal(numeric,numeric,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_withdrawal(numeric,numeric,text) TO authenticated;