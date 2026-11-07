-- ===== Roles =====
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('operator','finance','super_admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id)
$$;

DROP POLICY IF EXISTS "Users read own roles" ON public.user_roles;
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'super_admin'));

-- ===== Profiles =====
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS frozen boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS avatar integer,
  ADD COLUMN IF NOT EXISTS bio text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS referred_by text,
  ADD COLUMN IF NOT EXISTS prefs jsonb NOT NULL DEFAULT '{}'::jsonb;

REVOKE ALL ON public.profiles FROM anon, authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (phone, handle, display_name, avatar, bio, prefs, referred_by) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Own profile read" ON public.profiles;
DROP POLICY IF EXISTS "Own profile update" ON public.profiles;
CREATE POLICY "Own profile read" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.is_staff(auth.uid()));
CREATE POLICY "Own profile update" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- referrer may only be set once
CREATE OR REPLACE FUNCTION public.profiles_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.referred_by IS NOT NULL AND NEW.referred_by IS DISTINCT FROM OLD.referred_by THEN
    NEW.referred_by := OLD.referred_by;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS profiles_guard ON public.profiles;
CREATE TRIGGER profiles_guard BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.profiles_guard();

-- ===== Markets =====
ALTER TABLE public.markets
  ADD COLUMN IF NOT EXISTS state text NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS thumb jsonb,
  ADD COLUMN IF NOT EXISTS sport jsonb,
  ADD COLUMN IF NOT EXISTS proposed jsonb,
  ADD COLUMN IF NOT EXISTS traded numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS seed numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

GRANT SELECT ON public.markets TO anon, authenticated;
GRANT INSERT, UPDATE ON public.markets TO authenticated;
GRANT ALL ON public.markets TO service_role;
ALTER TABLE public.markets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff insert markets" ON public.markets;
DROP POLICY IF EXISTS "Staff update markets" ON public.markets;
CREATE POLICY "Staff insert markets" ON public.markets FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff update markets" ON public.markets FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- ===== Positions =====
ALTER TABLE public.positions DROP CONSTRAINT IF EXISTS positions_market_id_fkey;
ALTER TABLE public.positions
  ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS asset text,
  ADD COLUMN IF NOT EXISTS round bigint,
  ADD COLUMN IF NOT EXISTS lock_price numeric,
  ADD COLUMN IF NOT EXISTS entry_price numeric,
  ADD COLUMN IF NOT EXISTS resolves_at timestamptz,
  ADD COLUMN IF NOT EXISTS settled_at timestamptz;
CREATE INDEX IF NOT EXISTS positions_user_idx ON public.positions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS positions_market_idx ON public.positions (market_id, status);

REVOKE ALL ON public.positions FROM anon, authenticated;
GRANT SELECT ON public.positions TO authenticated;
GRANT ALL ON public.positions TO service_role;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Own positions read" ON public.positions;
CREATE POLICY "Own positions read" ON public.positions FOR SELECT TO authenticated
  USING (user_id = auth.uid()::text OR public.is_staff(auth.uid()));

-- ===== Cashier =====
ALTER TABLE public.cashier_transactions
  ADD COLUMN IF NOT EXISTS fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net numeric,
  ADD COLUMN IF NOT EXISTS reference text,
  ADD COLUMN IF NOT EXISTS palpluss_id text,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS cashier_reference_uidx ON public.cashier_transactions (reference) WHERE reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS cashier_user_idx ON public.cashier_transactions (user_id, created_at DESC);

REVOKE ALL ON public.cashier_transactions FROM anon, authenticated;
GRANT SELECT ON public.cashier_transactions TO authenticated;
GRANT ALL ON public.cashier_transactions TO service_role;
ALTER TABLE public.cashier_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Own cashier read" ON public.cashier_transactions;
CREATE POLICY "Own cashier read" ON public.cashier_transactions FOR SELECT TO authenticated
  USING (user_id = auth.uid()::text OR public.is_staff(auth.uid()));

