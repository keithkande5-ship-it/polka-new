import { vaultPost } from "@/lib/trading-rules";
import { Tutorial } from "@/components/polka/Tutorial";
import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronDown, Info, Loader2, Lock, Radio, TrendingDown, TrendingUp } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  YAxis,
  XAxis,
} from "recharts";
import { toast } from "sonner";
import { fireConfetti } from "@/lib/confetti";
import {
  assets,
  fmtPrice,
  upProbability,
  useLivePrice,
  useRound,
  type Asset,
} from "@/lib/crypto";
import { fmtKES, hashId, payout } from "@/lib/markets";
import { useStore } from "@/lib/store";
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { releaseKeyboard } from "@/components/polka/TradePanel";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/use-mobile";
import { Btn3D, Odometer } from "@/components/polka/ui";
import {
  FLASH_LOCK_WINDOW_SECONDS,
  canTradeFlash,
  flashLockout,
  flashProbability,
  parimutuelMultiplier,
  useRake,
} from "@/lib/trading-rules";
import { CoinIcon } from "@/components/polka/CoinIcon";
import { cn } from "@/lib/utils";
import { FLASH_RESULT_DISPLAY_MS } from "@/lib/market-presentation";
import { FlashResolution, type FlashResolutionData } from "@/components/polka/FlashResolution";

