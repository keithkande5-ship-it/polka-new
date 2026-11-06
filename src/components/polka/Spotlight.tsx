import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Flame, TrendingUp, Zap } from "lucide-react";
import { fmtCompact, genHistory, hashId, markets, useMarket, useMarketsVersion, type Market } from "@/lib/markets";
import { assets, fmtPrice, useLivePrice, useRound } from "@/lib/crypto";
import { flashMultipliers } from "@/lib/trading-rules";
import { CoinIcon } from "@/components/polka/CoinIcon";
import { Crest, Thumb } from "@/components/polka/ui";
import { cn } from "@/lib/utils";

function Spark({ points, color, h = 56, base }: { points: number[]; color: string; h?: number; base?: number | null }) {
  const w = 300;
  const all = base != null ? [...points, base] : points;
  const min = Math.min(...all);
  const max = Math.max(...all);
  const pad = (max - min) * 0.15 || 1;
  const lo = min - pad;
  const span = max + pad - lo;
  const y = (v: number) => h - ((v - lo) / span) * h;
  const pts = points.map((p, i) => [(i / (points.length - 1)) * w, y(p)] as const);
  // Catmull-Rom → cubic Bézier for a smooth curve instead of a zigzag.
  let d = `M${pts[0]![0]},${pts[0]![1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[i + 2] ?? p2;
    d += ` C${p1[0] + (p2[0] - p0[0]) / 6},${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6},${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]},${p2[1]}`;
  }
  const last = pts[pts.length - 1]!;
  const id = `sp${useId().replace(/:/g, "")}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full overflow-visible" style={{ height: h }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {base != null && (
        <line x1="0" x2={w} y1={y(base)} y2={y(base)} stroke="currentColor" strokeOpacity="0.45" strokeDasharray="4 4" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      )}
      <path d={`${d} L${w},${h} L0,${h} Z`} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={last[0]} cy={last[1]} r="4" fill={color} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

type Fill = { id: number; amt: number; up: boolean; x: number };

/** Simulated live fills that enter at the bottom and fade out at the top. */
function TradeTape() {
  const [fills, setFills] = useState<Fill[]>([]);
  useEffect(() => {
    let n = 0;
    const t = window.setInterval(() => {
      const f: Fill = { id: n++, amt: Math.round(50 + Math.random() ** 2 * 2400), up: Math.random() > 0.45, x: Math.random() * 30 };
      setFills((xs) => [...xs.slice(-5), f]);
    }, 1100);
    return () => window.clearInterval(t);
  }, []);
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-y-0 left-3 w-24 overflow-hidden"
      style={{ maskImage: "linear-gradient(to top, black 55%, transparent 100%)", WebkitMaskImage: "linear-gradient(to top, black 55%, transparent 100%)" }}
    >
      {fills.map((f) => (
        <span
          key={f.id}
          className={cn("num absolute bottom-0 text-xs font-bold animate-tape", f.up ? "text-up" : "text-down")}
          style={{ left: f.x }}
        >
          +KES {f.amt.toLocaleString("en-KE")}
        </span>
      ))}
    </div>
  );
}

const cardBase =
  "relative flex h-full min-h-[260px] flex-col overflow-hidden rounded-2xl border border-foreground/10 p-5 shadow-[var(--shadow-spot)] transition-transform duration-300 hover:-translate-y-0.5";

