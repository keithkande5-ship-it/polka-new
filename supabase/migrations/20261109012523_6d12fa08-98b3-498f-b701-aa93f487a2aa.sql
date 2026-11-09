ALTER TABLE public.eat_rounds
  ADD COLUMN IF NOT EXISTS closes_at timestamptz,
  ADD COLUMN IF NOT EXISTS yes_multiplier numeric,
  ADD COLUMN IF NOT EXISTS no_multiplier numeric;

CREATE UNIQUE INDEX IF NOT EXISTS eat_rounds_symbol_closes_at_uidx
  ON public.eat_rounds (symbol, closes_at);

DROP POLICY IF EXISTS "Public markets read" ON public.markets;
CREATE POLICY "Public markets read" ON public.markets
  FOR SELECT TO anon, authenticated
  USING (
    state IN ('open', 'closed', 'proposed', 'settled')
    AND jsonb_typeof(outcomes) = 'array'
  );

DROP POLICY IF EXISTS "Public can view EAT rounds" ON public.eat_rounds;
CREATE POLICY "Public can view EAT rounds" ON public.eat_rounds
  FOR SELECT TO anon, authenticated
  USING (
    symbol IN ('BTC', 'ETH', 'SOL')
    AND target_price > 0
    AND closes_at IS NOT NULL
    AND yes_multiplier BETWEEN 1 AND 50
    AND no_multiplier BETWEEN 1 AND 50
  );

DROP POLICY IF EXISTS "Public can view market comments" ON public.market_comments;
CREATE POLICY "Public can view market comments" ON public.market_comments
  FOR SELECT TO anon, authenticated
  USING (
    length(trim(text)) BETWEEN 1 AND 2000
    AND length(trim(user_handle)) BETWEEN 1 AND 40
    AND length(trim(market_id)) BETWEEN 1 AND 200
  );

DROP POLICY IF EXISTS "Public read settings" ON public.site_settings;
CREATE POLICY "Public read settings" ON public.site_settings
  FOR SELECT TO anon, authenticated
  USING (key IN ('community_links', 'site_links', 'global_notice', 'banner_notice', 'market_toggles', 'how_it_works'));

DROP POLICY IF EXISTS "Anyone or signed-in users can submit issues" ON public.issues;
CREATE POLICY "Anyone or signed-in users can submit issues" ON public.issues
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    category IN ('market', 'mpesa', 'bug', 'account', 'other')
    AND length(trim(description)) BETWEEN 1 AND 4000
    AND coalesce(status, 'open') = 'open'
    AND (user_id IS NULL OR user_id = auth.uid())
  );

