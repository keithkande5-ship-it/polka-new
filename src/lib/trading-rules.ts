import { useSyncExternalStore } from "react";

/** Platform rake on Flash payouts. Defaults to 5%, adjustable from the admin workspace. */
export const DEFAULT_RAKE = 0.05;
export const MAX_RAKE = 0.2;

let rake = DEFAULT_RAKE;
const rakeListeners = new Set<() => void>();
export function getRake() {
  return rake;
}
export function setRake(pct: number) {
  const next = Math.min(MAX_RAKE, Math.max(0, Math.round(pct * 1000) / 1000));
  if (next === rake) return;
  rake = next;
  rakeListeners.forEach((l) => l());
}
function subscribeRake(cb: () => void) {
  rakeListeners.add(cb);
  return () => void rakeListeners.delete(cb);
}
/** Reactive rake read — re-renders quotes and payout copies when the rake changes. */
export function useRake() {
  return useSyncExternalStore(
    subscribeRake,
    () => rake,
    () => rake,
  );
}
export const WITHDRAWAL_TIERS = [
  [50, 11],
  [500, 17],
  [1000, 23],
  [1500, 28],
  [2500, 35],
  [3500, 38],
  [5000, 45],
  [7500, 55],
  [10000, 60],
  [Infinity, 70],
] as const;
export function cashierQuote(amount: number, deposit: boolean) {
  const providerFee = deposit ? 3 : (WITHDRAWAL_TIERS.find(([upper]) => amount < upper)?.[1] ?? 70);
  // No platform handling markup. Deposits: STK prompt = entered amount, fee deducted from credit.
  const handlingFee = 0;
  const fee = providerFee + handlingFee;
  return { amount, providerFee, handlingFee, fee, total: deposit ? amount : amount, net: Math.max(0, amount - fee) };
}
export function validHandle(handle: string) {
  return /^[a-zA-Z0-9_]{3,16}$/.test(handle.replace(/^@/, ""));
}
export function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, "").replace(/^254/, "").replace(/^0/, "");
  return /^[17]\d{8}$/.test(digits) ? `+254${digits}` : null;
}
/**
 * Probability drift rate for Flash quotes. The high coefficient drives obvious
 * favorites to penny multipliers (≈1.01x–1.03x) so late-trend chasing is not
 * subsidised by the house.
 */
export const FLASH_DRIFT_RATE = 900;
/** House-capital guard: a side at or above this implied probability is locked. */
export const FLASH_LOCKOUT_PROB = 0.92;
/** Implied probability from which the favorite side pays pennies. */
export const FLASH_PENNY_FROM = 0.7;
/**
 * Time-to-expiry sharpening: variance shrinks with √(time left), so the same
 * move is more decisive late in the round. 1 at a full 60s, ~1.7x at 20s.
 */
export function flashTimeFactor(remaining?: number) {
  if (remaining === undefined) return 1;
  return Math.sqrt(60 / Math.max(FLASH_LOCK_WINDOW_SECONDS, Math.min(60, remaining)));
}
export function flashProbability(price: number | null, lock: number | null, remaining?: number) {
  const drift = price && lock ? (price - lock) / lock : 0;
  return Math.min(
    0.92,
    Math.max(0.08, 0.5 + drift * FLASH_DRIFT_RATE * flashTimeFactor(remaining)),
  );
}
/** True when one outcome's implied probability has reached max liability. */
export function flashLockout(prob: number) {
  return prob >= FLASH_LOCKOUT_PROB;
}
export function flashMultipliers(price: number | null, lock: number | null) {
  const p = flashProbability(price, lock);
  const f = 1 - getRake();
  return { up: Math.round((f / p) * 100) / 100, down: Math.round((f / (1 - p)) * 100) / 100 };
}
/**
 * Self-correcting parimutuel multiplier: never quotes more than the net
 * distributable pool (after rake) can pay the winning side.
 */