export const Route = createFileRoute("/flash")({
  validateSearch: (search: Record<string, unknown>) => {
    const a = search["asset"];
    return typeof a === "string" && a.length > 0 ? { asset: a } : {};
  },
  head: () => ({
    meta: [
      { title: "60s Flash — Up or Down crypto rounds | Polka" },
      {
        name: "description",
        content:
          "Call BTC, ETH, SOL and more Up or Down in 60-second rounds with live Binance prices.",
      },
      { property: "og:title", content: "60s Flash — Up or Down | Polka" },
      {
        property: "og:description",
        content: "60-second Up/Down rounds on live Binance prices. Pay in with M-Pesa.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Flash,
});

type ChartMode = "line" | "candle" | "chance";

/** Traditional 5-second OHLC candles spanning the previous and current round. */
function Candles({
  series,
  lock,
  decimals,
  now,
  roundStart,
  entries,
}: {
  series: { t: number; p: number }[];
  lock: number | null;
  decimals: number;
  now: number;
  roundStart: number;
  entries: { id: string; p: number; up: boolean }[];
}) {
  const N = 24; // 12 candles of the previous round + 12 of the live round
  const first = Math.floor((roundStart - 60_000) / 5000);
  const buckets = new Map<number, { o: number; h: number; l: number; c: number }>();
  let prevClose: number | null = null;
  for (const { t, p } of series) {
    const k = Math.floor(t / 5000);
    if (k < first) {
      prevClose = p;
      continue;
    }
    const b = buckets.get(k);
    if (!b) buckets.set(k, { o: prevClose ?? p, h: Math.max(p, prevClose ?? p), l: Math.min(p, prevClose ?? p), c: p });
    else {
      b.h = Math.max(b.h, p);
      b.l = Math.min(b.l, p);
      b.c = p;
    }
    prevClose = p;
  }
  const liveK = Math.floor(now / 5000);
  const vals = [...buckets.values()];
  const all = vals.flatMap((v) => [v.h, v.l]).concat(lock ? [lock] : [], entries.map((e) => e.p));
  if (!all.length) return <div className="h-full w-full animate-pulse rounded-lg bg-muted/70" />;
  const rawLo = Math.min(...all), rawHi = Math.max(...all);
  const padV = (rawHi - rawLo) * 0.12 || rawHi * 0.0002 || 1;
  const lo = rawLo - padV, hi = rawHi + padV;
  const span = hi - lo;
  const W = 600, H = 280, top = 10, bottom = 22, axisW = 72, plotW = W - axisW;
  const plotH = H - top - bottom;
  const y = (v: number) => top + (1 - (v - lo) / span) * plotH;
  const cw = plotW / N;
  const bodyW = Math.max(3, cw * 0.62);
  const xOf = (k: number) => (k - first) * cw + cw / 2;
  const openX = ((roundStart - (roundStart - 60_000)) / 120_000) * plotW;
  const last = buckets.get(liveK) ?? vals.at(-1);
  const lastColor = last && last.c >= last.o ? "var(--up)" : "var(--down)";
  const label = (v: number) => fmtPrice(v, decimals);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" preserveAspectRatio="none">
      {/* horizontal grid + price scale */}
      {[0, 0.2, 0.4, 0.6, 0.8, 1].map((f) => {
        const yy = top + f * plotH;
        return (
          <g key={f}>
            <line x1={0} x2={plotW} y1={yy} y2={yy} stroke="var(--border)" strokeWidth={0.6} />
            <text x={W - 4} y={yy + 3} textAnchor="end" fontSize={10} fill="var(--muted-foreground)" style={{ fontVariantNumeric: "tabular-nums" }}>
              {label(hi - f * span)}
            </text>
          </g>
        );
      })}
      {/* vertical grid every 15s + time labels */}
      {Array.from({ length: 9 }, (_, i) => {
        const t = roundStart - 60_000 + i * 15_000;
        const xx = (i / 8) * plotW;
        return (
          <g key={i}>
            <line x1={xx} x2={xx} y1={top} y2={top + plotH} stroke="var(--border)" strokeWidth={0.4} opacity={0.6} />
            {i % 2 === 0 && (
              <text x={Math.min(plotW - 20, Math.max(20, xx))} y={H - 6} textAnchor="middle" fontSize={9} fill="var(--muted-foreground)">
                {new Date(t).toLocaleTimeString("en-KE", { hour12: false })}
              </text>
            )}
          </g>
        );
      })}
      {/* previous round shading + round open marker */}
      <rect x={0} y={top} width={openX} height={plotH} fill="var(--muted)" opacity={0.18} />
      <line x1={openX} x2={openX} y1={top} y2={top + plotH} stroke="var(--primary)" strokeWidth={1} strokeDasharray="3 3" />
      <text x={openX + 4} y={top + 10} fontSize={9} fill="var(--primary)" fontWeight={600}>ROUND OPEN</text>
      {lock && (
        <line x1={0} x2={plotW} y1={y(lock)} y2={y(lock)} stroke="var(--primary)" strokeWidth={1.25} strokeDasharray="6 4" />
      )}
      {entries.map((e) => (
        <g key={e.id}>
          <line x1={openX} x2={plotW} y1={y(e.p)} y2={y(e.p)} stroke={e.up ? "var(--up)" : "var(--down)"} strokeWidth={1.25} />
          <text x={openX + 4} y={y(e.p) - 3} fontSize={9} fill={e.up ? "var(--up)" : "var(--down)"}>
            My {e.up ? "UP" : "DOWN"} entry
          </text>
        </g>
      ))}
      {[...buckets.entries()].map(([k, v]) => {
        if (k - first >= N) return null;
        const up = v.c >= v.o;
        const color = up ? "var(--up)" : "var(--down)";
        const x = xOf(k);
        const bodyTop = y(Math.max(v.o, v.c));
        const bodyH = Math.max(1, Math.abs(y(v.o) - y(v.c)));
        const forming = k === liveK;
        return (
          <g key={k} opacity={forming ? 1 : 0.95}>
            <line x1={x} x2={x} y1={y(v.h)} y2={y(v.l)} stroke={color} strokeWidth={1} shapeRendering="crispEdges" />
            <rect
              x={x - bodyW / 2}
              width={bodyW}
              y={bodyTop}
              height={bodyH}
              fill={up ? "var(--up)" : "var(--down)"}
              stroke={color}
              strokeWidth={0.8}
              shapeRendering="crispEdges"
            />
          </g>
        );
      })}
      {last && (
        <>
          <line x1={0} x2={plotW} y1={y(last.c)} y2={y(last.c)} stroke={lastColor} strokeWidth={0.8} strokeDasharray="2 3" />
          <rect x={plotW + 2} y={y(last.c) - 8} width={axisW - 4} height={16} rx={3} fill={lastColor} />
          <text x={W - 6} y={y(last.c) + 3.5} textAnchor="end" fontSize={10} fontWeight={700} fill="var(--background)" style={{ fontVariantNumeric: "tabular-nums" }}>
            {label(last.c)}
          </text>
        </>
      )}
    </svg>
  );
}

/** Live win/lose tug-of-war for each open order this round. */
function RoundPoll({
  status,
  price,
  entries,
  decimals,
  remaining,
}: {
  status: { id: string; side: string; winning: boolean; tie: boolean; move: number; payout: number }[];
  price: number | null;
  entries: { id: string; p: number; up: boolean }[];
  decimals: number;
  remaining: number;
}) {
  if (!status.length || !price) return null;
  return (
    <div className="mt-3 space-y-2">
      {status.map((s) => {
        const e = entries.find((x) => x.id === s.id);
        const entry = e?.p ?? price;
        // ±0.05% from entry maps to the full meter width.
        const rel = Math.max(-1, Math.min(1, (s.move / (entry * 0.0005)) * (s.side === "UP" ? 1 : -1)));
        const pos = 50 + rel * 50;
        return (
          <div
            key={s.id}
            className={cn(
              "rounded-lg border p-3",
              s.winning ? "border-up/40 bg-up/5" : s.tie ? "border-border" : "border-down/40 bg-down/5",
            )}
          >
            <div className="num flex items-center justify-between text-xs font-semibold">
              <span className={s.winning ? "text-up" : s.tie ? "text-muted-foreground" : "text-down"}>
                {s.side} · {s.winning ? "WINNING" : s.tie ? "EVEN" : "LOSING"}
              </span>
              <span className="text-muted-foreground">{remaining}s left</span>
            </div>
            <div className="relative mt-2 h-3 overflow-hidden rounded-full bg-muted">
              <div className="absolute inset-y-0 left-0 bg-down/50" style={{ width: "50%" }} />
              <div className="absolute inset-y-0 right-0 bg-up/50" style={{ width: "50%" }} />
              <div className="absolute inset-y-0 left-1/2 w-px bg-foreground/60" />
              <div
                className={cn(
                  "absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background shadow transition-[left] duration-300",
                  s.winning ? "bg-up" : s.tie ? "bg-muted-foreground" : "bg-down",
                )}
                style={{ left: `${pos}%` }}
              />
            </div>
            <div className="num mt-1.5 flex justify-between text-[10px] text-muted-foreground">
              <span>LOSE</span>
              <span>Entry {fmtPrice(entry, decimals)}</span>
              <span>WIN</span>
            </div>
            <p className="num mt-1 text-[11px]">
              {s.winning
                ? `Paying ${fmtKES(s.payout, 2)} if it holds`
                : `Needs price ${s.side === "UP" ? "above" : "below"} ${fmtPrice(entry, decimals)}`}
            </p>
          </div>
        );
      })}
    </div>
  );
}

type Result = { round: number; dir: "up" | "down"; lock: number; settle: number; at: number };

/** Deterministic preview pool per round (volume + trader count). */
function roundMeta(round: number) {
  const h = hashId(`flash-round-${round}`);
  return { volume: 40_000 + (h % 60_000), traders: 120 + (h % 400) };
}

function AssetList({ current, onPick }: { current: Asset; onPick: (a: Asset) => void }) {
  return (
    <div className="divide-y">
      {[
        ["Crypto · Binance", assets.filter((a) => !a.local)],
        ["Local pairs", assets.filter((a) => a.local)],
      ].map(([label, list]) => (
        <div key={label as string} className="py-1">
          <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label as string}
          </p>
          {(list as Asset[]).map((a) => (
            <button
              key={a.sym}
              onClick={() => onPick(a)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-secondary",
                a.sym === current.sym && "bg-primary/10",
              )}
            >
              <CoinIcon symbol={a.sym} />
              <span className="flex-1">
                <span className="block text-sm font-semibold">{a.sym} 60s Up or Down</span>
                <span className="text-xs text-muted-foreground">{a.name}</span>
              </span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

function Flash() {
  const mobile = useIsMobile();
  const { asset: assetParam } = Route.useSearch();
  const navigate = useNavigate({ from: "/flash" });
  const [asset, setAsset] = useState<Asset>(
    () =>
      assets.find((a) => a.sym.toLowerCase() === assetParam?.toLowerCase()) ??
      assets[0] ?? { sym: "BTC", name: "Bitcoin", seed: 108000, decimals: 2 },
  );
  const [picker, setPicker] = useState(false);
  const { price, live, series, status, ready, retry } = useLivePrice(asset);
  const { round, remaining } = useRound();
  const {
    balance,
    openCashier,
    addPosition,
    positions,
    settlePosition,
    voidPosition,
    user,
    openAuth,
  } = useStore();
  const lock = useRef<{ r: number; p: number } | null>(null);
  const lastPrice = useRef<number | null>(null);
  const statusRef = useRef(status);
  statusRef.current = status;
  const [history, setHistory] = useState<Result[]>([]);
  const [resolution, setResolution] = useState<FlashResolutionData | null>(null);
  useEffect(() => {
    if (!resolution) return;
    const timer = window.setTimeout(() => setResolution(null), FLASH_RESULT_DISPLAY_MS);
    return () => window.clearTimeout(timer);
  }, [resolution]);
  const [lockP, setLockP] = useState<number | null>(null);
  const [stake, setStake] = useState(100);
  const [chartMode, setChartMode] = useState<ChartMode>("line");
  lastPrice.current = price;

  useEffect(() => {
    lock.current = null;
    setHistory([]);
    setResolution(null);
    setLockP(null);
  }, [asset]);

  // Deep links (?asset=eth) drive the active pair — browser back/forward included.
  useEffect(() => {
    if (!assetParam) return;
    const next = assets.find((a) => a.sym.toLowerCase() === assetParam.toLowerCase());
    if (next && next.sym !== asset.sym) setAsset(next);
  }, [assetParam, asset.sym]);

  useEffect(() => {
    if (round === null || !price) return;
    if (lock.current?.r === round) return;
    const prev = lock.current;
    if (prev) {
      const open = positions.filter(
        (p) =>
          p.marketId === "flash" &&
          p.round === prev.r &&
          p.asset === asset.sym &&
          p.status === "open",
      );
      // Never settle on synthetic or hallucinated numbers: if the feed was not
      // live through the round, void and refund instead of resolving.
      const healthy = asset.local || statusRef.current === "live";
      if (open.length > 0 && !healthy) {
        open.forEach((p) => voidPosition(p.id));
      } else {
        const settle = lastPrice.current ?? prev.p;
        const dir: Result["dir"] = settle >= prev.p ? "up" : "down";
        setHistory((h) =>
          [{ round: prev.r, dir, lock: prev.p, settle, at: Date.now() }, ...h].slice(0, 14),
        );
        let net = 0;
        open.forEach((p) => {
          const won = p.outcome.toLowerCase() === dir;
          net += won ? p.stake * p.mult - p.stake : -p.stake;
          settlePosition(p.id, won);
        });
        if (open.length) vaultPost("flash", Math.round(-net * 100) / 100, `Flash round #${prev.r} house P&L`);
        if (healthy) setResolution({
          round: prev.r, dir, lock: prev.p, settle,
          stake: open.reduce((total, p) => total + p.stake, 0),
          returned: open.reduce((total, p) => total + (p.outcome.toLowerCase() === dir ? payout(p.stake, p.mult) : 0), 0),
          orders: open.length,
        });
        if (open.length > 0) {
          if (net > 0) {
            fireConfetti();
            toast.success(`You made a profit: +${fmtKES(net, 2)}`, {
              description: `Round #${prev.r} settled ${dir.toUpperCase()}`,
              duration: 4000,
            });
          } else {
            toast(`Loss: -${fmtKES(Math.abs(net), 2)}`, {
              description: `Round #${prev.r} settled ${dir.toUpperCase()}`,
              duration: 4000,
            });
          }
        }
      }
    }
    lock.current = { r: round, p: price };
    setLockP(price);
  }, [round, price, positions, settlePosition, voidPosition, asset.local, asset.sym]);

  // A live stake plus a dead feed is an immediate void — 100% refund, no
  // synthetic resolution in between.
  useEffect(() => {
    if (status !== "offline") return;
    positions
      .filter((p) => p.marketId === "flash" && p.status === "open")
      .forEach((p) => voidPosition(p.id));
  }, [status, positions, voidPosition]);

  // The seeded preview series is centered on a static seed price; when the live
  // feed connects it reseeds to the real price, leaving the round lock stale.
  // Re-lock the current round once the live price diverges >2% from the lock.
  useEffect(() => {
    if (!live || !price || round === null || lock.current?.r !== round) return;
    if (Math.abs(price - lock.current.p) / lock.current.p > 0.02) {
      lock.current = { r: round, p: price };
      setLockP(price);
    }
  }, [live, price, round]);

  const locked = remaining <= FLASH_LOCK_WINDOW_SECONDS;
  const pUp = flashProbability(price, lockP, remaining);
  const lockUp = flashLockout(pUp);
  const lockDown = flashLockout(1 - pUp);
  const rakePct = useRake();
  const meta = roundMeta(round ?? 0);
  const bias = upProbability(price, lockP);
  const upStake = meta.volume * bias;
  const raw = useMemo(
    () => ({
      up: parimutuelMultiplier(pUp, upStake, meta.volume, rakePct),
      down: parimutuelMultiplier(1 - pUp, meta.volume - upStake, meta.volume, rakePct),
    }),
    [pUp, upStake, meta.volume, rakePct],
  );
  // Freeze quoted multipliers when the anti-sniping lock window opens.
  const [frozenMult, setFrozenMult] = useState<{ r: number; up: number; down: number } | null>(
    null,
  );
  useEffect(() => {
    if (round === null) return;
    if (remaining > FLASH_LOCK_WINDOW_SECONDS) {
      if (frozenMult && frozenMult.r !== round) setFrozenMult(null);
      return;
    }
    setFrozenMult((f) => (f?.r === round ? f : { r: round, up: raw.up, down: raw.down }));
  }, [remaining, round, raw.up, raw.down, frozenMult]);
  const estMult = locked && frozenMult?.r === round ? frozenMult : raw;
  const multUp = estMult.up;
  const multDown = estMult.down;
  const evenMult = parimutuelMultiplier(0.5, 1, 2, rakePct);
  const diff = price && lockP ? price - lockP : 0;
  const myOrders = positions.filter(
    (p) => p.marketId === "flash" && p.round === round && p.status === "open",
  );
  const tradeAllowed = canTradeFlash(remaining, myOrders.length > 0) && !locked;

  const pick = (a: Asset) => {
    if (myOrders.some((p) => p.status === "open")) {
      toast("Wait for your active round to settle before switching assets.");
      return;
    }
    setAsset(a);
    setPicker(false);
    navigate({
      search: (prev) => ({ ...prev, asset: a.sym.toLowerCase() }),
      replace: true,
    });
  };

  const place = (side: "up" | "down") => {
    if (!user) return openAuth();
    if (!navigator.onLine) {
      toast.error("No internet connection · Trading paused");
      return;
    }
    if (side === "up" ? lockUp : lockDown) {
      toast.error("Max Liability Reached · Market Locked");
      return;
    }
    if (round === null || !tradeAllowed || !lockP || !live || !ready) return;
    if (stake > balance) return openCashier("deposit", stake - balance);
    const mult = side === "up" ? multUp : multDown;
    if (
      !addPosition({
        marketId: "flash",
        title: `${asset.sym} 60s ${side.toUpperCase()} · Round #${round % 10000}`,
        outcome: side.toUpperCase(),
        stake,
        mult,
        round,
        asset: asset.sym,
        lock: lockP,
        entry: price ?? lockP,
      })
    )
      return;
    toast(`${side.toUpperCase()} · ${fmtKES(stake)} @ ${mult.toFixed(2)}x`, {
      description: `Projected payout ${fmtKES(payout(stake, mult), 2)}`,
    });
  };

  const now = Date.now();
  // Window = previous round (left half) + live round filling left → right.
  const roundStart = (round ?? Math.floor(now / 60000)) * 60000;
  const winStart = roundStart - 60000;
  const winEnd = roundStart + 60000;
  const visible = series.filter((t) => t.t >= winStart);
  const chartData = visible;
  const prices = visible.map((t) => t.p);
  const chanceData = visible.map((t) => ({ t: t.t, c: Math.round(flashProbability(t.p, lockP) * 1000) / 10 }));
  const entries = myOrders.map((o) => ({ id: o.id, p: o.entry ?? o.lock ?? lockP ?? 0, up: o.outcome === "UP" }));
  const myStatus = myOrders.map((o) => {
    const entry = o.entry ?? o.lock ?? lockP ?? 0;
    const move = (price ?? entry) - entry;
    const winning = o.outcome === "UP" ? move > 0 : move < 0;
    return { id: o.id, side: o.outcome, winning, tie: move === 0, move, payout: payout(o.stake, o.mult) };
  });
  const lo = Math.min(...prices, lockP ?? asset.seed, ...entries.map((e) => e.p));
  const hi = Math.max(...prices, lockP ?? asset.seed, ...entries.map((e) => e.p));
  const pad = (hi - lo) * 0.3 + asset.seed * 0.0001;
  const settled = positions.filter(
    (p) => p.marketId === "flash" && (p.status === "won" || p.status === "lost"),
  );
  const pnl = settled.reduce(
    (a, p) => a + (p.status === "won" ? p.stake * p.mult - p.stake : -p.stake),
    0,
  );
  const buyDisabled = !!user && (!tradeAllowed || !lockP || !live || !ready);

  const trigger = (
    <button className="flex items-center gap-1.5 rounded-lg px-1 text-lg font-bold">
      {asset.sym.toLowerCase()} 60s up or down <ChevronDown className="h-5 w-5 text-primary" />
    </button>
  );

  const streak = history.slice(0, 5);

  return (
    <div className="mx-auto max-w-7xl px-3 pb-44 pt-4 md:px-6 md:pb-6 md:pt-6">
      <h1 className="sr-only">60-second Up or Down crypto rounds</h1>
      <Tutorial variant="flash" />
      <div className="no-scrollbar mb-4 hidden gap-2 overflow-x-auto md:flex">
        {assets.map((a) => (
          <button
            key={a.sym}
            onClick={() => pick(a)}
            className={cn(
              "num shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold",
              a.sym === asset.sym
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground",
            )}
          >
            <CoinIcon symbol={a.sym} /> {a.sym}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        {mobile ? (
          <>
            <div onClick={() => setPicker(true)}>{trigger}</div>
            <Drawer open={picker} onOpenChange={setPicker}>
              <DrawerContent className="px-2 pb-6">
                <DrawerTitle className="px-3 pt-3">Select market</DrawerTitle>
                <DrawerDescription className="sr-only">
                  Choose an asset for 60 second rounds
                </DrawerDescription>
                <AssetList current={asset} onPick={pick} />
              </DrawerContent>
            </Drawer>
          </>
        ) : (
          <Popover open={picker} onOpenChange={setPicker}>
            <PopoverTrigger asChild>{trigger}</PopoverTrigger>
            <PopoverContent align="start" className="w-80 p-1">
              <AssetList current={asset} onPick={pick} />
            </PopoverContent>
          </Popover>
        )}
        <span
          className={cn(
            "flex shrink-0 items-center gap-1 whitespace-nowrap text-xs",
            live ? "text-up" : "text-muted-foreground",
          )}
        >
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              asset.local
                ? "bg-muted-foreground"
                : status === "live"
                  ? "animate-pulse bg-up"
                  : status === "stale"
                    ? "bg-chart-4"
                    : "bg-down",
            )}
          />
          {!asset.local && status === "stale" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Radio className="h-3.5 w-3.5" />}{" "}
          {asset.local
            ? "Simulated feed"
            : status === "live"
              ? "Binance live"
              : status === "stale"
                ? "Reconnecting"
                : "Offline"}
          {!asset.local && status === "offline" && (
            <button
              onClick={retry}
              className="ml-1 rounded border px-1.5 py-0.5 font-semibold text-foreground"
            >
              Retry
            </button>
          )}
        </span>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-w-0 p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">
                {asset.sym}/{asset.local ? "KES" : "USDT"}
              </p>
              {ready ? (
                <>
                  <Odometer
                    value={price ?? asset.seed}
                    format={(v) => fmtPrice(v, asset.decimals)}
                    className={cn("num text-4xl font-bold", diff >= 0 ? "text-up" : "text-down")}
                  />
                  <p className={cn("num text-sm", diff >= 0 ? "text-up" : "text-down")}>
                    {diff >= 0 ? "▲" : "▼"} {fmtPrice(Math.abs(diff), asset.decimals)} vs lock
                  </p>
                </>
              ) : (
                <div className="mt-1 space-y-1.5">
                  <div className="h-9 w-44 animate-pulse rounded bg-muted" />
                  <div className="h-4 w-28 animate-pulse rounded bg-muted" />
                </div>
              )}
            </div>
            <div className="text-right">
              <p className="num text-xs text-muted-foreground">
                Round #{round !== null ? round % 10000 : "—"}
              </p>
              <p
                className={cn(
                  "num text-4xl font-bold",
                  locked ? "text-down" : "text-primary",
                )}
              >
                00:{String(remaining).padStart(2, "0")}
              </p>
              <p className="text-xs text-muted-foreground">remaining</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
            <Lock className="h-4 w-4 text-primary" />
            <span className="text-muted-foreground">Price to beat</span>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  aria-label="How settlement works"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Info className="h-3.5 w-3.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-64 text-xs">
                Each round locks this price at 00:00. At the next 00:00 the last observed price is
                compared: at or above settles Up, below settles Down.
              </PopoverContent>
            </Popover>
            <span className="num ml-auto font-bold">
              {ready ? fmtPrice(lockP, asset.decimals) : "—"}
            </span>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {chartMode === "line" ? "Live price" : chartMode === "candle" ? "5s candles" : "Up % chance"}
            </span>
            <select
              aria-label="Chart type"
              value={chartMode}
              onChange={(e) => setChartMode(e.target.value as ChartMode)}
              className="num rounded-md border bg-secondary px-2 py-1 text-xs font-semibold text-foreground"
            >
              <option value="line">Price</option>
              <option value="candle">Candlestick · 5s</option>
              <option value="chance">% Chance</option>
            </select>
          </div>
          <div className="relative mt-2 h-[280px] min-h-[240px] min-w-0">
            {resolution && <FlashResolution result={resolution} decimals={asset.decimals} />}
            {ready && chartMode === "candle" ? (
              <Candles series={series} lock={lockP} decimals={asset.decimals} now={now} roundStart={roundStart} entries={entries} />
            ) : ready && chartMode === "chance" ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chanceData} margin={{ top: 16, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="t" type="number" domain={[winStart, winEnd]} allowDataOverflow hide />
                  <ReferenceLine x={roundStart} stroke="var(--primary)" strokeDasharray="3 3" />
                  <YAxis
                    orientation="right"
                    domain={[0, 100]}
                    ticks={[0, 25, 50, 75, 100]}
                    tickFormatter={(v) => `${v}%`}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 10, fontFamily: "var(--font-mono)" }}
                    axisLine={false}
                    tickLine={false}
                    width={40}
                  />
                  <ReferenceLine y={50} stroke="var(--primary)" strokeDasharray="6 4" />
                  <Line
                    type="stepAfter"
                    dataKey="c"
                    stroke={pUp >= 0.5 ? "var(--up)" : "var(--down)"}
                    strokeWidth={2}
                    isAnimationActive={false}
                    dot={({ cx, cy, index }: { cx?: number; cy?: number; index?: number }) =>
                      index === chanceData.length - 1 ? (
                        <g>
                          <circle cx={cx} cy={cy} r={4} fill={pUp >= 0.5 ? "var(--up)" : "var(--down)"} />
                          <circle className="radar-dot" cx={cx} cy={cy} r={7} fill="none" stroke={pUp >= 0.5 ? "var(--up)" : "var(--down)"} />
                        </g>
                      ) : (
                        <g />
                      )
                    }
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : ready ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 20, right: mobile ? 0 : 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
                  <XAxis
                    dataKey="t"
                    type="number"
                    domain={[winStart, winEnd]}
                    allowDataOverflow
                    tickFormatter={(t) =>
                      new Date(t).toLocaleTimeString("en-KE", { hour12: false })
                    }
                    tick={{
                      fill: "var(--muted-foreground)",
                      fontSize: 10,
                      fontFamily: "var(--font-mono)",
                    }}
                    axisLine={false}
                    tickLine={false}
                    minTickGap={64}
                    height={22}
                  />
                  <YAxis
                    orientation="right"
                    domain={[lo - pad, hi + pad]}
                    tickFormatter={(v) => fmtPrice(Number(v), asset.decimals)}
                    tick={{
                      fill: "var(--muted-foreground)",
                      fontSize: 10,
                      fontFamily: "var(--font-mono)",
                    }}
                    axisLine={false}
                    tickLine={false}
                    width={mobile ? 78 : 72}
                  />
                  {myOrders.map((o) => (
                    <ReferenceLine
                      key={o.id}
                      y={o.entry ?? o.lock ?? lockP ?? 0}
                      stroke={o.outcome === "UP" ? "var(--up)" : "var(--down)"}
                      strokeWidth={1.5}
                      label={{
                        value: `My ${o.outcome} entry ${fmtPrice(o.entry ?? o.lock ?? 0, asset.decimals)}`,
                        position: "insideBottomLeft",
                        fill: o.outcome === "UP" ? "var(--up)" : "var(--down)",
                        fontSize: 10,
                      }}
                    />
                  ))}
                  <ReferenceLine x={roundStart} stroke="var(--primary)" strokeOpacity={0.6} strokeDasharray="3 3" />
                  {lockP && (
                    <ReferenceLine
                      y={lockP}
                      stroke="var(--primary)"
                      strokeWidth={2}
                      strokeDasharray="6 4"
                      label={{
                        value: `Lock ${fmtPrice(lockP, asset.decimals)}`,
                        position: "insideTopLeft",
                        fill: "var(--primary)",
                        fontSize: 10,
                        fontFamily: "var(--font-mono)",
                      }}
                    />
                  )}
                  <Line
                    type="monotone"
                    dataKey="p"
                    stroke={diff >= 0 ? "var(--up)" : "var(--down)"}
                    strokeWidth={2}
                    dot={({ cx, cy, index }: { cx?: number; cy?: number; index?: number }) =>
                      index === chartData.length - 1 ? (
                        <g>
                          <circle cx={cx} cy={cy} r={4} fill={diff >= 0 ? "var(--up)" : "var(--down)"} />
                          <circle
                            className="radar-dot"
                            cx={cx}
                            cy={cy}
                            r={7}
                            fill="none"
                            stroke={diff >= 0 ? "var(--up)" : "var(--down)"}
                          />
                        </g>
                      ) : (
                        <g />
                      )
                    }
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full animate-pulse rounded-lg bg-muted/70" />
            )}
          </div>
          <div className="mt-3">
            <p className="mb-1.5 text-xs text-muted-foreground">Past rounds</p>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {history.length === 0 && (
                <span className="text-xs text-muted-foreground">First round in progress…</span>
              )}
              {history.slice(0, 12).map((h) => {
                const delta = h.settle - h.lock;
                return (
                  <div
                    key={h.round}
                    title={`${fmtPrice(h.lock, asset.decimals)} → ${fmtPrice(h.settle, asset.decimals)}`}
                    className="num flex shrink-0 flex-col items-center rounded-md bg-muted/50 px-2 py-1 text-[10px]"
                  >
                    <span
                      className={cn(
                        "rounded px-1.5 font-bold",
                        h.dir === "up" ? "bg-up/15 text-up" : "bg-down/15 text-down",
                      )}
                    >
                      {h.dir === "up" ? "▲" : "▼"}
                    </span>
                    <span className={delta >= 0 ? "text-up" : "text-down"}>
                      {delta >= 0 ? "+" : "−"}
                      {fmtPrice(Math.abs(delta), asset.decimals)}
                    </span>
                    <span className="text-muted-foreground">#{h.round % 10000}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <RoundPoll status={myStatus} price={price} entries={entries} decimals={asset.decimals} remaining={remaining} />
        </section>

        <section className="hidden space-y-3 rounded-xl border bg-card p-4 md:block">
          <div>
            <p className="text-xs text-muted-foreground">Amount (KES)</p>
            <input
              aria-label="Stake amount"
              inputMode="numeric"
              value={stake ? stake.toLocaleString("en-KE") : ""}
              placeholder="0"
              onChange={(e) =>
                setStake(Math.min(1_000_000, Number(e.target.value.replace(/\D/g, "")) || 0))
              }
              className="num mt-1 w-full bg-transparent text-3xl font-bold outline-none placeholder:text-muted-foreground/50"
            />
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {[50, 100, 500, 1000].map((c) => (
              <Btn3D
                key={c}
                onClick={() => setStake((s) => s + c)}
                className="num h-8 px-0 text-xs"
              >
                +{c}
              </Btn3D>
            ))}
            <Btn3D onClick={() => setStake(10)} className="h-8 px-0 text-xs">
              Reset
            </Btn3D>
          </div>
          <p className="num text-center text-[11px] text-muted-foreground">
            {locked
              ? `Final multipliers locked · resolving in ${remaining}s`
              : "Est. multipliers — freeze at 15s"}
          </p>
          <div className="grid grid-cols-2 gap-2 pt-1">
            {(["up", "down"] as const).map((s) => {
              const mult = s === "up" ? multUp : multDown;
              const lockedOut = s === "up" ? lockUp : lockDown;
              return (
                <Btn3D
                  key={s}
                  variant={s}
                  disabled={buyDisabled || lockedOut}
                  onClick={() => place(s)}
                  className="h-auto min-h-[92px] flex-col gap-1 px-2 py-3"
                >
                  <span className="text-sm font-bold">{s === "up" ? "▲ Up" : "▼ Down"}</span>
                  {chartMode === "chance" ? (
                    <span className="num text-xl font-bold leading-none">
                      {Math.round((s === "up" ? pUp : 1 - pUp) * 100)}%
                    </span>
                  ) : (
                    <Odometer
                      value={mult}
                      format={(v) => `${v.toFixed(2)}x`}
                      className="num text-xl font-bold leading-none"
                    />
                  )}
                  <span className="num whitespace-nowrap text-[11px] opacity-80">
                    {lockedOut ? "Locked" : chartMode === "chance" ? `${mult.toFixed(2)}x · ` : ""}{fmtKES(payout(stake, mult))}
                  </span>
                </Btn3D>
              );
            })}
          </div>
          {(lockUp || lockDown) && (
            <p className="rounded-md bg-down/15 px-2 py-1 text-center text-[11px] font-semibold text-down">
              Max Liability Reached · Market Locked
            </p>
          )}
          {locked && !lockUp && !lockDown && myOrders.length === 0 && (
            <p className="text-center text-xs text-down">
              Round Locked · Resolving in {remaining}s
            </p>
          )}
          {lockP && price && myOrders.map((b) => {
            const up = b.outcome.toUpperCase() === "UP";
            const winning = up ? price >= lockP : price < lockP;
            const need = Math.abs(up ? lockP - price : price - lockP);
            return (
              <div
                key={b.id}
                className={cn(
                  "num flex items-center gap-2 rounded-md border px-2 py-1.5 text-[11px]",
                  winning ? "border-up/40 bg-up/10 text-up" : "border-down/40 bg-down/10 text-down",
                )}
              >
                <span className="font-bold">{b.outcome} {fmtKES(b.stake)}</span>
                <span className="font-bold">{winning ? "WINNING" : "LOSING"}</span>
                <span className="ml-auto truncate">
                  {winning ? `→ ${fmtKES(payout(b.stake, b.mult), 2)}` : `needs ${fmtPrice(need, asset.decimals)}`} · {remaining}s
                </span>
              </div>
            );
          })}
          <div className="space-y-1.5 rounded-lg border p-3 text-xs">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Round intel
            </p>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Next round</span>
              <span className="num">
                #{round !== null ? (round + 1) % 10000 : "—"} · {asset.sym}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pool bias</span>
              <span className="num">
                {Math.round(bias * 100)}% Up / {100 - Math.round(bias * 100)}% Down
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Round volume</span>
              <Odometer value={meta.volume} format={(v) => fmtKES(v)} className="num" />
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Traders</span>
              <span className="num">{meta.traders}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Last 5 rounds</span>
              <span className="flex gap-1">
                {streak.length === 0 && <span className="text-muted-foreground">—</span>}
                {streak.map((h) => (
                  <span
                    key={h.round}
                    className={cn(
                      "grid h-5 w-5 place-items-center rounded text-[10px] font-bold",
                      h.dir === "up" ? "bg-up/15 text-up" : "bg-down/15 text-down",
                    )}
                  >
                    {h.dir === "up" ? "▲" : "▼"}
                  </span>
                ))}
              </span>
            </div>
          </div>
          <p className="text-center text-[11px] text-muted-foreground">
            Round settles on the last price at 00:00 vs the locked price. Stakes are voided and
            refunded in full if the feed drops mid-round.
          </p>
        </section>
      </div>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border bg-card p-4">
          <h3 className="text-sm font-semibold">Past rounds · your PnL</h3>
          <p
            className={cn(
              "num mt-1 text-xl font-bold",
              pnl > 0 ? "text-up" : pnl < 0 ? "text-down" : "text-foreground",
            )}
          >
            {pnl >= 0 ? "+" : "−"}
            {fmtKES(Math.abs(pnl), 2)}
          </p>
          <div className="mt-2 divide-y text-sm">
            {settled.length === 0 && (
              <p className="py-2 text-xs text-muted-foreground">No settled Flash positions yet.</p>
            )}
            {settled.slice(0, 6).map((p) => (
              <div key={p.id} className="flex items-center justify-between py-2">
                <span className="min-w-0 truncate text-xs">{p.title}</span>
                <span
                  className={cn(
                    "num shrink-0 text-xs font-bold",
                    p.status === "won" ? "text-up" : "text-down",
                  )}
                >
                  {p.status === "won"
                    ? `+${fmtKES(p.stake * p.mult - p.stake, 2)}`
                    : `−${fmtKES(p.stake, 2)}`}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <h3 className="text-sm font-semibold">Live activity</h3>
          <div className="mt-2 divide-y text-sm">
            {history.length === 0 && (
              <p className="py-2 text-xs text-muted-foreground">Activity appears as rounds settle.</p>
            )}
            {history.slice(0, 6).map((h) => (
              <div key={h.round} className="num flex items-center justify-between py-2 text-xs">
                <span className="text-muted-foreground">
                  #{h.round % 10000} · {fmtPrice(h.lock, asset.decimals)} →{" "}
                  {fmtPrice(h.settle, asset.decimals)}
                </span>
                <span className={cn("font-bold", h.dir === "up" ? "text-up" : "text-down")}>
                  {h.dir === "up" ? "▲ UP" : "▼ DOWN"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-4 rounded-xl border bg-card p-4">
        <h3 className="text-sm font-semibold">Flash FAQs</h3>
        <div className="mt-2 divide-y text-sm">
          {[
            [
              "How does a 60s round work?",
              "Each round locks a price at 00:00. If the last price at the next 00:00 is above the lock, UP wins; below it, DOWN wins.",
            ],
            [
              "How is the multiplier set?",
              `Multipliers start at ${evenMult.toFixed(2)}x (${Math.round(rakePct * 100)}% rake) and move with the price and round pool. Obvious favorites are repriced down to pennies and payouts can never exceed the net distributable pool after rake.`,
            ],
            [
              "When does trading lock?",
              `Trading closes ${FLASH_LOCK_WINDOW_SECONDS} seconds before settlement to stop last-millisecond sniping. Multipliers freeze then and settle as final. Sides at maximum liability are locked entirely.`,
            ],
            [
              "What happens if the feed drops?",
              "Open stakes are never resolved on synthetic prices — the round is voided and 100% of your stake is refunded to your wallet.",
            ],
            [
              "How do I get paid?",
              "Wins credit your Polka balance instantly at settlement. Withdraw anytime via M-Pesa B2C in the cashier.",
            ],
          ].map(([q, a]) => (
            <details key={q} className="group py-2.5">
              <summary className="cursor-pointer list-none font-medium marker:hidden group-open:text-primary">
                {q}
              </summary>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {mobile && (
        <div className="fixed inset-x-0 bottom-[calc(57px+env(safe-area-inset-bottom))] z-40 space-y-2 border-t bg-background/95 p-2 backdrop-blur md:hidden">
          {(lockUp || lockDown) && (
            <p className="rounded-md bg-down/15 px-2 py-1 text-center text-[11px] font-semibold text-down">
              Max Liability Reached · Market Locked
            </p>
          )}
          {locked && !lockUp && !lockDown && (
            <p className="num text-center text-xs font-semibold text-down">
              Round Locked · Resolving in {remaining}s
            </p>
          )}
          <div className="grid grid-cols-5 gap-1.5">
            {[50, 100, 500].map((c) => (
              <Btn3D
                key={c}
                onClick={() => setStake((s) => s + c)}
                className="num h-8 px-0 text-xs"
              >
                +{c}
              </Btn3D>
            ))}
            <input
              aria-label="Stake amount"
              inputMode="numeric"
              enterKeyHint="done"
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              onBlur={releaseKeyboard}
              value={stake ? String(stake) : ""}
              placeholder="0"
              onChange={(e) =>
                setStake(Math.min(1_000_000, Number(e.target.value.replace(/\D/g, "")) || 0))
              }
              className="num col-span-2 h-8 rounded-lg bg-muted px-2 text-xs font-bold outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(["up", "down"] as const).map((s) => {
              const mult = s === "up" ? multUp : multDown;
              const lockedOut = s === "up" ? lockUp : lockDown;
              return (
                <Btn3D
                  key={s}
                  variant={s}
                  disabled={buyDisabled || lockedOut}
                  onClick={() => place(s)}
                  className="h-12 flex-col gap-0"
                >
                  <span>{s === "up" ? "▲ UP" : "▼ DOWN"}</span>
                  <Odometer
                    value={mult}
                    format={(v) => `${v.toFixed(2)}x`}
                    className="num text-xs opacity-90"
                  />
                  <span className="num text-[10px] opacity-80">
                    {fmtKES(payout(stake, mult))}
                  </span>
                </Btn3D>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
