import { describe, it, expect } from "vitest";
import {
  cashierQuote,
  flashMultipliers,
  flashProbability,
  canBuy,
  canTradeFlash,
  validHandle,
  normalizePhone,
  setRake,
  parimutuelMultiplier,
  FLASH_LOCK_WINDOW_SECONDS,
  DEFAULT_RAKE,
} from "@/lib/trading-rules";
describe("Cashier fees", () => {
  it("adds KES 5 to a KES 500 deposit", () =>
    expect(cashierQuote(500, true)).toMatchObject({ providerFee: 3, handlingFee: 2, total: 505 }));
  const tiers = [
    [1, 49, 11],
    [50, 499, 17],
    [500, 999, 23],
    [1000, 1499, 28],
    [1500, 2499, 35],
    [2500, 3499, 38],
    [3500, 4999, 45],
    [5000, 7499, 55],
    [7500, 9999, 60],
    [10000, 100000, 70],
  ];
  tiers.forEach(([min, max, fee]) =>
    it(`withdrawal fee ${min}–${max}`, () => {
      for (const amount of [min, max])
        expect(cashierQuote(amount ?? 0, false)).toMatchObject({
          providerFee: fee,
          handlingFee: 5,
          net: (amount ?? 0) - (fee ?? 0) - 5,
        });
    }),
  );
});
it("uses the default 5% rake at even probability", () =>
  expect(flashMultipliers(100, 100)).toEqual({ up: 1.9, down: 1.9 }));
it("dynamic multipliers reach favorite and underdog ranges", () => {
  const q = flashMultipliers(101, 100);
  expect(q.up).toBeGreaterThanOrEqual(1.0);
  expect(q.up).toBeLessThanOrEqual(1.1);
  expect(q.down).toBe(11.88);
});
it("reprices payouts when the admin changes the rake", () => {
  setRake(0.08);
  expect(platformRake(1000)).toBe(80);
  expect(flashMultipliers(100, 100)).toEqual({ up: 1.84, down: 1.84 });
  setRake(DEFAULT_RAKE);
  expect(platformRake(1000)).toBe(50);
});
it("clamps the rake to 0–20%", () => {
  setRake(0.5);
  expect(platformRake(1000)).toBe(200);
  setRake(-1);
  expect(platformRake(1000)).toBe(0);
  setRake(DEFAULT_RAKE);
});
it("blocks opposing outcomes", () =>
  expect(canBuy([{ marketId: "m", outcome: "Yes", status: "open" }], "m", "No")).toBe(false));
it("allows same-side buys", () =>
  expect(canBuy([{ marketId: "m", outcome: "Yes", status: "open" }], "m", "Yes")).toBe(true));
it("locks the final 20 seconds against sniping", () => {
  expect(FLASH_LOCK_WINDOW_SECONDS).toBe(20);
  expect(canTradeFlash(20, false)).toBe(false);
  expect(canTradeFlash(21, false)).toBe(true);
});
it("the same price move is more decisive as the round runs out", () => {
  const early = flashProbability(100.01, 100, 55);
  const late = flashProbability(100.01, 100, 21);
  expect(late).toBeGreaterThan(early);
  expect(flashProbability(100, 100, 21)).toBe(0.5);
});
it("caps multipliers to the net pool after rake", () => {
  expect(parimutuelMultiplier(0.5, 100, 400)).toBe(1.9);
  expect(parimutuelMultiplier(0.5, 100, 160)).toBe(1.52);
  expect(parimutuelMultiplier(0.5, 100, 160, 0.08)).toBe(1.47);
});
it("blocks another Flash trade in the same round", () =>
  expect(canTradeFlash(30, true)).toBe(false));