export function parimutuelMultiplier(
  prob: number,
  sideStake: number,
  poolStake: number,
  rake: number = getRake(),
) {
  const p = Math.min(0.92, Math.max(0.08, prob));
  let fair = (1 - rake) / p;
  // Obvious favorites (≥70%) are compressed to penny payouts (1.01x–1.05x)
  // so late-trend chasing is not subsidised; the underdog keeps the full quote.
  if (p >= FLASH_PENNY_FROM) {
    fair = Math.min(
      fair,
      1.01 + ((FLASH_LOCKOUT_PROB - p) / (FLASH_LOCKOUT_PROB - FLASH_PENNY_FROM)) * 0.04,
    );
  }
  const side = Math.max(0, sideStake);
  const pool = Math.max(side, poolStake);
  const cap = side > 0 ? (pool * (1 - rake)) / side : Infinity;
  return Math.round(Math.max(1.01, Math.min(fair, cap)) * 100) / 100;
}
export function canBuy(
  positions: { marketId: string; outcome: string; status: string }[],
  marketId: string,
  outcome: string,
) {
  return !positions.some(
    (p) => p.marketId === marketId && p.status === "open" && p.outcome !== outcome,
  );
}
/** Anti-sniping lock: Flash betting closes this many seconds before settlement. */
/** Anti-sniping lock: Flash betting closes this many seconds before settlement. */
export const FLASH_LOCK_WINDOW_SECONDS = 20;
/** KES 1,000 circuit breaker: pauses house contracts when vault reserve is below floor. */
export const VAULT_RESERVE_FLOOR = 1000;

export function isHousePaused(vaultBalance?: number) {
  return (vaultBalance ?? getVault().balance) < VAULT_RESERVE_FLOOR;
}

export function canTradeFlash(remaining: number, active: boolean, vaultBalance?: number) {
  if (vaultBalance !== undefined && vaultBalance < VAULT_RESERVE_FLOOR) return false;
  return remaining > FLASH_LOCK_WINDOW_SECONDS && !active;
}

/** Default liquidity seed for a regular market, split evenly across outcomes. */
export const DEFAULT_MARKET_SEED = 200;
export function seedSplit(seed: number, outcomes: number) {
  if (outcomes < 2) return [];
  return Array.from({ length: outcomes }, () => Math.round((seed / outcomes) * 100) / 100);
}
/** Settlement challenge window after an outcome is marked. */
export const DISPUTE_WINDOW_MS = 60 * 60 * 1000;
export const DISPUTE_FEE = 10;
export function disputeOpen(markedAt: number, now: number) {
  return now - markedAt < DISPUTE_WINDOW_MS;
}
/** Withdrawals above this need admin approval. */
export const WITHDRAWAL_APPROVAL_THRESHOLD = 10_000;
export function needsWithdrawalApproval(amount: number) {
  return amount > WITHDRAWAL_APPROVAL_THRESHOLD;
}
export function platformRake(pool: number) {
  return Math.round(pool * getRake() * 100) / 100;
}
/** Platform rake on the losing pot of a normal event market, in basis points (5%). */
export const DEFAULT_EVENT_POT_RAKE_BPS = 500;
/**
 * Event market settlement: the platform takes the rake from the gross losing
 * pot only; winners keep their own stake plus the remaining losing pot.
 */
export function eventPoolSettlement(
  winningPool: number,
  losingPool: number,
  rakeBps: number = DEFAULT_EVENT_POT_RAKE_BPS,
) {
  const win = Math.max(0, winningPool);
  const lose = Math.max(0, losingPool);
  const rake = lose - Math.floor((lose * (10_000 - rakeBps)) / 10_000);
  const distributablePool = win + (lose - rake);
  return { rake, distributablePool, multiplier: win > 0 ? distributablePool / win : 0 };
}
/** Per-account rewards storage key; guests share one isolated bucket. */
export function rewardsStorageKey(userId?: string | null) {
  return userId ? `polka-rewards-${userId}` : "polka-rewards-guest";
}

/** Referred friends trade with zero fees for their first 24 hours. */
export const REFERRAL_ZERO_FEE_MS = 24 * 60 * 60 * 1000;
/** Referrers earn a flat 10% of every fee their friends pay, for life. */
export const REFERRAL_FEE_SHARE = 0.1;