function SportsCard({ m: base }: { m: Market }) {
  const m = useMarket(base.id) ?? base;
  const s = m.sport!;
  const three = m.outcomes.length === 3;
  const codes = [s.home.slice(0, 3).toUpperCase(), ...(three ? ["DRAW"] : []), s.away.slice(0, 3).toUpperCase()];
  const tones = three ? ["bg-primary text-primary-foreground", "bg-foreground/10", "bg-down text-down-foreground"] : ["bg-primary text-primary-foreground", "bg-up text-up-foreground"];
  const kick = m.closesAt ? new Date(m.closesAt).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" }) : m.endsLabel;
  return (
    <Link to="/market/$id" params={{ id: m.id }} className={cardBase} style={{ background: "var(--gradient-fixture)" }}>
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider">
        {s.liveMin ? (
          <span className="flex items-center gap-1 rounded-full bg-down px-2 py-0.5 text-down-foreground">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-down-foreground" /> Live {s.liveMin}'
          </span>
        ) : (
          <span className="num rounded-full bg-foreground/10 px-2 py-0.5">{kick}</span>
        )}
        <span className="num rounded-full bg-foreground/10 px-2 py-0.5">KES {fmtCompact(m.volume)} Vol</span>
        <span className="ml-auto truncate text-muted-foreground">{s.league}</span>
      </div>
      <div className="my-auto space-y-3 py-4">
        {[
          [s.home, s.homeCrest],
          [s.away, s.awayCrest],
        ].map(([name, src]) => (
          <div key={name} className="flex items-center gap-3">
            <Crest name={name!} src={src} size={36} />
            <span className="truncate text-base font-bold">{name}</span>
          </div>
        ))}
      </div>
      <div className={cn("grid gap-2", three ? "grid-cols-3" : "grid-cols-2")}>
        {m.outcomes.map((o, i) => (
          <span key={o.id} className={cn("num flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-bold", tones[i])}>
            <span className="text-[11px] opacity-80">{codes[i]}</span>
            {(1 / o.prob).toFixed(2)}x
          </span>
        ))}
      </div>
    </Link>
  );
}

function FlashCard() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className={cn(cardBase, "animate-pulse")} style={{ background: "var(--gradient-flash)" }} />;
  return <FlashCardLive />;
}

function FlashCardLive() {
  const asset = assets[0]!;
  const { price, series, ready } = useLivePrice(asset);
  const { remaining } = useRound();
  const lock = series.find((t) => t.t >= Date.now() - (60 - remaining) * 1000)?.p ?? null;
  const mult = flashMultipliers(price, lock);
  const up = price && lock ? price >= lock : true;
  const pts = series.slice(-40).map((t) => t.p);
  const r = 18;
  const c = 2 * Math.PI * r;
  return (
    <div className={cardBase} style={{ background: "var(--gradient-flash)" }}>
      <div className="flex items-center gap-2">
        <CoinIcon symbol={asset.sym} />
        <span className="text-sm font-bold">BTC 60s Up or Down</span>
        <svg width="44" height="44" className="ml-auto -rotate-90">
          <circle cx="22" cy="22" r={r} stroke="var(--border)" strokeWidth="3" fill="none" />
          <circle cx="22" cy="22" r={r} stroke="var(--primary)" strokeWidth="3" fill="none" strokeDasharray={c} strokeDashoffset={c * (1 - remaining / 60)} strokeLinecap="round" />
          <text x="22" y="26" textAnchor="middle" fontSize="11" fontWeight="700" fill="currentColor" className="num rotate-90 origin-center">
            {remaining}s
          </text>
        </svg>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-up opacity-75" />
          <span className="relative h-2 w-2 rounded-full bg-up" />
        </span>
        {ready && price ? (
          <span className={cn("num text-3xl font-bold", up ? "text-up" : "text-down")}>${fmtPrice(price, asset.decimals)}</span>
        ) : (
          <span className="h-8 w-40 animate-pulse rounded bg-muted" />
        )}
      </div>
      <div className="relative my-auto py-2">
        <TradeTape />
        {pts.length > 2 && <Spark points={pts} base={lock} color={up ? "var(--up)" : "var(--down)"} h={72} />}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Link to="/flash" search={{ asset: "btc" }} className="num rounded-xl bg-up py-2.5 text-center text-sm font-bold text-up-foreground">
          ▲ Up {mult.up.toFixed(2)}x
        </Link>
        <Link to="/flash" search={{ asset: "btc" }} className="num rounded-xl bg-down py-2.5 text-center text-sm font-bold text-down-foreground">
          ▼ Down {mult.down.toFixed(2)}x
        </Link>
      </div>
    </div>
  );
}

