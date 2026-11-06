import { describe, expect, it } from "vitest";
import {
  expiryBucket,
  extendMarketClose,
  opsTapSequence,
  settlementGuard,
  settlementPreview,
  solvencyCoverage,
} from "@/lib/trading-rules";

describe("Admin safeguards and finance rules", () => {
  it("requires both verified sources and exactly CONFIRM", () => {
    expect(settlementGuard(true, "CONFIRM")).toBe(true);
    expect(settlementGuard(false, "CONFIRM")).toBe(false);
    expect(settlementGuard(true, "confirm")).toBe(false);
  });
  it("places only markets less than 24 hours away in closing soon", () => {
    expect(expiryBucket(1000, 1000)).toBe("expired");
    expect(expiryBucket(1000 + 24 * 3600000 - 1, 1000)).toBe("soon");
    expect(expiryBucket(1000 + 24 * 3600000, 1000)).toBe("scheduled");
  });
  it.each([2, 6, 24] as const)("extends expired close from now by %i hours", (hours) => {
    expect(extendMarketClose(500, 1000, hours)).toBe(1000 + hours * 3600000);
  });
  it("covers wallet balances and open liabilities at 100 percent", () => {
    expect(solvencyCoverage(300, 100, 200)).toEqual({ required: 300, percent: 100, covered: true });
    expect(solvencyCoverage(299, 100, 200).covered).toBe(false);
  });
  it("VOID refunds 100 percent and retains no rake", () => {
    expect(
      settlementPreview(
        [
          { outcome: "Yes", stake: 100, mult: 1.9 },
          { outcome: "No", stake: 200, mult: 2.1 },
        ],
        "VOID",
      ),
    ).toEqual({ count: 2, payout: 300, rake: 0 });
  });
  it("previews actual quoted payouts and 5 percent losing-pot rake", () => {
    expect(
      settlementPreview(
        [
          { outcome: "Yes", stake: 100, mult: 1.9 },
          { outcome: "No", stake: 200, mult: 2.1 },
        ],
        "Yes",
      ),
    ).toEqual({ count: 1, payout: 190, rake: 10 });
  });
  it("unlocks only after five taps within three seconds", () => {
    expect(opsTapSequence([0, 500, 1000, 1500], 2500).unlocked).toBe(true);
    expect(opsTapSequence([0, 500, 1000, 1500], 3501).unlocked).toBe(false);
    expect(opsTapSequence([0, 500, 1000], 1500).unlocked).toBe(false);
  });
});