export function zeroFeeRemainingMs(
  user: { referredBy?: string; joinedAt?: number } | null | undefined,
  now: number,
) {
  if (!user?.referredBy || !user.joinedAt) return 0;
  return Math.max(0, user.joinedAt + REFERRAL_ZERO_FEE_MS - now);
}
export function isZeroFeeActive(
  user: { referredBy?: string; joinedAt?: number } | null | undefined,
  now: number,
) {
  return zeroFeeRemainingMs(user, now) > 0;
}
/** Effective rake for a trader: waived entirely during the zero-fee window. */
export function effectiveRake(baseRake: number, zeroFee: boolean) {
  return zeroFee ? 0 : baseRake;
}
/** Splits a collected fee: 10% to the referrer (if any), the rest to the platform. */
export function referralSplit(fee: number, hasReferrer: boolean) {
  const referrer = hasReferrer ? Math.round(fee * REFERRAL_FEE_SHARE * 100) / 100 : 0;
  return { referrer, platform: Math.round((fee - referrer) * 100) / 100 };
}
/** Per-referrer commission ledger key, so accounts never share earnings. */
export function referralLedgerKey(handle: string) {
  return `polka-ref-ledger-${handle.replace(/^@/, "").toLowerCase()}`;
}
/** Commission a referrer earns from one trade: 10% of the fee, nothing while the friend's fees are waived. */
export function tradeCommission(stake: number, baseRake: number, zeroFee: boolean) {
  const fee = Math.round(stake * effectiveRake(baseRake, zeroFee) * 100) / 100;
  return { fee, commission: referralSplit(fee, true).referrer };
}

export function settlementGuard(verified: boolean, confirmation: string) {
  return verified && confirmation === "CONFIRM";
}
export function expiryBucket(closesAt: number | undefined, now: number) {
  if (closesAt === undefined) return "scheduled";
  if (closesAt <= now) return "expired";
  return closesAt - now < 24 * 60 * 60 * 1000 ? "soon" : "scheduled";
}
export function extendMarketClose(closesAt: number | undefined, now: number, hours: 2 | 6 | 24) {
  return Math.max(closesAt ?? now, now) + hours * 60 * 60 * 1000;
}
export function solvencyCoverage(vault: number, wallets: number, liabilities: number) {
  const required = Math.max(0, wallets) + Math.max(0, liabilities);
  return {
    required,
    percent: required > 0 ? (Math.max(0, vault) / required) * 100 : 100,
    covered: vault >= required,
  };
}
export function settlementPreview(
  positions: { outcome: string; stake: number; mult: number }[],
  outcome: string,
) {
  const voided = outcome === "VOID";
  const winners = positions.filter((p) => voided || p.outcome === outcome);
  const losingPool = positions
    .filter((p) => !voided && p.outcome !== outcome)
    .reduce((sum, p) => sum + p.stake, 0);
  return {
    count: winners.length,
    payout: winners.reduce(
      (sum, p) => sum + (voided ? p.stake : Math.round(p.stake * p.mult * 100) / 100),
      0,
    ),
    rake: voided ? 0 : eventPoolSettlement(0, losingPool).rake,
  };
}
export function opsTapSequence(taps: number[], now: number) {
  const next = [...taps.filter((t) => now - t <= 3000), now];
  return { taps: next, unlocked: next.length >= 5 };
}

/**
 * Pool-aware payout cap: a winning ticket can never pay more than the
 * distributable pool after rake, so thin pools cannot create house deficits.
 * Returns the effective multiplier and payout for the order ticket.
 */
export function safeQuote(stake: number, prob: number, pool: number, rakePct = DEFAULT_RAKE) {
  const spot = prob > 0 ? 1 / prob : 0;
  if (stake <= 0 || spot <= 0) return { mult: Math.round(spot * 100) / 100, payout: 0, capped: false };
  const cap = (Math.max(0, pool) + stake) * (1 - rakePct);
  const raw = stake * spot;
  const pay = Math.max(stake, Math.min(raw, cap));
  const mult = Math.round((pay / stake) * 100) / 100;
  return { mult, payout: Math.round(stake * mult * 100) / 100, capped: raw > cap };
}