function TrendCard({ m: base, hero }: { m: Market; hero?: boolean }) {
  const m = useMarket(base.id) ?? base;
  const top = [...m.outcomes].sort((a, b) => b.prob - a.prob)[0]!;
  const pts = useMemo(() => genHistory(hashId(m.id), m.outcomes[0]!.prob, 60).map((p) => p.p), [m.id, m.outcomes[0]!.prob]);
  const pct = Math.round(top.prob * 100);
  return (
    <Link to="/market/$id" params={{ id: m.id }} className={cardBase} style={{ background: "var(--gradient-trend)" }}>
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider">
        <span className="flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-primary-foreground">
          <Flame className="h-3 w-3" /> Breaking
        </span>
        <span className="text-muted-foreground">{m.category}</span>
        <span className="num ml-auto text-up">+{m.hot?.change ?? 0}%</span>
      </div>
      <div className="mt-3 flex gap-3">
        <Thumb m={m} size={hero ? 56 : 44} />
        <p className={cn("line-clamp-3 font-bold leading-snug", hero ? "text-xl md:text-2xl" : "text-base")}>{m.question}</p>
      </div>
      <div className="my-auto pt-3">
        <Spark points={pts} color="var(--primary)" h={hero ? 120 : 60} />
      </div>
      <div className="mt-2 flex items-end justify-between">
        <div>
          <span className="num text-3xl font-bold">{pct}%</span>
          <span className="ml-1.5 text-xs text-muted-foreground">{top.label}</span>
        </div>
        <span className="num text-xs text-muted-foreground">KES {fmtCompact(m.volume)} vol</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-foreground/10">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </Link>
  );
}