-- ===== Vault =====
REVOKE ALL ON public.vault_ledger FROM anon, authenticated;
GRANT SELECT ON public.vault_ledger TO authenticated;
GRANT ALL ON public.vault_ledger TO service_role;
ALTER TABLE public.vault_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff vault read" ON public.vault_ledger;
CREATE POLICY "Staff vault read" ON public.vault_ledger FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public._vault_post(p_type text, p_amount numeric, p_ref text)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_bal numeric;
BEGIN
  PERFORM pg_advisory_xact_lock(4242);
  SELECT coalesce((SELECT balance_after FROM public.vault_ledger ORDER BY created_at DESC, id DESC LIMIT 1), 0) INTO v_bal;
  v_bal := v_bal + p_amount;
  INSERT INTO public.vault_ledger (entry_type, amount, ref_id, balance_after) VALUES (p_type, p_amount, p_ref, v_bal);
  RETURN v_bal;
END $$;
REVOKE EXECUTE ON FUNCTION public._vault_post(text, numeric, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.vault_topup(p_amount numeric, p_note text)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'finance') OR public.has_role(auth.uid(),'super_admin')) THEN
    RAISE EXCEPTION 'Only finance staff can move the vault';
  END IF;
  IF p_amount IS NULL OR p_amount = 0 THEN RAISE EXCEPTION 'Amount required'; END IF;
  RETURN public._vault_post('topup', p_amount, left(coalesce(p_note,'Operator top-up'), 120));
END $$;

-- ===== Notifications / issues / comments =====
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.issues
  ADD COLUMN IF NOT EXISTS reference text,
  ADD COLUMN IF NOT EXISTS page text,
  ADD COLUMN IF NOT EXISTS contact text;
GRANT INSERT ON public.issues TO anon;
GRANT SELECT, INSERT, UPDATE ON public.issues TO authenticated;
GRANT ALL ON public.issues TO service_role;
DROP POLICY IF EXISTS "Staff read issues" ON public.issues;
DROP POLICY IF EXISTS "Staff update issues" ON public.issues;
CREATE POLICY "Staff read issues" ON public.issues FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff update issues" ON public.issues FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

ALTER TABLE public.market_comments DROP CONSTRAINT IF EXISTS market_comments_market_id_fkey;
ALTER TABLE public.market_comments ADD COLUMN IF NOT EXISTS parent_id uuid;
GRANT SELECT ON public.market_comments TO anon, authenticated;
GRANT INSERT, DELETE ON public.market_comments TO authenticated;
GRANT ALL ON public.market_comments TO service_role;

GRANT SELECT ON public.eat_rounds TO anon, authenticated;
GRANT ALL ON public.eat_rounds TO service_role;
GRANT SELECT ON public.referral_commissions TO authenticated;
GRANT ALL ON public.referral_commissions TO service_role;

