import { useSyncExternalStore } from "react";
import { addMarket, getMarket, markets, setBinaryProb, setMarketLifecycle } from "./markets";
import { EAT_VOL, eatProbability, eatTarget, nextEatClose, vaultPost, getVault } from "./trading-rules";

/** Daily crypto target-price rounds (East Africa Time). Uses market lifecycle; never pays positions itself. */
export const EAT_ASSETS = [
  { sym: "BTC", name: "Bitcoin" },
  { sym: "ETH", name: "Ethereum" },
  { sym: "SOL", name: "Solana" },
] as const;
export const EAT_SEED = 20_000;
export type EatRound = { sym: string; close: number; target: number; settle: number | null; outcome: "Yes" | "No" | null };

const prices: Record<string, { p: number; at: number }> = {};
const EAT_ROUNDS_KEY = "polka_eat_rounds_history";

function loadSavedRounds(): EatRound[] {
  try {
    return JSON.parse(localStorage.getItem(EAT_ROUNDS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

let rounds: EatRound[] = typeof window !== "undefined" ? loadSavedRounds() : [];
let autoOn = true;

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function reportPrice(sym: string, p: number) {
  prices[sym] = { p, at: Date.now() };
}
export function lastPrice(sym: string) {
  return prices[sym]?.p ?? null;
}
export function setEatAuto(on: boolean) {
  autoOn = on;
  emit();
}
export function eatAuto() {
  return autoOn;
}
export const eatId = (sym: string, close: number) => `eat-${sym.toLowerCase()}-${close}`;

export function eatQuestion(sym: string, target: number, close: number) {
  const hhmm = new Date(close + 3 * 3600_000).toISOString().slice(11, 16);
  return `Will ${sym} trade above $${target.toLocaleString("en-US")} at ${hhmm} EAT?`;
}

/** Create the next round for each asset once a live price exists and the vault can seed it. */
export function ensureEatRounds(now = Date.now()) {
  if (!autoOn) return;
  const close = nextEatClose(now);
  for (const a of EAT_ASSETS) {
    const id = eatId(a.sym, close);
    if (getMarket(id)) continue;
    const spot = prices[a.sym];
    if (!spot || now - spot.at > 60_000) continue;
    if (getVault().balance < EAT_SEED) continue;
    const target = eatTarget(spot.p);
    vaultPost("seed", -EAT_SEED, `Seed · ${a.sym} ${new Date(close).toISOString().slice(0, 16)} round`);
    addMarket({
      id,
      question: eatQuestion(a.sym, target, close),
      category: "Crypto",
      thumb: { text: a.sym, tone: "chart-4" },
      volume: EAT_SEED,
      closesAt: close,
      endsLabel: new Date(close).toLocaleString("en-KE", { timeZone: "Africa/Nairobi", hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" }) + " EAT",
      outcomes: [
        { id: "o0", label: "Yes", prob: 0.5 },
        { id: "o1", label: "No", prob: 0.5 },
      ],
      rules: `Resolves YES if the Binance ${a.sym}/USDT spot price at the close time is strictly above $${target.toLocaleString("en-US")}. If the price feed is unavailable at close, the market closes unresolved for operator review.`,
      oracle: `Binance ${a.sym}/USDT spot`,
      news: [],
      comments: [],
      eat: { sym: a.sym, target },
    });
    setBinaryProb(id, eatProbability(spot.p, target, close - now, EAT_VOL[a.sym]), now);
  }
}

/** Reprice open rounds from spot-to-target distance and time left: likelier side pays less. */
export function repriceEatRounds(now = Date.now()) {
  for (const m of markets) {
    if (!m.eat || !m.closesAt || m.closesAt <= now) continue;
    const cur = getMarket(m.id);
    if (!cur || (cur.state ?? "open") !== "open") continue;
    const spot = prices[m.eat.sym];
    if (!spot || now - spot.at > 60_000) continue;
    setBinaryProb(m.id, eatProbability(spot.p, m.eat.target, m.closesAt - now, EAT_VOL[m.eat.sym]), now);
  }
}

/** Close due rounds: post the result for final settlement, or close unresolved when the feed is stale. */
export function closeDueEatRounds(now = Date.now()) {
  let changed = false;
  for (const m of markets) {
    if (!m.eat || !m.closesAt || m.closesAt > now) continue;
    const cur = getMarket(m.id);
    if (!cur || (cur.state ?? "open") !== "open") continue;
    const spot = prices[m.eat.sym];
    const fresh = spot && now - spot.at < 60_000;
       if (fresh) {
      const outcome: "Yes" | "No" = spot.p > m.eat.target ? "Yes" : "No";
      setMarketLifecycle(m.id, { state: "proposed", proposed: { outcome, at: now } });
      rounds = [{ sym: m.eat.sym, close: m.closesAt, target: m.eat.target, settle: spot.p, outcome }, ...rounds].slice(0, 60);
    } else {
      setMarketLifecycle(m.id, { state: "closed" });
     rounds = [{ sym: m.eat.sym, close: m.closesAt, target: m.eat.target, settle: spot?.p ?? null, outcome: null }, ...rounds].slice(0, 60);
    }
    try {
      localStorage.setItem(EAT_ROUNDS_KEY, JSON.stringify(rounds));
    } catch {}
    changed = true;

  }
  if (changed) emit();
}

const snap = () => rounds;
export function useEatRounds(sym: string) {
  const all = useSyncExternalStore((cb) => (listeners.add(cb), () => void listeners.delete(cb)), snap, snap);
  return all.filter((r) => r.sym === sym);
}
