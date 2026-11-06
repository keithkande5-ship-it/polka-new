import { useEffect, useState } from "react";
import { assets, useLivePrice } from "@/lib/crypto";
import type { Market } from "@/lib/markets";
import { EAT_ASSETS, closeDueEatRounds, ensureEatRounds, repriceEatRounds, lastPrice, reportPrice, useEatRounds } from "@/lib/eat-markets";
import { cn } from "@/lib/utils";

function Feed({ sym }: { sym: string }) {
  const a = assets.find((x) => x.sym === sym)!;
  const { price, status } = useLivePrice(a);
  useEffect(() => {
    if (status === "live" && price) reportPrice(sym, price);
  }, [price, status, sym]);
  return null;
}

/** Mounted once: feeds live prices and runs the daily round scheduler. */
export function EatDriver() {
  useEffect(() => {
    const tick = () => {
      closeDueEatRounds();
      ensureEatRounds();
      repriceEatRounds();
    };
    const t = setInterval(tick, 5000);
    tick();
    return () => clearInterval(t);
  }, []);
  return (
    <>
      {EAT_ASSETS.map((a) => (
        <Feed key={a.sym} sym={a.sym} />
      ))}
    </>
  );
}

function usePrice(sym: string) {
  const [p, setP] = useState<number | null>(null);
  useEffect(() => {
    const t = setInterval(() => setP(lastPrice(sym)), 1000);
    setP(lastPrice(sym));
    return () => clearInterval(t);
  }, [sym]);
  return p;
}
const usd = (v: number) => `$${v.toLocaleString("en-US", { maximumFractionDigits: v < 10 ? 4 : 2 })}`;

/** Target vs current price with a fill bar and superscript delta. */
export function EatTargetBar({ m, compact = false }: { m: Market; compact?: boolean }) {
  const eat = m.eat!;
  const live = usePrice(eat.sym);
  const settled = m.proposed || m.finalOutcome;
  const cur = live ?? eat.target;
  const delta = ((cur - eat.target) / eat.target) * 100;
  const above = cur > eat.target;
  // Race window: bar starts empty 3% below target and fills to 100% at the finish line.
  const pct = above ? 100 : Math.max(0, Math.min(100, ((cur / eat.target - 0.97) / 0.03) * 100));
  const gap = Math.abs(eat.target - cur);
  return (
    <div className={cn("rounded-lg border bg-secondary/40", compact ? "mt-2 px-2.5 py-2" : "px-3 py-3")}>
      <div className="flex items-end justify-between gap-3 text-xs">
        <div>
          <div className="text-muted-foreground">{settled ? "Status" : "Current price"}</div>
          <div className={cn("num font-semibold transition-colors", compact ? "text-sm" : "text-lg", above ? "text-up" : "text-down")}>
            {live ? usd(cur) : "—"}
            {live && (
              <sup className="ml-0.5 text-[10px]">
                {delta >= 0 ? "+" : ""}
                {delta.toFixed(2)}%
              </sup>
            )}
          </div>
        </div>
        {live && (
          <span className={cn("num self-center rounded-full px-2 py-0.5 text-[10px] font-bold", above ? "bg-up/15 text-up" : "bg-muted text-muted-foreground")}>
            {above ? `PROFIT +${usd(gap)}` : `${usd(gap)} to target`}
          </span>
        )}
        <div className="text-right">
          <div className="text-muted-foreground">Target 🏁</div>
          <div className={cn("num font-semibold", compact ? "text-sm" : "text-lg")}>{usd(eat.target)}</div>
        </div>
      </div>
      <div className="relative mt-2 h-2 overflow-hidden rounded-full bg-muted" aria-label="Race to target">
        <div className={cn("h-full rounded-full transition-all duration-700 ease-out", above ? "bg-up" : "bg-chart-4")} style={{ width: `${pct}%` }} />
        <div className="absolute inset-y-0 right-0 w-0.5 bg-foreground/60" />
      </div>
    </div>
  );
}

/** Streak pill and past rounds list, shown under the chart. */
export function EatRounds({ sym }: { sym: string }) {
  const rounds = useEatRounds(sym);
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-xl border bg-card p-3">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold"
          aria-expanded={open}
        >
          PAST ▾
          <span className="flex gap-0.5">
            {rounds.slice(0, 5).map((r) => (
              <span key={r.close} className={r.outcome === "Yes" ? "text-up" : r.outcome === "No" ? "text-down" : "text-muted-foreground"}>
                {r.outcome === "Yes" ? "▲" : r.outcome === "No" ? "▼" : "•"}
              </span>
            ))}
          </span>
        </button>
        <span className="ml-auto flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-semibold">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-up" /> TODAY
        </span>
      </div>
      {open && (
        <div className="mt-3 divide-y text-xs">
          {rounds.length === 0 && <p className="py-2 text-muted-foreground">No rounds have closed yet. Rounds close at 12:00, 18:00 and 23:59 EAT.</p>}
          {rounds.map((r) => (
            <div key={r.close} className="flex items-center justify-between gap-3 py-2">
              <span>
                {new Date(r.close).toLocaleString("en-KE", { timeZone: "Africa/Nairobi", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              </span>
              <span className="num text-muted-foreground">
                {r.settle ? usd(r.settle) : "Feed unavailable"} vs {usd(r.target)}
              </span>
              <span
                className={cn(
                  "rounded px-2 py-0.5 font-bold",
                  r.outcome === "Yes" ? "bg-up/15 text-up" : r.outcome === "No" ? "bg-down/15 text-down" : "bg-muted text-muted-foreground",
                )}
              >
                {r.outcome ? r.outcome.toUpperCase() : "REVIEW"}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
