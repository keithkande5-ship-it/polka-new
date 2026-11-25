import { useState, useEffect } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  fmtCompact,
  toMultiplier,
  useMarket,
  type Market,
  type Outcome,
} from "@/lib/markets";
import { useStore } from "@/lib/store";
import { Thumb, Crest } from "./ui";
import { Odometer } from "./Odometer";
import { cn } from "@/lib/utils";
import { CheckCircle2, AlertCircle } from "lucide-react";

const OUTCOME_COLORS = [
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

  if (totalSec < 60) {
    return (
      <span className="flex items-center gap-1 font-bold text-no animate-pulse">
        <Odometer value={totalSec} format={(v) => `${Math.round(v)}`} />
        <span>sec remaining</span>
      </span>
    );
  }

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
  const isMulti = !sport && m.outcomes.length > 2;
  const isEat = Boolean(m.eat);

  const handleOutcomeClick = (e: React.MouseEvent, outcome: Outcome) => {
    e.preventDefault();
    e.stopPropagation();

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

  // 1. SPORTS FIXTURE CARD (Exact match to IMG_20261117_091048.jpg)
  if (sport) {
    const homeProb = m.outcomes[0]?.prob ?? 0.45;
    const drawProb = m.outcomes.length === 3 ? m.outcomes[1]?.prob ?? 0.23 : 0;
    const awayProb = m.outcomes.length === 3 ? m.outcomes[2]?.prob ?? 0.32 : m.outcomes[1]?.prob ?? 0.35;

    const homeShort = sport.home.split(" ")[0]?.toUpperCase() ?? "HOME";
    const awayShort = sport.away.split(" ")[0]?.toUpperCase() ?? "AWAY";

    return (
      <div className="group relative flex flex-col justify-between rounded-2xl border border-border bg-card p-3.5 transition-all hover:border-primary/50 min-h-[160px]">
        {/* Header: Kickoff · Vol · League */}
        <div className="flex items-center justify-between text-xs text-muted-foreground border-b border-border/40 pb-2">
          <div className="flex items-center gap-1.5 font-semibold text-foreground">
            {sport.liveMin !== undefined ? (
              <span className="flex items-center gap-1 text-up font-bold animate-pulse">
                <span className="h-1.5 w-1.5 rounded-full bg-up" /> {sport.liveMin}&apos;
              </span>
            ) : (
              <span>{sport.kickoff || "Today"}</span>
            )}
            <span>·</span>
            <span>KES {fmtCompact(m.volume)} Vol</span>
          </div>
          <span className="font-bold uppercase tracking-wider text-[11px] text-muted-foreground">
            {sport.league}
          </span>
        </div>

        {/* Stacked Teams with Transparent Crests and Probabilities */}
        <div className="my-2.5 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <Crest name={sport.home} src={sport.homeCrest} size={24} />
              <span className="text-sm font-semibold text-foreground truncate">{sport.home}</span>
            </div>
            <span className="num text-sm font-bold text-foreground shrink-0 tabular">
              {Math.round(homeProb * 100)}%
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <Crest name={sport.away} src={sport.awayCrest} size={24} />
              <span className="text-sm font-semibold text-foreground truncate">{sport.away}</span>
            </div>
            <span className="num text-sm font-bold text-foreground shrink-0 tabular">
              {Math.round(awayProb * 100)}%
            </span>
          </div>
        </div>

        {/* Bottom 3 Chunky 1X2 Buttons */}
        <div className="grid grid-cols-3 gap-1.5 pt-1">
          {m.outcomes.map((o, idx) => {
            const shortLabel =
              idx === 0
                ? homeShort
                : idx === 1 && m.outcomes.length === 3
                ? "DRAW"
                : awayShort;
            return (
              <button
                key={o.id}
                onClick={(e) => handleOutcomeClick(e, o)}
                className="chunky-solid h-8 rounded-lg bg-secondary text-secondary-foreground border border-border text-xs font-bold hover:bg-muted transition-transform flex items-center justify-center gap-1 px-1"
              >
                <span className="truncate">{shortLabel}</span>
                <span className="num">{Math.round(o.prob * 100)}%</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // 2. LIVE EAT CARD (Side-by-side Yes/No + Orange Current / Green Target)
  if (isEat && m.eat) {
    return (
      <div className="group relative flex flex-col justify-between rounded-2xl border border-border bg-card p-3.5 transition-all hover:border-primary/50 min-h-[160px]">
        <div>
          <div className="flex items-start gap-3">
            <Thumb m={m} size={40} />
            <div className="min-w-0 flex-1">
              <Link
                to="/market/$id"
                params={{ id: m.id }}
                className="line-clamp-2 text-sm font-semibold leading-snug text-foreground hover:text-primary transition-colors"
              >
                {m.question}
              </Link>
              <div className="mt-1 flex items-center gap-1.5 text-xs font-semibold tabular">
                <span className="text-amber-500">Current: KES {m.eat.currentPrice?.toFixed(2) ?? "—"}</span>
                <span className="text-muted-foreground">/</span>
                <span className="text-emerald-500">Target: KES {m.eat.targetPrice?.toFixed(2) ?? "—"}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="my-2.5 grid grid-cols-2 gap-2">
          {m.outcomes.map((o, idx) => (
            <button
              key={o.id}
              onClick={(e) => handleOutcomeClick(e, o)}
              className={cn(
                "chunky-solid h-8 rounded-lg text-xs font-bold text-white",
                idx === 0 ? "bg-yes" : "bg-no"
              )}
            >
              {o.label} {Math.round(o.prob * 100)}%
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
          <span className="font-semibold tabular">KES {fmtCompact(m.volume)} Vol</span>
          <div className="tabular font-bold text-no animate-pulse">
            <CardCountdown closesAt={m.closesAt} label={m.endsLabel} />
          </div>
        </div>
      </div>
    );
  }

  // 3. MULTI-OUTCOME CARD (Exact match to Screenshot_2026-11-17-09-10-16-334)
  if (isMulti) {
    const topOutcomes = m.outcomes.slice(0, 2);
    const extraCount = m.outcomes.length - 2;

    return (
      <div className="group relative flex flex-col justify-between rounded-2xl border border-border bg-card p-3.5 transition-all hover:border-primary/50 min-h-[160px]">
        <div className="flex items-start gap-3">
          <Thumb m={m} size={40} />
          <div className="min-w-0 flex-1">
            <Link
              to="/market/$id"
              params={{ id: m.id }}
              className="line-clamp-2 text-sm font-semibold leading-snug text-foreground hover:text-primary transition-colors"
            >
              {m.question}
            </Link>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {m.category} {isClosed ? "· Closed" : ""}
            </p>
          </div>
        </div>

        <div className="my-2.5 space-y-2">
          {isResolved ? (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-2 text-xs font-semibold text-emerald-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Winner: {m.resolution?.winnerOutcomeId ?? "Settled"}</span>
            </div>
          ) : isDisputed ? (
            <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/30 p-2 text-xs font-semibold text-amber-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>In Dispute · AI Review</span>
            </div>
          ) : (
            topOutcomes.map((o, idx) => {
              const color = OUTCOME_COLORS[idx % OUTCOME_COLORS.length];
              return (
                <div key={o.id} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {o.img ? (
                      <img src={o.img} alt={o.label} className="size-5 rounded-full object-cover shrink-0" />
                    ) : (
                      <span
                        className="h-3.5 w-1 rounded-full shrink-0"
                        style={{ backgroundColor: color }}
                      />
                    )}
                    <span className="truncate text-xs font-semibold text-foreground">{o.label}</span>
                  </div>
                  <button
                    onClick={(e) => handleOutcomeClick(e, o)}
                    className="chunky-solid h-7 w-20 rounded-lg text-xs font-bold text-white transition-transform"
                    style={{ backgroundColor: color }}
                  >
                    <Odometer
                      value={oddsMode === "prob" ? o.prob * 100 : toMultiplier(o.prob)}
                      format={(v) => (oddsMode === "prob" ? `${Math.round(v)}%` : `${v.toFixed(2)}x`)}
                    />
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
          <span className="font-semibold tabular">KES {fmtCompact(m.volume)} Vol</span>
          {extraCount > 0 && (
            <Link to="/market/$id" params={{ id: m.id }} className="font-bold text-primary hover:underline">
              +{extraCount} more
            </Link>
          )}
          <div className="tabular">
            <CardCountdown closesAt={m.closesAt} label={m.endsLabel} />
          </div>
        </div>
      </div>
    );
  }

  // 4. STANDARD BINARY MARKET (Stacked Yes/No with 2px indicator bar)
  const yesOutcome = m.outcomes[0];
  const noOutcome = m.outcomes[1];

  return (
    <div className="group relative flex flex-col justify-between rounded-2xl border border-border bg-card p-3.5 transition-all hover:border-primary/50 min-h-[160px]">
      <div className="flex items-start gap-3">
        <Thumb m={m} size={40} />
        <div className="min-w-0 flex-1">
          <Link
            to="/market/$id"
            params={{ id: m.id }}
            className="line-clamp-2 text-sm font-semibold leading-snug text-foreground hover:text-primary transition-colors"
          >
            {m.question}
          </Link>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {m.category} {isClosed ? "· Closed" : ""}
          </p>
        </div>
      </div>

      <div className="my-2.5 space-y-2">
        {isResolved ? (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-2 text-xs font-semibold text-emerald-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>Winner: {m.resolution?.winnerOutcomeId ?? "Settled"} · Paid out</span>
          </div>
        ) : isDisputed ? (
          <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/30 p-2 text-xs font-semibold text-amber-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>In Dispute · AI Review</span>
          </div>
        ) : (
          <>
            {yesOutcome && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-4 w-1 rounded-full bg-yes" />
                  <span className="text-xs font-semibold text-foreground">Yes</span>
                </div>
                <button
                  onClick={(e) => handleOutcomeClick(e, yesOutcome)}
                  className="chunky-solid h-7 w-20 rounded-lg bg-yes text-xs font-bold text-white hover:brightness-105 transition-transform"
                >
                  <Odometer
                    value={oddsMode === "prob" ? yesOutcome.prob * 100 : toMultiplier(yesOutcome.prob)}
                    format={(v) => (oddsMode === "prob" ? `${Math.round(v)}%` : `${v.toFixed(2)}x`)}
                  />
                </button>
              </div>
            )}

            {noOutcome && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-4 w-1 rounded-full bg-no" />
                  <span className="text-xs font-semibold text-foreground">No</span>
                </div>
                <button
                  onClick={(e) => handleOutcomeClick(e, noOutcome)}
                  className="chunky-solid h-7 w-20 rounded-lg bg-no text-xs font-bold text-white hover:brightness-105 transition-transform"
                >
                  <Odometer
                    value={oddsMode === "prob" ? noOutcome.prob * 100 : toMultiplier(noOutcome.prob)}
                    format={(v) => (oddsMode === "prob" ? `${Math.round(v)}%` : `${v.toFixed(2)}x`)}
                  />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
        <span className="font-semibold tabular">KES {fmtCompact(m.volume)} Vol</span>
        <div className="tabular">
          <CardCountdown closesAt={m.closesAt} label={m.endsLabel} />
        </div>
      </div>
    </div>
  );
}
