import { useEffect, useState, useSyncExternalStore } from "react";

export type Outcome = { id: string; label: string; prob: number; img?: string | undefined };
export type StakeTag = { amount: number; side: string };
export type Proposed = { outcome: string; at: number; evidenceUrl?: string | undefined };
export type MarketState = "open" | "closed" | "proposed" | "settled";
export type LifecyclePatch = {
  state?: MarketState | undefined;
  proposed?: Proposed | null;
  finalOutcome?: string | null;
};
export type Comment = {
  id: string;
  user: string;
  stake?: StakeTag | undefined;
  text: string;
  ago: string;
  likes: number;
  replies?: Comment[];
};
export type News = { source: string; title: string; ago: string; url: string };
export type Market = {
  id: string;
  question: string;
  category: string;
  thumb: { text: string; tone: "primary" | "up" | "down" | "chart-4" | "chart-5"; img?: string | undefined };
  volume: number;
  endsLabel: string;
  outcomes: Outcome[];
  rules: string;
  oracle: string;
  news: News[];
  comments: Comment[];
  hot?: { change: number };
  closesAt?: number;
  featured?: boolean;
  /** Lifecycle: undefined behaves as "open". */
  state?: MarketState | undefined;
  proposed?: Proposed | undefined;
  finalOutcome?: string | undefined;
  /** Zero-trade / brand-new markets chart a flat opening line, not synthetic swings. */
  flat?: boolean | undefined;
  /** Daily crypto target-price round (East Africa Time). */
  eat?: { sym: string; target: number } | undefined;
  sport?: {
    league: string;
    home: string;
    away: string;
    liveMin?: number;
    homeCrest?: string | undefined;
    awayCrest?: string | undefined;
  };
};

/** Decimal multiplier from implied probability. */
export function toMultiplier(prob: number): number {
  if (prob <= 0) return 0;
  return Math.round((1 / prob) * 100) / 100;
}

export function payout(stake: number, multiplier: number): number {
  return Math.round(stake * multiplier * 100) / 100;
}

