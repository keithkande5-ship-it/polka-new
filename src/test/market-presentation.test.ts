import { beforeEach, describe, expect, it } from "vitest";
import { appendReply, readMarketComments, saveMarketComments, marketCommentsKey } from "@/lib/market-comments";
import { FLASH_RESULT_DISPLAY_MS, outcomeTone } from "@/lib/market-presentation";
import { type Comment, type Market } from "@/lib/markets";

const mk = (id: string, labels: string[]): Market => ({ id, question: id, category: "Test", thumb: { text: "T", tone: "primary" }, volume: 0, endsLabel: "", outcomes: labels.map((l, i) => ({ id: String(i), label: l, prob: 1 / labels.length })), rules: "", oracle: "", news: [], comments: [] });
const markets = [mk("cbk-rate-dec", ["Yes", "No"]), mk("harambee-uganda", ["Kenya", "Draw", "Uganda"])];

const comment: Comment = { id: "new", user: "keith", text: "Saved take", ago: "now", likes: 0 };

describe("Public market presentation rules", () => {
  it("shows a Flash result for eight seconds", () => {
    expect(FLASH_RESULT_DISPLAY_MS).toBe(8000);
  });
  it("uses electric blue for the Yes winner and red for No", () => {
    const market = markets.find((m) => m.id === "cbk-rate-dec");
    if (!market) throw new Error("Fixture missing");
    expect(outcomeTone(market, 0, true)).toBe("winner-yes");
    expect(outcomeTone(market, 1, true)).toBe("down");
  });
  it("keeps multi-outcome winners on their chart tone", () => {
    const market = markets.find((m) => m.id === "harambee-uganda");
    if (!market) throw new Error("Fixture missing");
    expect(outcomeTone(market, 2, true)).toBe("chart-3");
  });
});

describe("Market discussion persistence", () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      clear: () => values.clear(),
    } });
  });
  it("restores a posted comment while keeping markets separate", () => {
    expect(saveMarketComments("cbk", [comment])).toBe(true);
    expect(readMarketComments("cbk", [])).toEqual([comment]);
    expect(readMarketComments("sports", [])).toEqual([]);
  });
  it("restores nested replies after a reload", () => {
    const reply = { ...comment, id: "reply", text: "Reply saved" };
    saveMarketComments("cbk", appendReply([comment], "new", reply));
    expect(readMarketComments("cbk", [])[0]?.replies).toEqual([reply]);
  });
  it("falls back safely when stored discussion data is invalid", () => {
    localStorage.setItem(marketCommentsKey("cbk"), JSON.stringify([{ id: "broken" }]));
    expect(readMarketComments("cbk", [comment])).toEqual([comment]);
  });
});