/** Featured stage: snap carousel on mobile, Polymarket-style hero stage on desktop. */
export function Spotlight() {
  const version = useMarketsVersion();
  const hot = useMemo(() => markets.filter((m) => m.featured ?? !!m.hot).sort((a, b) => Number(!!b.featured) - Number(!!a.featured) || (b.hot?.change ?? 0) - (a.hot?.change ?? 0)), [version]);
  const sport = hot.find((m) => m.sport) ?? markets.find((m) => m.sport);
  const trends = hot.filter((m) => !m.sport).slice(0, 3);
  const slides = [
    trends[0] && <TrendCard key="t0" m={trends[0]} hero />,
    sport && <SportsCard key="s" m={sport} />,
    <FlashCard key="f" />,
    ...trends.slice(1).map((m) => <TrendCard key={m.id} m={m} />),
  ].filter(Boolean);

  const ref = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);
  const [arrows, setArrows] = useState(true);
  const timer = useRef<number | undefined>(undefined);
  const wake = () => {
    setArrows(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setArrows(false), 1800);
  };
  useEffect(() => {
    wake();
    return () => window.clearTimeout(timer.current);
  }, []);
  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    const w = el.firstElementChild?.clientWidth ?? 1;
    setIdx(Math.round(el.scrollLeft / (w + 12)));
    wake();
  };
  const go = (d: number) => {
    const el = ref.current;
    const w = el?.firstElementChild?.clientWidth ?? 0;
    el?.scrollBy({ left: d * (w + 12), behavior: "smooth" });
  };

  // Mobile auto-advance: every 5s; any touch, drag or tap pauses for 7s of inactivity.
  const idleUntil = useRef(0);
  const holdMobile = () => {
    idleUntil.current = Date.now() + 7000;
  };
  const idxRef = useRef(0);
  idxRef.current = idx;
  useEffect(() => {
    const t = window.setInterval(() => {
      const el = ref.current;
      if (!el || el.offsetParent === null || Date.now() < idleUntil.current) return;
      const w = el.firstElementChild?.clientWidth ?? 0;
      const next = idxRef.current >= slides.length - 1 ? 0 : idxRef.current + 1;
      el.scrollTo({ left: next * (w + 12), behavior: "smooth" });
    }, 5000);
    return () => window.clearInterval(t);
  }, [slides.length]);

  // Desktop featured stage rotates through trending event markets every 6s; hover pauses.
  const featured = hot.filter((m) => !m.sport).slice(0, 5);
  const [stage, setStage] = useState(0);
  const [hovering, setHovering] = useState(false);
  const STAGE_MS = 6000;
  useEffect(() => {
    if (hovering || featured.length < 2) return undefined;
    const t = window.setTimeout(() => setStage((s) => (s + 1) % featured.length), STAGE_MS);
    return () => window.clearTimeout(t);
  }, [stage, hovering, featured.length]);
  const stageMarket = featured[stage % Math.max(1, featured.length)];

  return (
    <section className="pt-3 md:pt-0">
      <div className="mb-3 flex items-center gap-2 px-4 md:px-0">
        <Zap className="h-4 w-4 text-primary" />
        <span className="text-sm font-bold tracking-tight">Spotlight</span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <TrendingUp className="h-3.5 w-3.5" /> Trending now
        </span>
      </div>

      {/* Mobile carousel */}
      <div className="relative md:hidden">
        <div
          ref={ref}
          onScroll={onScroll}
          onTouchStart={() => {
            wake();
            holdMobile();
          }}
          onTouchMove={holdMobile}
          onPointerDown={holdMobile}
          onClickCapture={holdMobile}
          className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-[6vw] pb-2">
          {slides.map((s, i) => (
            <div key={i} className="w-[88vw] shrink-0 snap-center">
              {s}
            </div>
          ))}
        </div>
        <div className="pointer-events-none absolute inset-y-0 left-0 w-[6vw] bg-gradient-to-r from-background to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-[6vw] bg-gradient-to-l from-background to-transparent" />
        {[-1, 1].map((d) => (
          <button
            key={d}
            aria-label={d < 0 ? "Previous" : "Next"}
            onClick={() => {
              holdMobile();
              go(d);
            }}
            className={cn(
              "absolute top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-foreground/15 bg-background/40 backdrop-blur-md transition-opacity duration-500",
              d < 0 ? "left-2" : "right-2",
              arrows && (d < 0 ? idx > 0 : idx < slides.length - 1) ? "opacity-100" : "pointer-events-none opacity-0",
            )}
          >
            {d < 0 ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
          </button>
        ))}
        <div className="mt-2 flex justify-center gap-1.5">
          {slides.map((_, i) => (
            <span key={i} className={cn("h-1.5 rounded-full transition-all", i === idx ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/40")} />
          ))}
        </div>
      </div>

      {/* Desktop stage */}
      <div className="hidden gap-4 md:grid md:grid-cols-12 md:grid-rows-[auto_auto] md:items-stretch">
        <div
          className="relative md:col-span-7 md:row-span-2"
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => setHovering(false)}
        >
          {stageMarket ? (
            <div key={stageMarket.id} className="h-full animate-in fade-in duration-500">
              <TrendCard m={stageMarket} hero />
            </div>
          ) : (
            slides[0]
          )}
          {featured.length > 1 && (
            <div className="absolute inset-x-4 bottom-2 flex gap-1.5">
              {featured.map((f, i) => (
                <button
                  key={f.id}
                  aria-label={`Show featured market ${i + 1}`}
                  onClick={() => setStage(i)}
                  className="h-1 flex-1 overflow-hidden rounded-full bg-foreground/15"
                >
                  {i === stage % featured.length && (
                    <span
                      key={`${stage}-${hovering}`}
                      className="spotlight-progress block h-full rounded-full bg-primary"
                      style={{
                        animationDuration: `${STAGE_MS}ms`,
                        animationPlayState: hovering ? "paused" : "running",
                      }}
                    />
                  )}
                  {i < stage % featured.length && <span className="block h-full w-full rounded-full bg-primary/50" />}
                </button>
              ))}
            </div>
          )}
        </div>
        {slides.slice(1, 3).map((s, i) => (
          <div key={i} className="min-w-0 md:col-span-5 [&>*]:h-full">{s}</div>
        ))}
      </div>
    </section>
  );
}
