import { useState, useEffect } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  fmtCompact,
  fmtOutcome,
  toMultiplier,
  useMarket,
  type Market,
  type Outcome,
} from "@/lib/markets";
import { useStore } from "@/lib/store";
import { Thumb } from "./ui";
import { Odometer } from "./Odometer";
import { cn } from "@/lib/utils";
import { CheckCircle2, AlertCircle, Lock } from "lucide-react";

const CANDIDATE_COLORS = [
  "#2563EB", // Blue
  "#16A34A", // Emerald
  "#DC2626", // Red
  "#D97706", // Amber
  "#9333EA", // Purple
  "#0891B2", // Cyan
];

function CardCountdown({ closesAt, label }: { closesAt: number; label?: string }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const diffMs = closesAt - now;
  if (diffMs <= 0) return <span>{label ?? "Ended"}</span>;

  const totalSec = Math.floor(diffMs / 1000);
  const totalMin = Math.floor(totalSec / 60);
  const totalHrs = Math.floor(totalMin / 60);
  const totalDays = Math.floor(totalHrs / 24);

  // Over 1 hour: calm relative format
  if (totalDays >= 30) {
    const months = Math.floor(totalDays / 30);
    return <span>{months} {months === 1 ? "month" : "months"}</span>;
  }
  if (totalDays > 0) {
    return <span>{totalDays} {totalDays === 1 ? "day" : "days"}</span>;
  }
  if (totalHrs > 0) {
    return <span>{totalHrs} {totalHrs === 1 ? "hr" : "hrs"}</span>;
  }

  // Under 60 seconds: red urgent countdown with Odometer
  if (totalSec < 60) {
    return (
      <span className="flex items-center gap-1 font-bold text-no animate-pulse">
        <Odometer value={totalSec} format={(v) => `${Math.round(v)}`} />
        <span>sec remaining</span>
      </span>
    );
  }

  // Under 1 hour: urgent red "Xm Ys"
  const m = totalMin;
  const s = totalSec % 60;
  return (
    <span className="font-semibold text-no tabular">
      {m}m {s}s
    </span>
  );
}