CREATE OR REPLACE FUNCTION public.place_order(
  p_market_id text, p_outcome text, p_stake numeric, p_multiplier numeric,
  p_title text DEFAULT NULL, p_asset text DEFAULT NULL, p_round bigint DEFAULT NULL,
  p_lock numeric DEFAULT NULL, p_entry numeric DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_prof public.profiles%ROWTYPE;
  v_m public.markets%ROWTYPE;
  v_eat public.eat_rounds%ROWTYPE;
  v_outs jsonb; v_target jsonb; v_old numeric; v_new numeric; v_w numeric; v_scale numeric;
  v_max numeric; v_resolves timestamptz; v_id uuid;
  v_multiplier numeric := p_multiplier;
  v_lock numeric := p_lock;
  v_entry numeric := p_entry;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in to trade'; END IF;
  IF p_stake IS NULL OR p_stake < 10 OR p_stake > 100000 THEN RAISE EXCEPTION 'Stake must be between KES 10 and KES 100,000'; END IF;
  IF p_multiplier IS NULL OR p_multiplier < 1 THEN RAISE EXCEPTION 'Invalid price'; END IF;

  SELECT * INTO v_prof FROM public.profiles WHERE id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile missing'; END IF;
  IF v_prof.frozen THEN RAISE EXCEPTION 'Account is frozen'; END IF;
  IF v_prof.balance < p_stake THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

  IF p_market_id = 'flash' THEN
    IF p_asset IS NULL OR p_asset NOT IN ('BTC','ETH','SOL','BNB','XRP') THEN RAISE EXCEPTION 'This pair is not open for real-money trading'; END IF;
    IF p_outcome NOT IN ('UP','DOWN') THEN RAISE EXCEPTION 'Invalid side'; END IF;
    IF p_round IS NULL OR p_round <> floor(extract(epoch FROM now()) / 60)::bigint THEN RAISE EXCEPTION 'Round closed'; END IF;
    IF extract(epoch FROM now()) - p_round * 60 > 40 THEN RAISE EXCEPTION 'Round locked'; END IF;
    IF EXISTS (SELECT 1 FROM public.positions WHERE user_id = v_uid::text AND market_id = 'flash' AND round = p_round) THEN
      RAISE EXCEPTION 'One Flash trade per round';
    END IF;
    IF p_multiplier > 10 THEN RAISE EXCEPTION 'Price out of range'; END IF;
    v_resolves := to_timestamp((p_round + 1) * 60);
  ELSIF p_market_id LIKE 'eat-%' THEN
    IF p_asset IS NULL OR p_asset NOT IN ('BTC','ETH','SOL') THEN RAISE EXCEPTION 'Invalid round'; END IF;
    IF split_part(p_market_id, '-', 2) <> lower(p_asset) OR split_part(p_market_id, '-', 3) !~ '^[0-9]{10,13}$' THEN
      RAISE EXCEPTION 'Invalid round';
    END IF;
    v_resolves := to_timestamp((split_part(p_market_id, '-', 3))::bigint / 1000.0);
    IF v_resolves <= now() + interval '60 seconds' THEN RAISE EXCEPTION 'Round closed'; END IF;
    SELECT * INTO v_eat
      FROM public.eat_rounds
      WHERE symbol = p_asset AND closes_at = v_resolves AND settled IS NOT TRUE
      FOR SHARE;
    IF NOT FOUND OR v_eat.target_price <= 0 THEN RAISE EXCEPTION 'Round is not available'; END IF;
    IF p_outcome NOT IN ('Yes','No') THEN RAISE EXCEPTION 'Invalid side'; END IF;
    v_lock := v_eat.target_price;
    v_multiplier := CASE WHEN p_outcome = 'Yes' THEN v_eat.yes_multiplier ELSE v_eat.no_multiplier END;
    IF v_multiplier IS NULL OR v_multiplier < 1 OR v_multiplier > 50 THEN RAISE EXCEPTION 'Round pricing is unavailable'; END IF;
    -- Entry price is informational and must not be accepted from the caller.
    v_entry := NULL;
  ELSE
    SELECT * INTO v_m FROM public.markets WHERE id = p_market_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Market not found'; END IF;
    IF v_m.resolved OR v_m.state <> 'open' THEN RAISE EXCEPTION 'Market is closed'; END IF;
    IF v_m.closes_at IS NOT NULL AND v_m.closes_at <= now() THEN RAISE EXCEPTION 'Market is closed'; END IF;
    SELECT o INTO v_target FROM jsonb_array_elements(v_m.outcomes) o WHERE o->>'label' = p_outcome LIMIT 1;
    IF v_target IS NULL THEN RAISE EXCEPTION 'Unknown outcome'; END IF;
    IF EXISTS (SELECT 1 FROM public.positions WHERE user_id = v_uid::text AND market_id = p_market_id AND status = 'open' AND outcome <> p_outcome) THEN
      RAISE EXCEPTION 'An opposing position is already open';
    END IF;
    v_old := greatest(0.01, (v_target->>'prob')::numeric);
    v_max := round(1 / v_old, 2) + 0.02;
    IF p_multiplier > v_max THEN RAISE EXCEPTION 'Price moved, please refresh'; END IF;
    v_resolves := v_m.closes_at;
    v_w := least(0.12, p_stake / (v_m.traded + v_m.seed + p_stake + 1000));
    v_new := least(0.97, greatest(0.03, v_old + (1 - v_old) * v_w));
    v_scale := CASE WHEN v_old < 1 THEN (1 - v_new) / (1 - v_old) ELSE 1 END;
    SELECT jsonb_agg(CASE WHEN o->>'label' = p_outcome
              THEN jsonb_set(o, '{prob}', to_jsonb(round(v_new, 3)))
              ELSE jsonb_set(o, '{prob}', to_jsonb(round((o->>'prob')::numeric * v_scale, 3))) END)
      INTO v_outs FROM jsonb_array_elements(v_m.outcomes) o;
    UPDATE public.markets SET outcomes = v_outs, traded = traded + p_stake, updated_at = now() WHERE id = p_market_id;
  END IF;

  UPDATE public.profiles SET balance = balance - p_stake WHERE id = v_uid;
  INSERT INTO public.positions (user_id, market_id, outcome, stake, mult, payout, status, title, asset, round, lock_price, entry_price, resolves_at)
  VALUES (v_uid::text, p_market_id, p_outcome, p_stake, v_multiplier, round(p_stake * v_multiplier, 2), 'open',
          left(coalesce(p_title, p_market_id), 200), p_asset, p_round, v_lock, v_entry, v_resolves)
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('success', true, 'position_id', v_id);
END $$;
REVOKE EXECUTE ON FUNCTION public.place_order(text,text,numeric,numeric,text,text,bigint,numeric,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.place_order(text,text,numeric,numeric,text,text,bigint,numeric,numeric) TO authenticated;

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
  -- The fee is derived from the platform's existing withdrawal tiers. p_fee is retained only for API compatibility.
  v_fee := CASE
    WHEN p_amount < 500 THEN 22
    WHEN p_amount < 1000 THEN 28
    WHEN p_amount < 1500 THEN 33
    WHEN p_amount < 2500 THEN 40
    WHEN p_amount < 3500 THEN 43
    WHEN p_amount < 5000 THEN 50
    WHEN p_amount < 7500 THEN 60
    WHEN p_amount < 10000 THEN 65
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