it("enforces 3–16 character handles", () => {
  expect(validHandle("ab")).toBe(false);
  expect(validHandle("abc")).toBe(true);
  expect(validHandle("abcdefghijklmnop")).toBe(true);
  expect(validHandle("abcdefghijklmnopq")).toBe(false);
});
it("normalizes Kenyan mobile numbers", () => {
  expect(normalizePhone("0712345678")).toBe("+254712345678");
  expect(normalizePhone("+254112345678")).toBe("+254112345678");
  expect(normalizePhone("234")).toBe(null);
});
import {
  seedSplit,
  disputeOpen,
  needsWithdrawalApproval,
  platformRake,
  DEFAULT_MARKET_SEED,
} from "@/lib/trading-rules";
describe("Admin rules", () => {
  it("splits the KES 200 default seed 100/100 on a 2-way market", () =>
    expect(seedSplit(DEFAULT_MARKET_SEED, 2)).toEqual([100, 100]));
  it("splits KES 300 into 100 each on a 3-way market", () =>
    expect(seedSplit(300, 3)).toEqual([100, 100, 100]));
  it("keeps the dispute window open at 59 minutes", () =>
    expect(disputeOpen(0, 59 * 60_000)).toBe(true));
  it("closes the dispute window at 60 minutes", () =>
    expect(disputeOpen(0, 60 * 60_000)).toBe(false));
  it("requires approval for withdrawals above KES 10,000", () => {
    expect(needsWithdrawalApproval(10_000)).toBe(false);
    expect(needsWithdrawalApproval(10_001)).toBe(true);
  });
  it("takes the default 5% rake", () => expect(platformRake(1000)).toBe(50));
});

import { parimutuelMultiplier as pm } from "@/lib/trading-rules";
describe("flash penny favorites", () => {
  it("pays the 80% favorite at most 1.05x", () => {
    expect(pm(0.8, 1, 1000, 0.05)).toBeLessThanOrEqual(1.05);
  });
  it("keeps the 20% underdog above 4x", () => {
    expect(pm(0.2, 100, 1000, 0.05)).toBeGreaterThan(4);
  });
});

import { eventPoolSettlement, DEFAULT_EVENT_POT_RAKE_BPS, rewardsStorageKey } from "@/lib/trading-rules";
describe("Event market pot rake", () => {
  it("defaults to 500 bps", () => expect(DEFAULT_EVENT_POT_RAKE_BPS).toBe(500));
  it("deducts exactly 5% from the losing pot only", () =>
    expect(eventPoolSettlement(1000, 2000)).toMatchObject({ rake: 100, distributablePool: 2900 }));
  it("pays winners 2.9x on a 1000 vs 2000 pool", () =>
    expect(eventPoolSettlement(1000, 2000).multiplier).toBeCloseTo(2.9));
  it("takes nothing when the losing pot is empty", () =>
    expect(eventPoolSettlement(500, 0)).toMatchObject({ rake: 0, distributablePool: 500 }));
});
describe("Rewards storage isolation", () => {
  it("scopes to the user id", () => expect(rewardsStorageKey("u1")).toBe("polka-rewards-u1"));
  it("falls back to guest", () => expect(rewardsStorageKey(null)).toBe("polka-rewards-guest"));
  it("differs between accounts", () => expect(rewardsStorageKey("a")).not.toBe(rewardsStorageKey("b")));
});

import {
  REFERRAL_ZERO_FEE_MS,
  isZeroFeeActive,
  zeroFeeRemainingMs,
  effectiveRake,
  referralSplit,
} from "@/lib/trading-rules";
import { niceDomain, fmtAxisKES } from "@/lib/markets";

describe("referral fee rules", () => {
  const t0 = 1_700_000_000_000;
  it("referred users pay zero fees for 24 hours", () => {
    const u = { referredBy: "amina", joinedAt: t0 };
    expect(isZeroFeeActive(u, t0 + 23 * 3600_000)).toBe(true);
    expect(isZeroFeeActive(u, t0 + REFERRAL_ZERO_FEE_MS)).toBe(false);
    expect(effectiveRake(0.05, true)).toBe(0);
    expect(effectiveRake(0.05, false)).toBe(0.05);
  });
  it("non-referred users never get the zero-fee window", () => {
    expect(zeroFeeRemainingMs({ joinedAt: t0 }, t0)).toBe(0);
  });
  it("referrer earns a flat 10% of fees", () => {
    expect(referralSplit(50, true)).toEqual({ referrer: 5, platform: 45 });
    expect(referralSplit(50, false)).toEqual({ referrer: 0, platform: 50 });
  });
});