export function MarketCard({ m: base }: { m: Market }) {
  const m = useMarket(base.id) ?? base;
  const navigate = useNavigate();
  const { oddsMode, openSlip, user, addPosition, balance, openCashier } = useStore();

  const isClosed = (m.state ?? "open") === "closed" || m.closesAt <= Date.now();
  const isDisputed = m.state === "disputed";
  const isResolved = m.state === "resolved";
  const sport = m.sport;
  const isBinary = !sport && m.outcomes.length === 2;
  const isMulti = !sport && m.outcomes.length > 2;
  const isEat = Boolean(m.eat);

  const handleOutcomeClick = (e: React.MouseEvent, outcome: Outcome) => {
    e.preventDefault();
    e.stopPropagation();

    if (isClosed || isDisputed || isResolved) {
      navigate({ to: "/market/$id", params: { id: m.id } });
      return;
    }

    if (user?.oneClick) {
      const amount = user.quickAmounts?.[0] ?? 50;
      if (amount > balance) return openCashier("deposit", amount - balance);
      addPosition({
        marketId: m.id,
        title: m.question,
        outcome: outcome.label,
        stake: amount,
        mult: toMultiplier(outcome.prob),
      });
      return;
    }

    openSlip(m.id, outcome.id);
    navigate({
      to: "/market/$id",
      params: { id: m.id },
      search: { outcome: outcome.id },
    });
  };

  return (
    <div className="group relative flex flex-col justify-between rounded-2xl border border-border bg-card p-3.5 transition-all hover:border-primary/50 min-h-[155px]">
      {/* 1. Top Header */}
      <div>
        <div className="flex items-start gap-2.5">
          {/* Square thumbnail for non-sports markets only */}
          {!sport && (
            <div className="shrink-0 size-10 rounded-lg overflow-hidden flex items-center justify-center">
              <Thumb m={m} />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <Link
              to="/market/$id"
              params={{ id: m.id }}
              className="line-clamp-2 text-sm font-semibold leading-snug text-foreground hover:text-primary transition-colors"
            >
              {m.question}
            </Link>
            <p className="mt-0.5 text-[11px] text-muted-foreground tabular">
              {sport?.kickoff
                ? `Kickoff: ${sport.kickoff}`
                : isEat
                ? `Round ${m.eat?.round ?? 1} · 60s Cycle`
                : `${m.category} · Ends ${m.endsLabel || "Soon"}`}
            </p>
          </div>
        </div>

        {/* EAT Price Info */}
        {isEat && m.eat && (
          <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold tabular">
            <span className="text-amber-500">Current: KES {m.eat.currentPrice?.toFixed(2) ?? "—"}</span>
            <span className="text-muted-foreground">/</span>
            <span className="text-emerald-500">Target: KES {m.eat.targetPrice?.toFixed(2) ?? "—"}</span>
          </div>
        )}
      </div>

      {/* 2. Middle Outcome Area */}
      <div className="my-2.5">
        {isResolved ? (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-2 text-xs font-semibold text-emerald-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>Winner: {m.resolution?.winnerOutcomeId ?? m.finalOutcome ?? "Settled"} · Paid out</span>
          </div>
        ) : isDisputed ? (
          <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/30 p-2 text-xs font-semibold text-amber-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>In Dispute · AI / Oracle Review</span>
          </div>
        ) : isClosed ? (
          <div className="flex items-center gap-2 rounded-lg bg-secondary/80 border border-border p-2 text-xs font-semibold text-muted-foreground">
            <Lock className="h-4 w-4 shrink-0" />
            <span>Market Closed · Trading Disabled</span>
          </div>
        ) : isBinary ? (
          /* Binary Markets: Stacked Yes/No with 2px indicator bar and chunky buttons */
          <div className="flex flex-col gap-1.5">
            {m.outcomes.map((o, idx) => {
              const isYes = idx === 0;
              return (
                <div key={o.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={cn("h-3.5 w-0.5 rounded-full", isYes ? "bg-yes" : "bg-no")} />
                    <span className="text-xs font-medium text-foreground">{o.label}</span>
                  </div>
                  <button
                    onClick={(e) => handleOutcomeClick(e, o)}
                    className={cn(
                      "chunky-solid h-7 w-20 rounded-lg text-xs font-bold text-white transition-transform",
                      isYes ? "bg-yes hover:brightness-105" : "bg-no hover:brightness-105"
                    )}
                  >
                    <Odometer
                      value={oddsMode === "prob" ? o.prob * 100 : toMultiplier(o.prob)}
                      format={(v) => (oddsMode === "prob" ? `${Math.round(v)}%` : `${v.toFixed(2)}x`)}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        ) : sport ? (
          /* Sports Fixtures: Stacked teams with transparent crest or dot + 3 outcome buttons */
          <div className="flex flex-col gap-2">
            <div className="space-y-1.5 text-xs">
              {/* Home Team */}
              <div className="flex items-center justify-between font-medium">
                <div className="flex items-center gap-2 min-w-0">
                  {sport.homeCrest ? (
                    <img
                      src={sport.homeCrest}
                      alt={sport.home}
                      className="h-4 w-4 shrink-0 bg-transparent object-contain"
                    />
                  ) : (
                    <span className="h-2 w-2 rounded-full shrink-0 bg-blue-500" />
                  )}
                  <span className="truncate text-foreground">{sport.home}</span>
                </div>
                <span className="text-muted-foreground font-semibold tabular">
                  {Math.round((m.outcomes[0]?.prob ?? 0.45) * 100)}%
                </span>
              </div>

              {/* Away Team */}
              <div className="flex items-center justify-between font-medium">
                <div className="flex items-center gap-2 min-w-0">
                  {sport.awayCrest ? (
                    <img
                      src={sport.awayCrest}
                      alt={sport.away}
                      className="h-4 w-4 shrink-0 bg-transparent object-contain"
                    />
                  ) : (
                    <span className="h-2 w-2 rounded-full shrink-0 bg-red-500" />
                  )}
                  <span className="truncate text-foreground">{sport.away}</span>
                </div>
                <span className="text-muted-foreground font-semibold tabular">
                  {Math.round((m.outcomes[2]?.prob ?? m.outcomes[1]?.prob ?? 0.3) * 100)}%
                </span>
              </div>
            </div>

            {/* 3 Outcome Buttons (Home / Draw / Away) */}
            <div className="grid grid-cols-3 gap-1.5">
              {m.outcomes.map((o) => (
                <button
                  key={o.id}
                  onClick={(e) => handleOutcomeClick(e, o)}
                  className="chunky-solid h-7 rounded-lg bg-secondary text-secondary-foreground border border-border text-[11px] font-bold hover:bg-muted"
                >
                  <span className="truncate block px-1">
                    {o.label.split(" ")[0]} {Math.round(o.prob * 100)}%
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : isMulti ? (
          /* Multi-Outcome Markets: Stacked candidates with distinct colors or avatar */
          <div className="flex flex-col gap-1.5">
            {m.outcomes.slice(0, 2).map((o, idx) => (
              <div key={o.id} className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                  {o.img ? (
                    <img src={o.img} alt={o.label} className="h-4 w-4 rounded-full object-cover shrink-0" />
                  ) : (
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: CANDIDATE_COLORS[idx % CANDIDATE_COLORS.length] }}
                    />
                  )}
                  <span className="truncate text-xs font-medium">{o.label}</span>
                </div>
                <button
                  onClick={(e) => handleOutcomeClick(e, o)}
                  className="chunky-solid h-6 w-16 rounded-md bg-secondary text-secondary-foreground border border-border text-[11px] font-bold"
                >
                  {Math.round(o.prob * 100)}%
                </button>
              </div>
            ))}
          </div>
        ) : (
          /* Default / EAT Yes/No side-by-side */
          <div className="grid grid-cols-2 gap-2">
            {m.outcomes.map((o, idx) => (
              <button
                key={o.id}
                onClick={(e) => handleOutcomeClick(e, o)}
                className={cn(
                  "chunky-solid h-7 rounded-lg text-xs font-bold text-white",
                  idx === 0 ? "bg-yes" : "bg-no"
                )}
              >
                {o.label} {Math.round(o.prob * 100)}%
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 3. Card Footer */}
      <div className="flex items-center justify-between border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
        <span className="font-semibold tabular">KES {fmtCompact(m.volume)} Vol</span>
        {isMulti && m.outcomes.length > 2 && (
          <Link to="/market/$id" params={{ id: m.id }} className="text-primary hover:underline">
            +{m.outcomes.length - 2} more
          </Link>
        )}
        <div className="tabular">
          <CardCountdown closesAt={m.closesAt} label={m.endsLabel} />
        </div>
      </div>
    </div>
  );
}