export function fmtKES(n: number, decimals = 0) {
  return `KES ${n.toLocaleString("en-KE", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

/** Axis label in real shillings: "KSh 450", "KSh 1,200", "−KSh 300". */
export function fmtAxisKES(n: number) {
  const v = Math.round(n);
  return `${v < 0 ? "−" : ""}KSh ${Math.abs(v).toLocaleString("en-KE")}`;
}

/** Rounds a value range out to the nearest "nice" step (50, 100, 250, 500, 1k…). */
export function niceDomain(values: number[]): [number, number] {
  const lo = Math.min(0, ...values);
  const hi = Math.max(0, ...values);
  const span = hi - lo || 100;
  const raw = span / 5;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  return [Math.floor(lo / step) * step || (lo < 0 ? -step : 0), Math.ceil(hi / step) * step || step];
}

export function fmtCompact(n: number) {
  if (n >= 1_000_000)
    return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return `${n}`;
}

export function fmtOutcome(prob: number, mode: "prob" | "odds") {
  return mode === "prob" ? `${Math.round(prob * 100)}%` : `${toMultiplier(prob).toFixed(2)}x`;
}

function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const BASE_TIME = Date.UTC(2026, 9, 19, 9, 0, 0);

export type Point = { t: number; p: number };

/** Deterministic stepped random walk ending at `end`, hourly points. */
export function genHistory(seed: number, end: number, points = 900): Point[] {
  const r = rng(seed);
  const out: Point[] = [];
  let p = end;
  for (let i = 0; i < points; i++) {
    out.push({ t: BASE_TIME - i * 3600_000, p: Math.round(p * 1000) / 1000 });
    if (r() < 0.35) p += (r() - 0.5) * 0.05;
    p = Math.min(0.97, Math.max(0.03, p));
  }
  return out.reverse();
}

/**
 * Binary reflection: P(No) = 1 − P(Yes) at every identical timestamp, so the
 * two curves of a Yes/No market always mirror each other exactly.
 */
export function mirrorHistory(history: Point[]): Point[] {
  return history.map(({ t, p }) => ({ t, p: Math.round((1 - p) * 1000) / 1000 }));
}

export function hashId(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}

const yesNo = (y: number): Outcome[] => [
  { id: "yes", label: "Yes", prob: y },
  { id: "no", label: "No", prob: Math.round((1 - y) * 100) / 100 },
];

const commonComments = (side1: string, side2: string): Comment[] => [
  {
    id: "c1",
    user: "wanjiku_trades",
    stake: { amount: 10000, side: side1 },
    text: "Inflation prints have been soft three months running. The data is pointing one way only.",
    ago: "2h",
    likes: 42,
    replies: [
      {
        id: "c1r1",
        user: "otieno.k",
        stake: { amount: 2500, side: side2 },
        text: "Shilling pressure from the Eurobond repayment says otherwise. Don't sleep on it.",
        ago: "1h",
        likes: 18,
        replies: [
          {
            id: "c1r1r1",
            user: "wanjiku_trades",
            stake: { amount: 10000, side: side1 },
            text: "Reserves are at 4.8 months of import cover. Plenty of buffer.",
            ago: "48m",
            likes: 9,
          },
        ],
      },
    ],
  },
  {
    id: "c2",
    user: "mkenya_halisi",
    stake: { amount: 500, side: side2 },
    text: "Small position as a hedge. Implied probabilities look too stretched for me.",
    ago: "5h",
    likes: 7,
  },
  {
    id: "c3",
    user: "nairobi_quant",
    text: "Volume spiked 3x after the morning headline. Watching closely.",
    ago: "6h",
    likes: 3,
  },
];

const econNews: News[] = [
  {
    source: "Business Daily",
    title: "CBK signals room for further easing as inflation holds at 4.1%",
    ago: "3h",
    url: "https://www.businessdailyafrica.com",
  },
  {
    source: "Nation",
    title: "Treasury bill yields fall for fourth straight week",
    ago: "1d",
    url: "https://nation.africa",
  },
  {
    source: "The Standard",
    title: "Banks under pressure to pass on lower rates to borrowers",
    ago: "2d",
    url: "https://www.standardmedia.co.ke",
  },
];
const sportsNews: News[] = [
  {
    source: "Nation Sport",
    title: "Coach names strong squad with three foreign-based returnees",
    ago: "4h",
    url: "https://nation.africa/kenya/sports",
  },
  {
    source: "The Star",
    title: "Kasarani pitch passed fit after weekend inspection",
    ago: "1d",
    url: "https://www.the-star.co.ke",
  },
];
const politicsNews: News[] = [
  {
    source: "Nation",
    title: "New opinion poll shows tightening race ahead of 2027",
    ago: "6h",
    url: "https://nation.africa",
  },
  {
    source: "Citizen Digital",
    title: "Opposition coalition talks enter final stretch",
    ago: "1d",
    url: "https://www.citizen.digital",
  },
];

/** Event markets come only from the database (see loadMarketsFromDb). Starts empty. */
export const markets: Market[] = [];

// ---- Live odds engine: trades shift probabilities and volume app-wide ----
type Override = { probs: Record<string, number>; volDelta: number; lc?: LifecyclePatch };
const overrides: Record<string, Override> = {};
let version = 0;
const listeners = new Set<() => void>();
const cache = new Map<string, { v: number; m: Market }>();

function merged(id: string): Market | undefined {
  const base = markets.find((m) => m.id === id);
  if (!base) return undefined;
  const hit = cache.get(id);
  if (hit && hit.v === version) return hit.m;
  const ov = overrides[id];
  let m: Market = ov
    ? {
        ...base,
        volume: base.volume + ov.volDelta,
        outcomes: base.outcomes.map((o) => ({ ...o, prob: ov.probs[o.id] ?? o.prob })),
      }
    : { ...base };
  if (ov?.lc) {
    if (ov.lc.state) m.state = ov.lc.state;
    m.proposed = ov.lc.proposed ?? undefined;
    m.finalOutcome = ov.lc.finalOutcome ?? undefined;
  }
  cache.set(id, { v: version, m });
  return m;
}

export function getMarket(id: string) {
  return merged(id);
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** Reactive market read — re-renders when any trade shifts the odds. */
export function useMarket(id: string) {
  return useSyncExternalStore(
    subscribe,
    () => merged(id),
    () => merged(id),
  );
}

/** Re-render trigger for components that aggregate many markets. */
export function useMarketsVersion() {
  return useSyncExternalStore(
    subscribe,
    () => version,
    () => version,
  );
}

/** Move implied probability toward the bought outcome and add stake to volume. */
export function applyTradeShift(marketId: string, outcomeLabel: string, stake: number) {
  const base = markets.find((m) => m.id === marketId);
  const target = base?.outcomes.find((o) => o.label === outcomeLabel);
  if (!base || !target) return;
  const ov = (overrides[marketId] ??= { probs: {}, volDelta: 0 });
  const cur = (oid: string) => ov.probs[oid] ?? base.outcomes.find((o) => o.id === oid)!.prob;
  const oldP = cur(target.id);
  const w = Math.min(0.12, stake / (base.volume + ov.volDelta + stake));
  const newP = Math.min(0.97, Math.max(0.03, oldP + (1 - oldP) * w));
  const scale = oldP < 1 ? (1 - newP) / (1 - oldP) : 1;
  for (const o of base.outcomes) {
    ov.probs[o.id] = Math.round((o.id === target.id ? newP : cur(o.id) * scale) * 1000) / 1000;
  }
  ov.volDelta += stake;
  version++;
  listeners.forEach((l) => l());
}

/** Preview-only: add an admin-created market to the in-memory list. */
export function addMarket(m: Market) {
  if (markets.some((x) => x.id === m.id)) return false;
  markets.unshift({ ...m, flat: true });
  version++;
  listeners.forEach((l) => l());
  return true;
}

/** Session-only studio edits; keep the same market identity and trade overrides. */
export function editMarket(id: string, patch: Partial<Pick<Market, "question" | "category" | "thumb" | "closesAt" | "endsLabel" | "featured" | "rules" | "oracle">>) {
  const market = markets.find((m) => m.id === id);
  if (!market) return false;
  Object.assign(market, patch);
  version++;
  listeners.forEach((l) => l());
  return true;
}

/** Admin lifecycle change (mark outcome / finalize / reopen) applied to the public page. */
export function setMarketLifecycle(id: string, patch: LifecyclePatch) {
  if (!markets.some((m) => m.id === id)) return;
  const ov = (overrides[id] ??= { probs: {}, volDelta: 0 });
  ov.lc = { ...ov.lc, ...patch };
  version++;
  listeners.forEach((l) => l());
}

/** Flat opening series for zero-trade or brand-new markets — no synthetic swings. */
export function flatHistory(prob: number, points = 48): Point[] {
  const now = Date.now();
  const p = Math.round(Math.min(1, Math.max(0, prob)) * 1000) / 1000;
  return Array.from({ length: points }, (_, i) => ({ t: now - (points - 1 - i) * 3600_000, p }));
}

export function sortedOutcomes(m: Market) {
  return m.outcomes;
}

export const categories = ["All", "Politics", "Sports", "Economy", "Crypto", "Weather"] as const;

/** Ticking clock (ms interval) for countdown UIs. */
export function useNowTick(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(i);
  }, [ms]);
  return now;
}

/**
 * Preview resolution epoch for a position: Flash rounds resolve on the minute;
 * event markets carry a deterministic ETA derived from the market id.
 */
export function positionResolveAt(p: { marketId: string; round?: number }): number {
  if (p.marketId === "flash" && p.round !== undefined) return p.round * 60_000 + 60_000;
  const close = getMarket(p.marketId)?.closesAt;
  if (close !== undefined) return close;
  return Date.now() + (3 + (hashId(p.marketId) % 118)) * 86_400_000;
}

/** "1mo 4d 3h"-style countdown to resolution. */
export function fmtResolveEta(ms: number) {
  if (ms <= 0) return "resolving…";
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (d >= 30) return `${Math.floor(d / 30)}mo ${d % 30}d ${h}h`;
  if (d >= 1) return `${d}d ${h}h`;
  if (h >= 1) return `${h}h ${m}m`;
  return `${m}m`;
}

/** Short local date + time, e.g. "24 Oct 2026, 16:15". */
export function fmtDateTime(ts: number) {
  return new Date(ts).toLocaleString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

// ---- Dynamic categories: admin-created categories join the filter pills app-wide ----
const baseCats: string[] = categories.slice(1);
let extraCategories: string[] = [];
let catVersion = 0;
const catListeners = new Set<() => void>();
export function addCategory(name: string) {
  const c = name.trim();
  if (!c) return false;
  const exists = [...baseCats, ...extraCategories].some(
    (x) => x.toLowerCase() === c.toLowerCase(),
  );
  if (!exists) {
    extraCategories = [...extraCategories, c];
    catVersion++;
    catListeners.forEach((l) => l());
  }
  return true;
}
function subscribeCats(cb: () => void) {
  catListeners.add(cb);
  return () => void catListeners.delete(cb);
}
/** Reactive category list — includes custom categories added from the admin studio. */
export function useCategories() {
  useSyncExternalStore(subscribeCats, () => catVersion, () => catVersion);
  return ["All", ...baseCats, ...extraCategories];
}

/** Probability path recorded for live-priced binary markets (daily crypto rounds). Starts empty; only real ticks. */
const liveHistory: Record<string, Point[]> = {};
export function getLiveHistory(id: string): Point[] {
  return liveHistory[id] ?? [];
}

/** Reprice a binary market's Yes/No from an external model and record the point for its chart. */
export function setBinaryProb(id: string, yes: number, at = Date.now()) {
  const base = markets.find((m) => m.id === id);
  if (!base || base.outcomes.length !== 2) return;
  const p = Math.round(Math.min(0.98, Math.max(0.02, yes)) * 1000) / 1000;
  const ov = (overrides[id] ??= { probs: {}, volDelta: 0 });
  const prev = ov.probs[base.outcomes[0]!.id];
  const h = (liveHistory[id] ??= []);
  if (prev === p && h.length) return;
  ov.probs[base.outcomes[0]!.id] = p;
  ov.probs[base.outcomes[1]!.id] = Math.round((1 - p) * 1000) / 1000;
  h.push({ t: at, p });
  if (h.length > 2000) h.shift();
  version++;
  listeners.forEach((l) => l());
}
