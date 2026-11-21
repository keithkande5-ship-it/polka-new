import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useRef,
  type ReactNode,
} from "react";
import type React from "react";
import { toast } from "sonner";
import { canBuy, DEFAULT_RAKE, isZeroFeeActive, tradeCommission } from "./trading-rules";
import { applyTradeShift, fmtKES, getMarket } from "./markets";
import { recordCommission } from "./referrals";
import { track } from "./analytics";
import { newProfile, type TraderProfile } from "./profiles";
import { getAdminState } from "./admin";
import { supabase } from "@/integrations/supabase/client";
import { replaceMarketsFromDb } from "./markets";
export type Position = {
  id: string;
  marketId: string;
  title: string;
  outcome: string;
  stake: number;
  mult: number;
  status: "open" | "won" | "lost" | "voided";
  placed: string;
  placedAt?: number;
  /** Epoch ms when the position left the open state (settlement or void). */
  settledAt?: number;
  round?: number;
  asset?: string;
  lock?: number;
  /** Live price at the moment the order was filled (Flash). */
  entry?: number;
};
export type CashierTx = {
  id: string;
  kind: "deposit" | "withdraw";
  amount: number;
  at: number;
  receipt: string;
  status?: "completed" | "pending" | "failed";
};
export type Notif = {
  id: string;
  kind: "win" | "mpesa" | "info";
  title: string;
  body: string;
  ago: string;
  read: boolean;
  /** Deep link opened when the notification is tapped. */
  href?: string;
};
type Slip = { marketId: string; outcomeId: string } | null;
type Store = {
  oddsMode: "prob" | "odds";
  setOddsMode: (m: "prob" | "odds") => void;
  theme: "dark" | "light";
  toggleTheme: () => void;
  user: TraderProfile | null;
  auth: { open: boolean; mode: "login" | "signup"; provider: "email" | "google" };
  openAuth: (mode?: "login" | "signup", provider?: "email" | "google") => void;
  closeAuth: () => void;
  previewSignIn: (name: string, signup: boolean) => void;
  logout: () => void;
  updateProfile: (p: Partial<TraderProfile>) => void;
  onboarding: "phone" | "deposit" | null;
  setOnboarding: (s: "phone" | "deposit" | null) => void;
  balance: number;
  adjustBalance: (d: number) => void;
  slip: Slip;
  openSlip: (m: string, o: string) => void;
  closeSlip: () => void;
  /** When true (market page on desktop), the slip selects the inline rail ticket instead of a dialog. */
  slipDocked: boolean;
  setSlipDocked: (v: boolean) => void;
  positions: Position[];
  addPosition: (p: Omit<Position, "id" | "placed" | "status">) => boolean;
  settlePosition: (id: string, won: boolean) => void;
  /** Feed-interruption safety: void an open position and refund 100% of stake. */
  voidPosition: (id: string) => void;
  cashierLog: CashierTx[];
  recordCashierTx: (tx: Omit<CashierTx, "id">) => void;
  notifs: Notif[];
  pushNotif: (n: Omit<Notif, "id" | "ago" | "read">) => void;
  markAllRead: () => void;
  cashier: { open: boolean; tab: "deposit" | "withdraw"; amount?: number | undefined };
  openCashier: (t?: "deposit" | "withdraw", a?: number) => void;
  closeCashier: () => void;
  profileOpen: boolean;
  setProfileOpen: (o: boolean) => void;
  publicTrader: string | null;
  setPublicTrader: (h: string | null) => void;
};
// Keep one context across hot reloads so the provider and consumers always match.
const g = globalThis as { __polkaStoreCtx?: React.Context<Store | null> };
const Ctx = (g.__polkaStoreCtx ??= createContext<Store | null>(null));
export function StoreProvider({ children }: { children: ReactNode }) {
  const [oddsMode, setOdds] = useState<"prob" | "odds">("prob");
  const [theme, setTheme] = useState<"dark" | "light">("light");
  const [user, setUser] = useState<TraderProfile | null>(null);
  const [auth, setAuth] = useState<Store["auth"]>({
    open: false,
    mode: "login",
    provider: "email",
  });
  const [onboarding, setOnboarding] = useState<Store["onboarding"]>(null);
  const [balance, setBalance] = useState(0);
  const [positions, setPositions] = useState<Position[]>([]);
  const stateRef = useRef({ balance, positions });
  stateRef.current = { balance, positions };
  const [slip, setSlip] = useState<Slip>(null);
  const [slipDocked, setSlipDocked] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [cashier, setCashier] = useState<Store["cashier"]>({ open: false, tab: "deposit" });
  const [profileOpen, setProfileOpen] = useState(false);
  const [publicTrader, setPublicTrader] = useState<string | null>(null);
  const [cashierLog, setCashierLog] = useState<CashierTx[]>([]);
  useEffect(() => {
    if (localStorage.getItem("polka-theme") === "dark") setTheme("dark");
    if (localStorage.getItem("polka-odds") === "odds") setOdds("odds");
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light");
    // Keep the browser tab icon in step with the in-app theme switcher.
    document.querySelectorAll<HTMLLinkElement>('link[rel="icon"]').forEach((l) => {
      const dark = l.href.endsWith("favicon-dark.png");
      l.media = dark === (theme === "dark") ? "all" : "not all";
    });
  }, [theme]);
  // Real account: Supabase session -> profile, balance, positions, cashier history.
  const loadAccount = useCallback(async (uid: string | null) => {
    if (!uid) {
      setUser(null);
      setBalance(0);
      setPositions([]);
      stateRef.current = { balance: 0, positions: [] };
      setCashierLog([]);
      return;
    }
    const [{ data: prof }, { data: pos }, { data: txs }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase.from("positions").select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(500),
      supabase.from("cashier_transactions").select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(50),
    ]);
        if (prof) {
      const base = newProfile(prof.display_name || prof.handle);
      setUser({
        ...base,
        id: prof.id,
        handle: prof.handle,
        displayName: prof.display_name || prof.handle,
        phone: prof.phone || "",
        bio: prof.bio || "",
        joinedAt: Date.parse(prof.joined_at),
        ...(prof.referred_by ? { referredBy: prof.referred_by } : {}),
      } as TraderProfile);
      stateRef.current.balance = Number(prof.balance);
      setBalance(Number(prof.balance));
    }

    const mapped: Position[] = (pos ?? []).map((r) => ({
      id: r.id,
      marketId: r.market_id,
      title: r.title,
      outcome: r.outcome,
      stake: Number(r.stake),
      mult: Number(r.mult),
      status: (r.status as Position["status"]) ?? "open",
      placed: new Date(r.created_at).toLocaleString(),
      placedAt: Date.parse(r.created_at),
      ...(r.settled_at ? { settledAt: Date.parse(r.settled_at) } : {}),
      ...(r.round != null ? { round: Number(r.round) } : {}),
      ...(r.asset ? { asset: r.asset } : {}),
      ...(r.lock_price != null ? { lock: Number(r.lock_price) } : {}),
      ...(r.entry_price != null ? { entry: Number(r.entry_price) } : {}),
    }));
    stateRef.current.positions = mapped;
    setPositions(mapped);
    setCashierLog(
      (txs ?? [])
        .map((t) => {
          const st = String(t.status ?? "").toLowerCase();
          const status: CashierTx["status"] = ["success", "completed", "paid", "approved"].includes(st) ? "completed" : ["pending", "processing", "requested", ""].includes(st) ? "pending" : "failed";
          return { id: t.id, kind: t.type === "deposit" ? "deposit" : "withdraw", amount: Number(t.type === "deposit" ? (t.net ?? t.amount) : t.amount), at: Date.parse(t.created_at), receipt: t.mpesa_receipt ?? t.reference ?? "", status } as CashierTx;
        }),
    );
  }, []);
  const uidRef = useRef<string | null>(null);
  useEffect(() => {
    supabase.from("markets").select("*").order("created_at", { ascending: false }).then(({ data }) => {
      if (data) replaceMarketsFromDb(data as Array<Record<string, unknown>>);
    });
    supabase.auth.getUser().then(({ data }) => {
      uidRef.current = data.user?.id ?? null;
      void loadAccount(uidRef.current);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      uidRef.current = session?.user.id ?? null;
      if (event === "SIGNED_IN") setAuth((a) => ({ ...a, open: false }));
      void loadAccount(uidRef.current);
    });
    // Keep wallet in sync while M-Pesa confirmations land.
    const t = setInterval(() => uidRef.current && void loadAccount(uidRef.current), 20000);
    return () => {
      sub.subscription.unsubscribe();
      clearInterval(t);
    };
  }, [loadAccount]);
  const openAuth = useCallback(
    (mode: "login" | "signup" = "login", provider: "email" | "google" = "email") => {
      setSlip(null);
      setCashier((c) => ({ ...c, open: false }));
      setAuth({ open: true, mode, provider });
    },
    [],
  );
  const adjustBalance = useCallback((d: number) => {
    stateRef.current.balance = Math.round((stateRef.current.balance + d) * 100) / 100;
    setBalance(stateRef.current.balance);
  }, []);
  const pushNotif = useCallback(
    (n: Omit<Notif, "id" | "ago" | "read">) =>
      setNotifs((ns) => [{ ...n, id: crypto.randomUUID(), ago: "now", read: false }, ...ns]),
    [],
  );
  const settlePosition = useCallback(
    (id: string, won: boolean) => {
      const p = stateRef.current.positions.find((p) => p.id === id && p.status === "open");
      if (!p) return;
      const updated = stateRef.current.positions.map((x) =>
        x.id === id ? { ...x, status: won ? ("won" as const) : ("lost" as const), settledAt: Date.now() } : x,
      );
      stateRef.current.positions = updated;
      setPositions(updated);
      if (won) adjustBalance(Math.round(p.stake * p.mult * 100) / 100);
      if (!won || getAdminState().triggers.won) pushNotif({
        kind: won ? "win" : "info",
        title: won ? "Profit · position settled" : "Loss · round closed",
        body: p.title,
        href: p.asset ? "/flash" : `/market/${p.marketId}`,
      });
      toast(won ? "Outcome settled in the money" : "Round closed out of the money");
    },
    [adjustBalance, pushNotif],
  );
  const voidPosition = useCallback(
    (id: string) => {
      const p = stateRef.current.positions.find((p) => p.id === id && p.status === "open");
      if (!p) return;
      const updated = stateRef.current.positions.map((x) =>
        x.id === id ? { ...x, status: "voided" as const, settledAt: Date.now() } : x,
      );
      stateRef.current.positions = updated;
      setPositions(updated);
      adjustBalance(p.stake);
      if (getAdminState().triggers.voided) pushNotif({
        kind: "info",
        title: "Round voided · stake refunded",
        body: p.title,
        href: p.asset ? "/flash" : `/market/${p.marketId}`,
      });
      toast.info(
        `Round #${p.round !== undefined ? p.round % 10000 : "—"} voided due to feed interruption · ${fmtKES(p.stake)} refunded to your wallet.`,
      );
    },
    [adjustBalance, pushNotif],
  );
  const recordCashierTx = useCallback((tx: Omit<CashierTx, "id">) => {
    setCashierLog((log) => [{ ...tx, id: crypto.randomUUID() }, ...log].slice(0, 50));
  }, []);
  const value: Store = {
    oddsMode,
    setOddsMode: (m) => {
      setOdds(m);
      localStorage.setItem("polka-odds", m);
    },
    theme,
    toggleTheme: () =>
      setTheme((t) => {
        const n = t === "dark" ? "light" : "dark";
        localStorage.setItem("polka-theme", n);
        return n;
      }),
    user,
    auth,
    openAuth,
    closeAuth: () => setAuth((a) => ({ ...a, open: false })),
    previewSignIn: (name, signup) => {
      const base = newProfile(name);
      let referredBy: string | undefined;
      if (signup) {
        try {
          referredBy = localStorage.getItem("polka-referrer") || undefined;
        } catch {
          /* storage unavailable */
        }
      }
      setUser({ ...base, joinedAt: Date.now(), ...(referredBy ? { referredBy } : {}) });
      setAuth((a) => ({ ...a, open: false }));
      if (signup) setOnboarding("phone");
    },
    logout: () => {
      void supabase.auth.signOut();
      setUser(null);
      setBalance(0);
      setPositions([]);
      stateRef.current = { balance: 0, positions: [] };
      setSlip(null);
      setNotifs([]);
      setCashierLog([]);
      setCashier({ open: false, tab: "deposit" });
      setProfileOpen(false);
      setOnboarding(null);
    },
        updateProfile: (p) => {
      setUser((u) => (u ? { ...u, ...p } : null));
      const uid = uidRef.current;
      if (uid) {
        const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (p.phone !== undefined) payload.phone = p.phone;
        if (p.displayName !== undefined) payload.display_name = p.displayName;
        if (p.bio !== undefined) payload.bio = p.bio;
       void supabase.from("profiles").update(payload as any).eq("id", uid);
      }
    },
    onboarding,
    setOnboarding,
    balance,
    adjustBalance,
    slip,
    openSlip: (marketId, outcomeId) => setSlip({ marketId, outcomeId }),
    closeSlip: () => setSlip(null),
    slipDocked,
    setSlipDocked,
    positions,
    addPosition: (p) => {
      if (!user) {
        openAuth();
        return false;
      }
      const s = stateRef.current;
      if (!Number.isFinite(p.stake) || p.stake <= 0 || p.stake > s.balance) return false;
      if (!canBuy(s.positions, p.marketId, p.outcome)) {
        toast.error("An opposing position is already open. Hold until settlement.");
        return false;
      }
      if (
        p.round !== undefined &&
        s.positions.some((x) => x.round === p.round && x.marketId === "flash")
      )
        return false;
      const pos: Position = { ...p, id: crypto.randomUUID(), placed: "Just now", placedAt: Date.now(), status: "open" };
      adjustBalance(-p.stake);
      s.positions = [pos, ...s.positions];
      setPositions(s.positions);
      if (p.marketId !== "flash") applyTradeShift(p.marketId, p.outcome, p.stake);
      // Server is the source of truth: atomic debit + position row. Re-sync either way.
      void supabase
        .rpc("place_order", {
          p_market_id: p.marketId,
          p_outcome: p.outcome,
          p_stake: p.stake,
          p_multiplier: p.mult,
          p_title: p.title,
          p_asset: (p.asset ?? null) as string,
          p_round: (p.round ?? null) as number,
          p_lock: (p.lock ?? null) as number,
          p_entry: (p.entry ?? null) as number,
        })
        .then(({ error }) => {
          if (error) toast.error(error.message || "Order failed. Try again shortly.");
          void loadAccount(uidRef.current);
        });
      track("click", p.marketId === "flash" ? `Flash ${p.outcome}` : `Buy ${p.outcome}`);
      if (user.referredBy) {
        const { fee, commission } = tradeCommission(p.stake, DEFAULT_RAKE, isZeroFeeActive(user, Date.now()));
        recordCommission(user.referredBy, {
          friend: user.handle,
          market: p.marketId === "flash" ? "60s Flash" : (getMarket(p.marketId)?.question ?? p.marketId),
          stake: p.stake,
          fee,
          amount: commission,
        });
      }
      return true;
    },
    settlePosition,
    voidPosition,
    cashierLog,
    recordCashierTx,
    notifs,
    pushNotif,
    markAllRead: () => setNotifs((ns) => ns.map((n) => ({ ...n, read: true }))),
    cashier,
    openCashier: (tab = "deposit", amount) => {
      if (!user) return openAuth();
      setSlip(null);
      setOnboarding(null);
      setCashier({ open: true, tab, amount });
    },
    closeCashier: () => setCashier((c) => ({ ...c, open: false })),
    profileOpen,
    setProfileOpen,
    publicTrader,
    setPublicTrader,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore outside provider");
  return s;
}