-- ===== Site settings =====
CREATE TABLE IF NOT EXISTS public.site_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.site_settings TO anon, authenticated;
GRANT INSERT, UPDATE ON public.site_settings TO authenticated;
GRANT ALL ON public.site_settings TO service_role;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read settings" ON public.site_settings;
DROP POLICY IF EXISTS "Staff insert settings" ON public.site_settings;
DROP POLICY IF EXISTS "Staff update settings" ON public.site_settings;
CREATE POLICY "Public read settings" ON public.site_settings FOR SELECT USING (true);
CREATE POLICY "Staff insert settings" ON public.site_settings FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff update settings" ON public.site_settings FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- ===== Order placement =====
DROP FUNCTION IF EXISTS public.place_order(text, text, numeric, numeric);
CREATE OR REPLACE FUNCTION public.place_order(
  p_market_id text, p_outcome text, p_stake numeric, p_multiplier numeric,
  p_title text DEFAULT NULL, p_asset text DEFAULT NULL, p_round bigint DEFAULT NULL,
  p_lock numeric DEFAULT NULL, p_entry numeric DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_prof public.profiles%ROWTYPE;
  v_m public.markets%ROWTYPE;
  v_outs jsonb; v_target jsonb; v_old numeric; v_new numeric; v_w numeric; v_scale numeric;
  v_max numeric; v_resolves timestamptz; v_id uuid;
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
    IF p_asset IS NULL OR p_asset NOT IN ('BTC','ETH','SOL') OR p_lock IS NULL OR p_lock <= 0 THEN RAISE EXCEPTION 'Invalid round'; END IF;
    IF p_outcome NOT IN ('Yes','No') THEN RAISE EXCEPTION 'Invalid side'; END IF;
    v_resolves := to_timestamp((split_part(p_market_id, '-', 3))::bigint / 1000.0);
    IF v_resolves <= now() + interval '60 seconds' THEN RAISE EXCEPTION 'Round closed'; END IF;
    IF p_multiplier > 50 THEN RAISE EXCEPTION 'Price out of range'; END IF;
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
    -- shift implied probability toward the bought outcome
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
  VALUES (v_uid::text, p_market_id, p_outcome, p_stake, p_multiplier, round(p_stake * p_multiplier, 2), 'open',
          left(coalesce(p_title, p_market_id), 200), p_asset, p_round, p_lock, p_entry, v_resolves)
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('success', true, 'position_id', v_id);
END $$;
REVOKE EXECUTE ON FUNCTION public.place_order(text,text,numeric,numeric,text,text,bigint,numeric,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.place_order(text,text,numeric,numeric,text,text,bigint,numeric,numeric) TO authenticated;

-- ===== Market settlement =====
DROP FUNCTION IF EXISTS public.settle_market(text, text);
CREATE OR REPLACE FUNCTION public.settle_market(p_market_id text, p_winning_outcome text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_m public.markets%ROWTYPE;
  v_paid numeric := 0; v_staked numeric := 0; v_count int := 0; v_rake numeric := 0;
  r record;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Only staff can settle markets'; END IF;
  SELECT * INTO v_m FROM public.markets WHERE id = p_market_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Market not found'; END IF;
  IF v_m.resolved THEN RAISE EXCEPTION 'Market already settled'; END IF;
  IF p_winning_outcome <> 'VOID' AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_m.outcomes) o WHERE o->>'label' = p_winning_outcome) THEN
    RAISE EXCEPTION 'Unknown outcome';
  END IF;

  FOR r IN SELECT * FROM public.positions WHERE market_id = p_market_id AND status = 'open' FOR UPDATE LOOP
    v_staked := v_staked + r.stake;
    IF p_winning_outcome = 'VOID' THEN
      UPDATE public.profiles SET balance = balance + r.stake WHERE id = r.user_id::uuid;
      UPDATE public.positions SET status = 'voided', settled_at = now() WHERE id = r.id;
      v_paid := v_paid + r.stake;
      INSERT INTO public.notifications (user_id, kind, title, body, href)
        VALUES (r.user_id::uuid, 'info', 'Market voided · stake refunded', r.title, '/market/' || p_market_id);
    ELSIF r.outcome = p_winning_outcome THEN
      UPDATE public.profiles SET balance = balance + r.payout WHERE id = r.user_id::uuid;
      UPDATE public.positions SET status = 'won', settled_at = now() WHERE id = r.id;
      v_paid := v_paid + r.payout; v_count := v_count + 1;
      INSERT INTO public.notifications (user_id, kind, title, body, href)
        VALUES (r.user_id::uuid, 'win', 'Profit · position settled', r.title, '/market/' || p_market_id);
    ELSE
      UPDATE public.positions SET status = 'lost', settled_at = now() WHERE id = r.id;
      INSERT INTO public.notifications (user_id, kind, title, body, href)
        VALUES (r.user_id::uuid, 'info', 'Loss · market settled', r.title, '/market/' || p_market_id);
    END IF;
  END LOOP;

  UPDATE public.markets SET resolved = true, state = 'settled', winning_outcome = p_winning_outcome, proposed = NULL, updated_at = now()
    WHERE id = p_market_id;
  -- house result: stakes collected minus payouts returned goes to/from the vault
  v_rake := v_staked - v_paid;
  IF v_rake <> 0 THEN PERFORM public._vault_post('settlement', v_rake, p_market_id); END IF;
  RETURN jsonb_build_object('success', true, 'winners', v_count, 'paid', v_paid, 'house', v_rake);
END $$;
REVOKE EXECUTE ON FUNCTION public.settle_market(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.settle_market(text,text) TO authenticated;

-- ===== Crypto round settlement (server oracle only) =====
CREATE OR REPLACE FUNCTION public.settle_crypto_position(p_id uuid, p_result text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.positions%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.positions WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR r.status <> 'open' THEN RETURN jsonb_build_object('skipped', true); END IF;
  IF p_result = 'void' THEN
    UPDATE public.profiles SET balance = balance + r.stake WHERE id = r.user_id::uuid;
    UPDATE public.positions SET status = 'voided', settled_at = now() WHERE id = p_id;
    INSERT INTO public.notifications (user_id, kind, title, body, href) VALUES (r.user_id::uuid, 'info', 'Round voided · stake refunded', r.title, '/flash');
  ELSIF p_result = 'won' THEN
    UPDATE public.profiles SET balance = balance + r.payout WHERE id = r.user_id::uuid;
    UPDATE public.positions SET status = 'won', settled_at = now() WHERE id = p_id;
    PERFORM public._vault_post('flash', r.stake - r.payout, p_id::text);
  ELSE
    UPDATE public.positions SET status = 'lost', settled_at = now() WHERE id = p_id;
    PERFORM public._vault_post('flash', r.stake, p_id::text);
  END IF;
  RETURN jsonb_build_object('success', true);
END $$;
REVOKE EXECUTE ON FUNCTION public.settle_crypto_position(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_crypto_position(uuid, text) TO service_role;

-- ===== Cashier: withdrawals & deposits =====
CREATE OR REPLACE FUNCTION public.request_withdrawal(p_amount numeric, p_fee numeric, p_phone text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_prof public.profiles%ROWTYPE; v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  IF p_amount IS NULL OR p_amount < 50 OR p_amount > 150000 THEN RAISE EXCEPTION 'Withdraw between KES 50 and KES 150,000'; END IF;
  IF p_fee IS NULL OR p_fee < 0 OR p_fee >= p_amount THEN RAISE EXCEPTION 'Invalid fee'; END IF;
  IF p_phone !~ '^254(7|1)[0-9]{8}$' THEN RAISE EXCEPTION 'Invalid M-Pesa number'; END IF;
  SELECT * INTO v_prof FROM public.profiles WHERE id = v_uid FOR UPDATE;
  IF v_prof.frozen THEN RAISE EXCEPTION 'Account is frozen'; END IF;
  IF v_prof.balance < p_amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
  UPDATE public.profiles SET balance = balance - p_amount WHERE id = v_uid;
  INSERT INTO public.cashier_transactions (user_id, type, amount, fee, net, phone, status, reference)
  VALUES (v_uid::text, 'withdrawal', p_amount, p_fee, p_amount - p_fee, p_phone, 'pending',
          'WD' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)))
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('success', true, 'id', v_id);
END $$;
REVOKE EXECUTE ON FUNCTION public.request_withdrawal(numeric,numeric,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_withdrawal(numeric,numeric,text) TO authenticated;

-- Staff hold / reject (refund) a withdrawal
CREATE OR REPLACE FUNCTION public.review_withdrawal(p_id uuid, p_action text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.cashier_transactions%ROWTYPE;
BEGIN
  IF NOT (public.has_role(auth.uid(),'finance') OR public.has_role(auth.uid(),'super_admin')) THEN RAISE EXCEPTION 'Finance staff only'; END IF;
  SELECT * INTO t FROM public.cashier_transactions WHERE id = p_id AND type = 'withdrawal' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Not found'; END IF;
  IF p_action = 'hold' AND t.status = 'pending' THEN
    UPDATE public.cashier_transactions SET status = 'held', reviewed_by = auth.uid(), updated_at = now() WHERE id = p_id;
  ELSIF p_action = 'resume' AND t.status = 'held' THEN
    UPDATE public.cashier_transactions SET status = 'pending', updated_at = now() WHERE id = p_id;
  ELSIF p_action = 'reject' AND t.status IN ('pending','held') THEN
    UPDATE public.profiles SET balance = balance + t.amount WHERE id = t.user_id::uuid;
    UPDATE public.cashier_transactions SET status = 'rejected', reviewed_by = auth.uid(), updated_at = now() WHERE id = p_id;
    INSERT INTO public.notifications (user_id, kind, title, body) VALUES (t.user_id::uuid, 'mpesa', 'Withdrawal declined · refunded', 'KES ' || t.amount);
  ELSE RAISE EXCEPTION 'Action not allowed in this state';
  END IF;
  RETURN jsonb_build_object('success', true);
END $$;
REVOKE EXECUTE ON FUNCTION public.review_withdrawal(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_withdrawal(uuid,text) TO authenticated;

-- Server-only: finalize a PalPluss transaction (deposit credit or payout result). Idempotent.
CREATE OR REPLACE FUNCTION public.finalize_cashier(p_id uuid, p_status text, p_receipt text, p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.cashier_transactions%ROWTYPE;
BEGIN
  SELECT * INTO t FROM public.cashier_transactions WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('skipped', 'missing'); END IF;
  IF t.status IN ('completed','failed','rejected') THEN RETURN jsonb_build_object('skipped', 'final'); END IF;
  IF t.type = 'deposit' THEN
    IF p_status = 'SUCCESS' THEN
      UPDATE public.profiles SET balance = balance + t.amount WHERE id = t.user_id::uuid;
      UPDATE public.cashier_transactions SET status = 'completed', mpesa_receipt = p_receipt, raw_payload = p_payload, updated_at = now() WHERE id = p_id;
      PERFORM public._vault_post('deposit', t.amount, coalesce(p_receipt, p_id::text));
      INSERT INTO public.notifications (user_id, kind, title, body) VALUES (t.user_id::uuid, 'mpesa', 'Deposit received', 'KES ' || t.amount || coalesce(' · ' || p_receipt, ''));
    ELSE
      UPDATE public.cashier_transactions SET status = 'failed', raw_payload = p_payload, updated_at = now() WHERE id = p_id;
    END IF;
  ELSE
    IF p_status = 'SUCCESS' THEN
      UPDATE public.cashier_transactions SET status = 'completed', mpesa_receipt = p_receipt, raw_payload = p_payload, updated_at = now() WHERE id = p_id;
      PERFORM public._vault_post('withdrawal', -t.amount, coalesce(p_receipt, p_id::text));
      INSERT INTO public.notifications (user_id, kind, title, body) VALUES (t.user_id::uuid, 'mpesa', 'Withdrawal sent', 'KES ' || coalesce(t.net, t.amount) || coalesce(' · ' || p_receipt, ''));
    ELSIF p_status IN ('FAILED','CANCELLED','REVERSED','EXPIRED') THEN
      UPDATE public.profiles SET balance = balance + t.amount WHERE id = t.user_id::uuid;
      UPDATE public.cashier_transactions SET status = 'failed', raw_payload = p_payload, updated_at = now() WHERE id = p_id;
      INSERT INTO public.notifications (user_id, kind, title, body) VALUES (t.user_id::uuid, 'mpesa', 'Withdrawal failed · refunded', 'KES ' || t.amount);
    END IF;
  END IF;
  RETURN jsonb_build_object('success', true);
END $$;
REVOKE EXECUTE ON FUNCTION public.finalize_cashier(uuid,text,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_cashier(uuid,text,text,jsonb) TO service_role;

-- ===== Risk =====
CREATE OR REPLACE FUNCTION public.set_frozen(p_user uuid, p_frozen boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Staff only'; END IF;
  UPDATE public.profiles SET frozen = p_frozen WHERE id = p_user;
  RETURN jsonb_build_object('success', true);
END $$;
REVOKE EXECUTE ON FUNCTION public.set_frozen(uuid,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_frozen(uuid,boolean) TO authenticated;

-- Profile trigger: also carry display name / referrer from sign-up metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, handle, display_name, referred_by, balance, joined_at)
  VALUES (
    new.id, new.email,
    left(regexp_replace(lower(COALESCE(new.raw_user_meta_data->>'handle', split_part(new.email, '@', 1))), '[^a-z0-9_]', '', 'g') || '_' || substr(new.id::text, 1, 4), 16),
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    NULLIF(new.raw_user_meta_data->>'referred_by', ''),
    0, now()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END $$;

-- ===== Realtime =====
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['profiles','positions','markets','market_comments','notifications','cashier_transactions','site_settings'] LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL;
    END;
  END LOOP;
END $$;