/** Adaptive probability axis: zooms to the traded band in 5%/10% steps, never outside 0–100%. */
export function autoScaleDomain(values: number[]): { domain: [number, number]; ticks: number[] } {
  const v = values.filter((x) => Number.isFinite(x));
  if (!v.length) return { domain: [0, 1], ticks: [0, 0.25, 0.5, 0.75, 1] };
  const lo = Math.min(...v);
  const hi = Math.max(...v);
  const span = Math.max(hi - lo, 0.04);
  const step = span > 0.5 ? 0.25 : span > 0.25 ? 0.1 : 0.05;
  let min = Math.max(0, Math.floor((lo - span * 0.15) / step) * step);
  let max = Math.min(1, Math.ceil((hi + span * 0.15) / step) * step);
  if (max - min < step * 2) max = Math.min(1, min + step * 2), min = Math.max(0, max - step * 2);
  const ticks: number[] = [];
  for (let t = min; t <= max + 1e-9; t += step) ticks.push(Math.round(t * 1000) / 1000);
  return { domain: [Math.round(min * 1000) / 1000, Math.round(max * 1000) / 1000], ticks };
}

/** Time-aware x-axis tick spacing per timeframe (ms). */
export const FRAME_TICK_MS = { "1H": 600_000, "1D": 3 * 3600_000, "1W": 86400_000, "1M": 7 * 86400_000 } as const;

/** Next daily crypto target round close in East Africa Time (12:00, 18:00, 23:59 EAT = UTC+3). */
export const EAT_CLOSE_HOURS = [12, 18, 23.9833];
export function nextEatClose(now = Date.now()): number {
  const eat = new Date(now + 3 * 3600_000);
  const dayStartUtc = Date.UTC(eat.getUTCFullYear(), eat.getUTCMonth(), eat.getUTCDate()) - 3 * 3600_000;
  for (const h of EAT_CLOSE_HOURS) {
    const t = dayStartUtc + Math.round(h * 3600_000);
    if (t > now) return t;
  }
  return dayStartUtc + 86400_000 + 12 * 3600_000;
}
/** Target price rounded to a clean step near spot (e.g. BTC to nearest $500). */
export function eatTarget(spot: number): number {
  const step = spot > 10000 ? 500 : spot > 1000 ? 50 : spot > 100 ? 5 : spot > 10 ? 0.5 : 0.05;
  return Math.round(Math.ceil(spot / step) * step * 100) / 100;
}

/** Central vault ledger: seeds debit, Flash house PnL credits. */
/** Central vault ledger: seeds debit, Flash house PnL credits. */
export type VaultEntry = { id: string; at: number; kind: "seed" | "flash" | "rake" | "topup"; amount: number; note: string };
let vault = { balance: 0, entries: [] as VaultEntry[] };

const vaultListeners = new Set<() => void>();
export function getVault() {
  return vault;
}
export function vaultPost(kind: VaultEntry["kind"], amount: number, note: string): boolean {
  if (amount < 0 && vault.balance + amount < 0) return false;
  vault = {
    balance: Math.round((vault.balance + amount) * 100) / 100,
    entries: [{ id: crypto.randomUUID(), at: Date.now(), kind, amount, note }, ...vault.entries].slice(0, 200),
  };
  vaultListeners.forEach((l) => l());
  return true;
}
export function useVault() {
  return useSyncExternalStore(
    (cb) => (vaultListeners.add(cb), () => void vaultListeners.delete(cb)),
    getVault,
    getVault,
  );
}

/** Standard normal CDF (Abramowitz–Stegun 7.1.26), accurate to ~1e-7. */
export function normalCdf(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(x * x) / 2);
  return x >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
}

/** Annualised volatility assumptions for daily target rounds. */
export const EAT_VOL: Record<string, number> = { BTC: 0.55, ETH: 0.7, SOL: 0.95 };

/**
 * Digital-option probability that spot closes strictly above target.
 * Uses distance to target and time left; clamped to [0.02, 0.98] so both sides stay tradable.
 */
export function eatProbability(spot: number, target: number, msLeft: number, vol = 0.6): number {
  if (!(spot > 0) || !(target > 0)) return 0.5;
  if (msLeft <= 0) return spot > target ? 0.98 : 0.02;
  const years = msLeft / (365 * 24 * 3600_000);
  const sd = vol * Math.sqrt(years);
  const d2 = (Math.log(spot / target) - (sd * sd) / 2) / sd;
  return Math.min(0.98, Math.max(0.02, normalCdf(d2)));
}