describe("portfolio axis", () => {
  it("labels real shilling amounts", () => {
    expect(fmtAxisKES(1200)).toBe("KSh 1,200");
    expect(fmtAxisKES(-300)).toBe("−KSh 300");
  });
  it("rounds range to nice steps", () => {
    expect(niceDomain([0, 430])).toEqual([0, 500]);
  });
});

import { tradeCommission, referralLedgerKey } from "@/lib/trading-rules";
describe("referral commission per trade", () => {
  it("pays the referrer 10% of a 5% fee on a KES 1,000 trade", () => {
    expect(tradeCommission(1000, 0.05, false)).toEqual({ fee: 50, commission: 5 });
  });
  it("pays nothing while the friend's fees are waived", () => {
    expect(tradeCommission(1000, 0.05, true)).toEqual({ fee: 0, commission: 0 });
  });
  it("keys ledgers per referrer handle", () => {
    expect(referralLedgerKey("@Kibet_22")).toBe("polka-ref-ledger-kibet_22");
  });
});

import { safeQuote } from "@/lib/trading-rules";
describe("safeQuote pool cap", () => {
  it("caps a KES 10,000 bet at 2.0x on a KES 2,000 pool to the pool after 5% rake", () => {
    const q = safeQuote(10_000, 0.5, 2_000, 0.05);
    expect(q.payout).toBe(11_400);
    expect(q.capped).toBe(true);
  });
  it("leaves small bets on deep pools at spot odds", () => {
    expect(safeQuote(100, 0.5, 1_000_000, 0.05)).toEqual({ mult: 2, payout: 200, capped: false });
  });
  it("caps longshots in multi-outcome markets", () => {
    expect(safeQuote(1_000, 0.05, 2_000, 0.05).payout).toBe(2_850);
  });
});

import { autoScaleDomain, nextEatClose, eatTarget, vaultPost, getVault } from "@/lib/trading-rules";
describe("part 1 rules", () => {
  it("zooms the axis to a tight 40-60% band", () => {
    const { domain } = autoScaleDomain([0.42, 0.55, 0.58]);
    expect(domain[0]).toBeGreaterThanOrEqual(0.35);
    expect(domain[1]).toBeLessThanOrEqual(0.65);
  });
  it("never leaves 0-100%", () => {
    const { domain } = autoScaleDomain([0.01, 0.99]);
    expect(domain).toEqual([0, 1]);
  });
  it("next EAT close after 10:00 EAT is 12:00 EAT", () => {
    const now = Date.UTC(2026, 10, 3, 7, 0); // 10:00 EAT
    expect(nextEatClose(now)).toBe(Date.UTC(2026, 10, 3, 9, 0));
  });
  it("BTC target rounds up to $500", () => {
    expect(eatTarget(67120)).toBe(67500);
  });
  it("vault refuses a seed larger than its balance", () => {
    expect(vaultPost("seed", -(getVault().balance + 1), "x")).toBe(false);
  });
});

import { eatProbability, normalCdf } from "@/lib/trading-rules";
describe("EAT probability engine", () => {
  it("normal CDF is symmetric around 0.5", () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 5);
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 3);
  });
  it("spot above target favours YES; below favours NO", () => {
    expect(eatProbability(100_000, 95_000, 3 * 3600_000, 0.55)).toBeGreaterThan(0.9);
    expect(eatProbability(90_000, 95_000, 3 * 3600_000, 0.55)).toBeLessThan(0.1);
  });
  it("more time left pulls probability toward 50%", () => {
    const near = eatProbability(96_000, 95_000, 600_000, 0.55);
    const far = eatProbability(96_000, 95_000, 12 * 3600_000, 0.55);
    expect(near).toBeGreaterThan(far);
  });
  it("clamps to 2%–98% so both sides stay tradable", () => {
    expect(eatProbability(200_000, 95_000, 1000)).toBe(0.98);
    expect(eatProbability(10_000, 95_000, 1000)).toBe(0.02);
  });
});
