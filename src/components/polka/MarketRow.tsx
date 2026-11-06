import { EatTargetBar } from "./EatPanels";
import { Countdown } from "./Countdown";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  fmtCompact,
  fmtOutcome,
  toMultiplier,
  useMarket,
  type Market,
  type Outcome,
} from "@/lib/markets";
import { useStore } from "@/lib/store";
import { Btn3D, CrestPair, Thumb } from "./ui";
import { Odometer } from "./Odometer";
import { cn } from "@/lib/utils";
import { MarketClosed } from "./MarketClosed";
import { marketBadge, type MarketBadge } from "@/lib/market-presentation";

const badgeTone: Record<MarketBadge["tone"], string> = {
  new: "bg-primary/15 text-primary",
  closing: "bg-chart-4/15 text-chart-4",
  vol: "bg-chart-5/15 text-chart-5",
  live: "bg-up/15 text-up",
  tossup: "bg-down/15 text-down",
  resolving: "bg-secondary text-foreground",
};

export function BadgePill({ b }: { b: MarketBadge }) {
  return (
    <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide", badgeTone[b.tone])}>
      {b.label}
    </span>
  );
}

export function OutcomeButton({
  m,
  o,
  idx,
  className,
}: {
  m: Market;
  o: Outcome;
  idx: number;
  className?: string;
}) {
  const { oddsMode, openSlip, slip, user, addPosition, balance, openCashier } = useStore();
  const binary = m.outcomes.length === 2;
  const variant = binary ? (idx === 0 ? "up-soft" : "down-soft") : "surface";
  const active = slip?.marketId === m.id && slip.outcomeId === o.id;
  if ((m.state ?? "open") !== "open") return <MarketClosed m={m} />;
  return (
    <Btn3D
      variant={variant}
      onClick={() => {
        if (user?.oneClick) {
          const amount = user.quickAmounts[0] ?? 50;
          if (amount > balance) return openCashier("deposit", amount - balance);
          addPosition({
            marketId: m.id,
            title: m.question,
            outcome: o.label,
            stake: amount,
            mult: toMultiplier(o.prob),
          });
          return;
        }
        openSlip(m.id, o.id);
      }}
      className={cn(
        "h-10 min-w-0 justify-between px-3 text-sm",
        active && "ring-2 ring-primary",
        className,
      )}
    >
      <span className="truncate">{o.label}</span>
      <Odometer
        value={oddsMode === "prob" ? o.prob * 100 : toMultiplier(o.prob)}
        format={(v) => (oddsMode === "prob" ? `${Math.round(v)}%` : `${v.toFixed(2)}x`)}
        className="shrink-0 font-bold"
      />
    </Btn3D>
  );
}

export function MarketRow({ m: base, volRank = -1 }: { m: Market; volRank?: number }) {
  const m = useMarket(base.id) ?? base;
  const badge = marketBadge(m, volRank, Date.now());
  const top = [...m.outcomes].sort((a, b) => b.prob - a.prob);
  const shown = m.outcomes.length > 2 ? top.slice(0, 2) : m.outcomes;
  const extra = m.outcomes.length - 2;
  const s = m.sport;
  return (
    <div className="grid gap-3 border-b px-3 py-3 transition-colors hover:bg-muted/40 md:grid-cols-[minmax(0,1fr)_340px] md:items-center md:px-4">
      <Link to="/market/$id" params={{ id: m.id }} className="group flex min-w-0 items-center gap-3">
        {s ? (
          <CrestPair home={s.home} away={s.away} homeSrc={s.homeCrest} awaySrc={s.awayCrest} />
        ) : (
          <Thumb m={m} />
        )}
        <div className="min-w-0">
          <p className="line-clamp-2 text-[15px] font-medium leading-snug underline-offset-4 md:group-hover:text-primary md:group-hover:underline">{m.question}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {badge && <BadgePill b={badge} />}
            {s?.liveMin !== undefined && (m.state ?? "open") === "open" && (
              <span className="font-bold text-up">{s.liveMin}&apos;</span>
            )}
            <span className="num rounded bg-secondary px-1.5 py-0.5 font-medium text-foreground/80">
              KES {fmtCompact(m.volume)} Vol
            </span>
            <span>{s ? s.league : m.category}</span>
            <span>·</span>
            <Countdown closesAt={m.closesAt} label={m.endsLabel} />
          </div>
          {m.eat && <EatTargetBar m={m} compact />}
        </div>
      </Link>
      <div className="flex flex-col gap-2">
        {(m.state ?? "open") !== "open" ? <MarketClosed m={m} /> : <>
        <div className="grid grid-cols-2 gap-2">
          {shown.map((o) => (
            <OutcomeButton key={o.id} m={m} o={o} idx={m.outcomes.indexOf(o)} />
          ))}
        </div>
        {extra > 0 && (
          <Link
            to="/market/$id"
            params={{ id: m.id }}
            className="w-full rounded-md bg-secondary px-2 py-1 text-center text-xs font-medium text-muted-foreground hover:text-foreground md:w-auto md:self-start"
          >
            +{extra} more
          </Link>
        )}
        </>}
      </div>
    </div>
  );
}
