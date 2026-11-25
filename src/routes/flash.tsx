import { vaultPost } from "@/lib/trading-rules";
import { Tutorial } from "@/components/polka/Tutorial";
import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ChevronDown,
  Info,
  Loader2,
  Lock,
  Radio,
  Share2,
  Bookmark,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
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
      { title: "Rapid Trading — Up or Down Crypto | Polka" },
      {
        name: "description",
        content: "Call BTC, ETH, and SOL Up or Down in fast rounds with live Binance prices.",
      },
    ],
  }),
  component: Flash,
});

type ChartMode = "line" | "candle" | "chance";
type Timeframe = "60s" | "5m" | "10m" | "15m";
type OddsMode = "mult" | "pct";

/** Traditional OHLC candles spanning the round */
function Candles({
  series,
  lock,
  decimals,
  now,
  roundStart,
  entries,
  spanMs,
}: {
  series: { t: number; p: number }[];
  lock: number | null;
  decimals: number;
  now: number;
  roundStart: number;
  entries: { id: string; p: number; up: boolean }[];
  spanMs: number;
}) {
  const bucketSec = Math.max(5, Math.floor(spanMs / 24000));
  const bucketMs = bucketSec * 1000;
  const N = 24;
  const first = Math.floor((roundStart - spanMs) / bucketMs);
  const buckets = new Map<number, { o: number; h: number; l: number; c: number }>();
  let prevClose: number | null = null;
  for (const { t, p } of series) {
    const k = Math.floor(t / bucketMs);
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
  const liveK = Math.floor(now / bucketMs);
  const vals = [...buckets.values()];
  const all = vals.flatMap((v) => [v.h, v.l]).concat(lock ? [lock] : [], entries.map((e) => e.p));
  if (!all.length) return <div className="h-full w-full animate-pulse rounded-2xl bg-[#161b26]" />;
  const rawLo = Math.min(...all), rawHi = Math.max(...all);
  const padV = (rawHi - rawLo) * 0.15 || rawHi * 0.0002 || 1;
  const lo = rawLo - padV, hi = rawHi + padV;
  const span = hi - lo;
  const W = 820, H = 240, top = 10, bottom = 22, axisW = 76, plotW = W - axisW;
  const plotH = H - top - bottom;
  const y = (v: number) => top + (1 - (v - lo) / span) * plotH;
  const cw = plotW / N;
  const bodyW = Math.max(3.5, cw * 0.65);
  const xOf = (k: number) => (k - first) * cw + cw / 2;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full overflow-visible" preserveAspectRatio="none">
      <defs>
        <pattern id="candleGrid" width="60" height="40" patternUnits="userSpaceOnUse">
          <path d="M 60 0 L 0 0 0 40" fill="none" stroke="#252c3b" strokeWidth="0.8" strokeDasharray="2 4" />
        </pattern>
      </defs>
      <rect width={plotW} height={plotH} y={top} fill="url(#candleGrid)" opacity={0.6} />

      {lock && (
        <g>
          <line x1={0} x2={plotW} y1={y(lock)} y2={y(lock)} stroke="#ffffff" strokeWidth="1.5" strokeDasharray="6 6" strokeOpacity="0.7" />
          <rect x={plotW + 4} y={y(lock) - 11} width="68" height="22" rx="11" fill="#ffffff" />
          <text x={plotW + 38} y={y(lock) + 4} fill="#0d0f17" fontSize="11" fontWeight="700" fontFamily="JetBrains Mono" textAnchor="middle">
            ${fmtPrice(lock, decimals)}
          </text>
        </g>
      )}

      {[...buckets.entries()].map(([k, c]) => {
        const cx = xOf(k);
        const up = c.c >= c.o;
        const color = up ? "#10b981" : "#ef4444";
        const topY = y(Math.max(c.o, c.c));
        const botY = y(Math.min(c.o, c.c));
        const h = Math.max(1.5, botY - topY);
        return (
          <g key={k}>
            <line x1={cx} x2={cx} y1={y(c.h)} y2={y(c.l)} stroke={color} strokeWidth="1.5" />
            <rect x={cx - bodyW / 2} y={topY} width={bodyW} height={h} fill={color} rx="1" />
          </g>
        );
      })}
    </svg>
  );
}

function AssetList({ current, onPick }: { current: Asset; onPick: (a: Asset) => void }) {
  return (
    <div className="divide-y divide-[#252c3b] bg-[#161b26] text-[#eef1f7]">
      {[
        ["Binance Live Pairs", assets.filter((a) => !a.local)],
        ["Local Pairs", assets.filter((a) => a.local)],
      ].map(([label, list]) => (
        <div key={label as string} className="py-2">
          <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-[#8a93a6]">
            {label as string}
          </p>
          {(list as Asset[]).map((a) => (
            <button
              key={a.sym}
              onClick={() => onPick(a)}
              className={cn(
                "flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-[#252c3b]/60",
                a.sym === current.sym && "bg-[#f7931a]/15 text-[#f7931a]",
              )}
            >
              <CoinIcon symbol={a.sym} />
              <div className="flex-1">
                <div className="font-semibold text-sm">{a.sym} Up or Down</div>
                <div className="text-xs text-[#8a93a6]">{a.name}</div>
              </div>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

type Result = { round: number; dir: "up" | "down"; lock: number; settle: number; at: number };

function roundMeta(round: number) {
  const h = hashId(`flash-round-${round}`);
  return { volume: 42_000 + (h % 58_000), traders: 130 + (h % 390) };
}

function Flash() {
  const mobile = useIsMobile();
  const { asset: assetParam } = Route.useSearch();
  const navigate = useNavigate({ from: "/flash" });

  const [asset, setAsset] = useState<Asset>(
    () =>
      assets.find((a) => a.sym.toLowerCase() === assetParam?.toLowerCase()) ??
      assets[0] ?? { sym: "BTC", name: "Bitcoin", seed: 61450, decimals: 2 },
  );

  const [picker, setPicker] = useState(false);
  const [timeframe, setTimeframe] = useState<Timeframe>("60s");
  const [oddsMode, setOddsMode] = useState<OddsMode>("mult");
  const [chartMode, setChartMode] = useState<ChartMode>("line");
  const [stake, setStake] = useState(25);

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
  const [lastOutcome, setLastOutcome] = useState<"up" | "down" | null>(null);
  const [isDetermining, setIsDetermining] = useState(false);
  const [lockP, setLockP] = useState<number | null>(null);

  lastPrice.current = price;

  useEffect(() => {
    if (!resolution) return;
    setLastOutcome(resolution.dir);
    const timer = window.setTimeout(() => setResolution(null), FLASH_RESULT_DISPLAY_MS);
    return () => window.clearTimeout(timer);
  }, [resolution]);

  const locked = remaining <= FLASH_LOCK_WINDOW_SECONDS;

  // Determining winner loader in the last 2 seconds
  useEffect(() => {
    if (remaining <= 2 && remaining > 0 && locked) {
      setIsDetermining(true);
    } else {
      setIsDetermining(false);
    }
  }, [remaining, locked]);

  useEffect(() => {
    lock.current = null;
    setHistory([]);
    setResolution(null);
    setLockP(null);
  }, [asset]);

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
      const healthy = asset.local || statusRef.current === "live";
      if (open.length > 0 && !healthy) {
        open.forEach((p) => voidPosition(p.id));
      } else {
        const settle = lastPrice.current ?? prev.p;
        const dir: Result["dir"] = settle >= prev.p ? "up" : "down";
        setHistory((h) => [{ round: prev.r, dir, lock: prev.p, settle, at: Date.now() }, ...h].slice(0, 20));
        let net = 0;
        open.forEach((p) => {
          const won = p.outcome.toLowerCase() === dir;
          net += won ? p.stake * p.mult - p.stake : -p.stake;
          settlePosition(p.id, won);
        });
        if (open.length) vaultPost("flash", Math.round(-net * 100) / 100, `Flash round #${prev.r} house P&L`);
        if (healthy)
          setResolution({
            round: prev.r,
            dir,
            lock: prev.p,
            settle,
            stake: open.reduce((total, p) => total + p.stake, 0),
            returned: open.reduce(
              (total, p) => total + (p.outcome.toLowerCase() === dir ? payout(p.stake, p.mult) : 0),
              0,
            ),
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
  }, [round, price, asset, positions, settlePosition, voidPosition]);

  useEffect(() => {
    if (status !== "offline") return;
    positions
      .filter((p) => p.marketId === "flash" && p.status === "open")
      .forEach((p) => voidPosition(p.id));
  }, [status, positions, voidPosition]);

  useEffect(() => {
    if (!live || !price || round === null || lock.current?.r !== round) return;
    if (Math.abs(price - lock.current.p) / lock.current.p > 0.02) {
      lock.current = { r: round, p: price };
      setLockP(price);
    }
  }, [live, price, round]);

  const pUp = flashProbability(price, lockP, remaining);
  const lockUp = flashLockout(pUp);
  const lockDown = flashLockout(1 - pUp);
  const tradeAllowed = canTradeFlash(remaining);
  const rakePct = useRake();

  const meta = useMemo(() => roundMeta(round ?? 0), [round]);
  const upStake = meta.volume * Math.max(0.1, Math.min(0.9, pUp * 0.8 + 0.1));
  const raw = useMemo(
    () => ({
      up: parimutuelMultiplier(pUp, upStake, meta.volume, rakePct),
      down: parimutuelMultiplier(1 - pUp, meta.volume - upStake, meta.volume, rakePct),
    }),
    [pUp, upStake, meta.volume, rakePct],
  );

  const [frozenMult, setFrozenMult] = useState<{ r: number; up: number; down: number } | null>(null);
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

  const diff = price && lockP ? price - lockP : 0;
  const myOrders = positions.filter(
    (p) => p.marketId === "flash" && p.round === round && p.status === "open",
  );

  const pick = (a: Asset) => {
    if (myOrders.length > 0) {
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
        marketTitle: `${asset.sym} ${timeframe} Up or Down`,
        outcome: side.toUpperCase() as "UP" | "DOWN",
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

  // Right-to-left moving chart calculations
  const now = Date.now();
  const tfSec = timeframe === "60s" ? 60 : timeframe === "5m" ? 300 : timeframe === "10m" ? 600 : 900;
  const tfMs = tfSec * 1000;
  const roundStart = (round ?? Math.floor(now / tfMs)) * tfMs;
  const winEnd = now + 3000;
  const winStart = winEnd - tfMs;
  const visible = series.filter((t) => t.t >= winStart - 5000);
  const chartData = visible;
  const prices = visible.map((t) => t.p);
  const chanceData = visible.map((t) => ({
    t: t.t,
    c: Math.round(flashProbability(t.p, lockP) * 1000) / 10,
  }));
  const entries = myOrders.map((o) => ({
    id: o.id,
    p: o.entry ?? o.lock ?? lockP ?? 0,
    up: o.outcome === "UP",
  }));

  const lo = Math.min(...prices, lockP ?? asset.seed, ...entries.map((e) => e.p));
  const hi = Math.max(...prices, lockP ?? asset.seed, ...entries.map((e) => e.p));
  const pad = (hi - lo) * 0.25 + asset.seed * 0.0001;

  const buyDisabled = !!user && (!tradeAllowed || !lockP || !live || !ready);

  // Minutes and seconds formatting for the countdown boxes
  const minsRemaining = Math.floor(remaining / 60);
  const secsRemaining = remaining % 60;

  return (
    <div className="min-h-screen bg-[#0d0f17] text-[#eef1f7] font-sans antialiased">
      <Tutorial variant="flash" />

      {/* HEADER: Exactly as wireframe */}
      <header className="flex flex-wrap items-center gap-4 border-b border-[#252c3b] px-4 py-3.5 md:px-8 md:py-4">
        {/* Brand Coin Icon / Dropdown Trigger */}
        {mobile ? (
          <>
            <div
              onClick={() => setPicker(true)}
              className="grid h-11 w-11 cursor-pointer place-items-center rounded-xl bg-[#f7931a] text-xl font-bold text-white shadow-sm md:h-12 md:w-12 md:text-2xl"
            >
              ₿
            </div>
            <Drawer open={picker} onOpenChange={setPicker}>
              <DrawerContent className="border-[#252c3b] bg-[#161b26] px-2 pb-6 text-[#eef1f7]">
                <DrawerTitle className="px-3 pt-3 text-base font-bold text-[#eef1f7]">
                  Select Market
                </DrawerTitle>
                <DrawerDescription className="sr-only">Choose crypto asset</DrawerDescription>
                <AssetList current={asset} onPick={pick} />
              </DrawerContent>
            </Drawer>
          </>
        ) : (
          <Popover open={picker} onOpenChange={setPicker}>
            <PopoverTrigger asChild>
              <button className="grid h-12 w-12 cursor-pointer place-items-center rounded-xl bg-[#f7931a] text-2xl font-bold text-white shadow-sm hover:opacity-90">
                ₿
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80 border-[#252c3b] bg-[#161b26] p-0 shadow-2xl">
              <AssetList current={asset} onPick={pick} />
            </PopoverContent>
          </Popover>
        )}

        {/* Title & Subtitle */}
        <div>
          <div className="text-lg font-semibold tracking-tight md:text-[22px]">
            {asset.sym} Up or Down {timeframe}
          </div>
          <div className="text-xs text-[#8a93a6] md:text-[13px]">
            Round #{round !== null ? round % 10000 : "—"} · Live Binance feed
          </div>
        </div>

        {/* Timeframe Selector Pill Bar */}
        <div className="flex gap-1 rounded-full bg-[#161b26] p-1 text-xs font-medium md:ml-8">
          {(["60s", "5m", "10m", "15m"] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={cn(
                "rounded-full px-3.5 py-1.5 transition",
                timeframe === tf
                  ? "bg-[#f7931a] font-semibold text-black shadow-sm"
                  : "text-[#8a93a6] hover:text-[#eef1f7]",
              )}
            >
              {tf}
            </button>
          ))}
        </div>

        {/* Header Right Actions */}
        <div className="ml-auto flex items-center gap-2">
          <span
            className={cn(
              "flex items-center gap-1.5 rounded-full bg-[#161b26] px-3 py-1.5 text-xs font-medium",
              live ? "text-[#10b981]" : "text-[#8a93a6]",
            )}
          >
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                status === "live"
                  ? "animate-pulse bg-[#10b981]"
                  : status === "stale"
                    ? "bg-amber-400"
                    : "bg-[#ef4444]",
              )}
            />
            <span className="hidden sm:inline">
              {status === "live" ? "Binance Live" : status === "stale" ? "Reconnecting" : "Offline"}
            </span>
          </span>
          <button className="grid h-9 w-9 place-items-center rounded-full bg-[#161b26] text-[#eef1f7] hover:bg-[#252c3b]">
            <Share2 className="h-4 w-4" />
          </button>
          <button className="grid h-9 w-9 place-items-center rounded-full bg-[#161b26] text-[#eef1f7] hover:bg-[#252c3b]">
            <Bookmark className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* MAIN TWO-COLUMN LAYOUT: Chart Column & Sticky Console */}
      <main className="grid gap-6 px-4 py-6 md:grid-cols-[1fr_360px] md:px-8">
        <div className="flex flex-col gap-5">
          {/* Price To Beat, Current Price & Dual Countdown Box */}
          <div className="flex flex-wrap items-end gap-6 md:gap-8">
            <div>
              <div className="text-xs text-[#8a93a6]">Price To Beat</div>
              <div className="font-mono text-2xl font-bold text-[#c9cfdb] md:text-[28px]">
                ${ready && lockP ? fmtPrice(lockP, asset.decimals) : "61,448.32"}
              </div>
            </div>

            <div className="hidden h-12 w-px bg-[#252c3b] sm:block" />

            <div>
              <div className="flex items-center gap-2 text-xs text-[#f7931a]">
                Current Price{" "}
                <span
                  className={cn(
                    "rounded px-1.5 font-mono text-[11px] font-semibold",
                    diff >= 0 ? "bg-[#10b981]/15 text-[#10b981]" : "bg-[#ef4444]/15 text-[#ef4444]",
                  )}
                >
                  {diff >= 0 ? "▲ +" : "▼ "}
                  {fmtPrice(Math.abs(diff), asset.decimals)}
                </span>
              </div>
              <div className="flex items-baseline font-mono text-2xl font-bold text-[#f7931a] md:text-[28px]">
                <span>$</span>
                <Odometer
                  value={price ?? asset.seed}
                  format={(v) => fmtPrice(v, asset.decimals)}
                  className="font-mono font-bold"
                />
              </div>
            </div>

            {/* Countdown Boxes with Mins and Secs */}
            <div className="ml-auto flex gap-2 font-mono text-center">
              <div className="rounded-xl border border-[#ef4444]/30 bg-[#ef4444]/10 px-3 py-1.5">
                <div className="text-2xl font-bold leading-8 text-[#ef4444] md:text-[28px]">
                  {String(minsRemaining).padStart(2, "0")}
                </div>
                <div className="text-[10px] text-[#8a93a6]">MINS</div>
              </div>
              <div className="rounded-xl border border-[#ef4444]/30 bg-[#ef4444]/10 px-3 py-1.5">
                <div className="text-2xl font-bold leading-8 text-[#ef4444] md:text-[28px]">
                  {String(secsRemaining).padStart(2, "0")}
                </div>
                <div className="text-[10px] text-[#8a93a6]">SECS</div>
              </div>
            </div>
          </div>

          {/* ACTIVE GLOWING CHART BOX: exactly as in the wireframe */}
          <div className="relative h-[250px] rounded-2xl border border-[#252c3b] bg-[#161b26]/50 p-4 md:h-[270px]">
            {resolution && <FlashResolution result={resolution} decimals={asset.decimals} />}
            {ready && chartMode === "candle" ? (
              <Candles
                series={series}
                lock={lockP}
                decimals={asset.decimals}
                now={now}
                roundStart={roundStart}
                entries={entries}
                spanMs={tfMs}
              />
            ) : ready && chartMode === "chance" ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chanceData} margin={{ top: 16, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#252c3b" strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="t" type="number" domain={[winStart, winEnd]} allowDataOverflow hide />
                  <ReferenceLine x={roundStart} stroke="#f7931a" strokeDasharray="3 3" />
                  <YAxis
                    orientation="right"
                    domain={[0, 100]}
                    ticks={[0, 25, 50, 75, 100]}
                    tickFormatter={(v) => `${v}%`}
                    tick={{ fill: "#8a93a6", fontSize: 11, fontFamily: "JetBrains Mono" }}
                    axisLine={false}
                    tickLine={false}
                    width={44}
                  />
                  <ReferenceLine y={50} stroke="#f7931a" strokeDasharray="6 4" strokeOpacity={0.6} />
                  <Line
                    type="stepAfter"
                    dataKey="c"
                    stroke={pUp >= 0.5 ? "#10b981" : "#ef4444"}
                    strokeWidth={2.2}
                    isAnimationActive={false}
                    dot={({ cx, cy, index }: { cx?: number; cy?: number; index?: number }) =>
                      index === chanceData.length - 1 ? (
                        <circle cx={cx} cy={cy} r={4.5} fill={pUp >= 0.5 ? "#10b981" : "#ef4444"} />
                      ) : (
                        <g />
                      )
                    }
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : ready ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 16, right: 76, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="amberGlowGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f7931a" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="#f7931a" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#252c3b" strokeDasharray="0" vertical={false} />
                  <XAxis dataKey="t" type="number" domain={[winStart, winEnd]} allowDataOverflow hide />
                  <YAxis
                    orientation="right"
                    domain={[lo - pad, hi + pad]}
                    tickFormatter={(v) => fmtPrice(Number(v), asset.decimals)}
                    tick={{ fill: "#8a93a6", fontSize: 11, fontFamily: "JetBrains Mono" }}
                    axisLine={false}
                    tickLine={false}
                    width={70}
                  />
                  {lockP && (
                    <ReferenceLine
                      y={lockP}
                      stroke="#ffffff"
                      strokeWidth={1.5}
                      strokeDasharray="6 6"
                      strokeOpacity={0.7}
                      label={{
                        value: `$${fmtPrice(lockP, asset.decimals)}`,
                        position: "right",
                        fill: "#0d0f17",
                        fontSize: 11,
                        fontWeight: 700,
                        fontFamily: "JetBrains Mono",
                      }}
                    />
                  )}
                  <Line
                    type="monotone"
                    dataKey="p"
                    stroke="#f7931a"
                    strokeWidth={2.4}
                    isAnimationActive={false}
                    dot={({ cx, cy, index }: { cx?: number; cy?: number; index?: number }) =>
                      index === chartData.length - 1 ? (
                        <g>
                          <circle cx={cx} cy={cy} r={12} fill="#f7931a" opacity={0.2} />
                          <circle cx={cx} cy={cy} r={4.5} fill="#f7931a" />
                        </g>
                      ) : (
                        <g />
                      )
                    }
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full animate-pulse rounded-2xl bg-[#161b26]" />
            )}
          </div>

          {/* ROUND NAVIGATION PILL CAROUSEL & CHART MODE TOGGLE */}
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            {/* Past Rounds Pill with Dots */}
            <Popover>
              <PopoverTrigger asChild>
                <button className="flex h-9 items-center gap-2 rounded-full bg-[#161b26] px-3 text-[#eef1f7] hover:bg-[#252c3b]">
                  <span>Past ▾</span>
                  {history.slice(0, 4).map((h, i) => (
                    <i
                      key={i}
                      className={cn(
                        "h-3.5 w-3.5 rounded-full",
                        h.dir === "up" ? "bg-[#10b981]" : "bg-[#ef4444]",
                      )}
                    />
                  ))}
                  {history.length === 0 && (
                    <>
                      <i className="h-3.5 w-3.5 rounded-full bg-[#ef4444]" />
                      <i className="h-3.5 w-3.5 rounded-full bg-[#10b981]" />
                    </>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-64 border-[#252c3b] bg-[#161b26] p-2 text-xs text-[#eef1f7]">
                <div className="px-2 py-1 font-semibold text-[#8a93a6]">Settled Rounds</div>
                <div className="max-h-48 divide-y divide-[#252c3b] overflow-y-auto">
                  {history.map((h) => (
                    <div key={h.round} className="flex justify-between py-1.5 font-mono">
                      <span className="text-[#8a93a6]">#{h.round % 10000}</span>
                      <span className={h.dir === "up" ? "text-[#10b981]" : "text-[#ef4444]"}>
                        {h.dir.toUpperCase()}
                      </span>
                      <span>${fmtPrice(h.settle, asset.decimals)}</span>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {/* Time / Round Pills */}
            <span className="grid h-9 place-items-center rounded-full bg-[#161b26] px-3.5 text-[#8a93a6]">
              6:45 AM
            </span>
            <span className="flex h-9 items-center gap-1.5 rounded-full bg-white px-3.5 font-bold text-black shadow-sm">
              <i className="h-2 w-2 rounded-full bg-[#ef4444]" />
              6:50 AM
            </span>
            <span className="grid h-9 place-items-center rounded-full bg-[#161b26] px-3.5 text-[#8a93a6]">
              6:55 AM
            </span>
            <span className="hidden h-9 place-items-center rounded-full bg-[#161b26] px-3.5 text-[#8a93a6] sm:grid">
              7:00 AM
            </span>

            {/* Chart Mode Toggle */}
            <span className="ml-auto flex gap-1 rounded-full bg-[#161b26] p-1 text-[#8a93a6]">
              <button
                onClick={() => setChartMode("line")}
                className={cn(
                  "grid h-7 place-items-center rounded-full px-3 transition",
                  chartMode === "line"
                    ? "bg-[#f7931a]/20 font-semibold text-[#f7931a]"
                    : "hover:text-[#eef1f7]",
                )}
              >
                Line
              </button>
              <button
                onClick={() => setChartMode("chance")}
                className={cn(
                  "grid h-7 place-items-center rounded-full px-3 transition",
                  chartMode === "chance"
                    ? "bg-[#f7931a]/20 font-semibold text-[#f7931a]"
                    : "hover:text-[#eef1f7]",
                )}
              >
                Chance
              </button>
              <button
                onClick={() => setChartMode("candle")}
                className={cn(
                  "grid h-7 place-items-center rounded-full px-3 transition",
                  chartMode === "candle"
                    ? "bg-[#f7931a]/20 font-semibold text-[#f7931a]"
                    : "hover:text-[#eef1f7]",
                )}
              >
                Candles
              </button>
            </span>
          </div>

          {/* Market Depth Strip */}
          <div className="flex h-14 items-center rounded-2xl border border-[#252c3b] bg-[#161b26] px-5">
            <span className="text-sm font-semibold">Market depth</span>
            <span className="ml-auto font-mono text-xs text-[#8a93a6]">
              {fmtKES(meta.volume)} Vol.
            </span>
            <span className="ml-3 text-[#8a93a6]">⌄</span>
          </div>

          {/* 4 BOTTOM CARDS: Rules, Live Activity, Discussion & FAQ */}
          <div className="grid gap-5 md:grid-cols-2">
            {/* Rules & TWAP */}
            <div className="rounded-2xl border border-[#252c3b] bg-[#161b26] p-5">
              <div className="flex items-center">
                <span className="text-sm font-semibold md:text-[15px]">Rules &amp; TWAP</span>
                <span className="ml-auto rounded-full bg-[#375bd2]/20 px-2 py-1 text-[11px] font-semibold text-[#7b9bff]">
                  ⬡ Chainlink / Binance
                </span>
              </div>
              <p className="mt-3 text-[13px] leading-5 text-[#8a93a6]">
                Up wins if the final tick at round close is at or above ${ready && lockP ? fmtPrice(lockP, asset.decimals) : "61,448.32"}. Winners split the losing pool peer-to-peer, minus a 1% fee.
              </p>
            </div>

            {/* Live Activity Ledger */}
            <div className="rounded-2xl border border-[#252c3b] bg-[#161b26] p-5">
              <div className="flex items-center text-sm font-semibold md:text-[15px]">
                Live activity
                <i className="ml-2 h-2 w-2 rounded-full bg-[#10b981] shadow-[0_0_8px_#10b981]" />
              </div>
              <div className="mt-3 space-y-3 text-xs md:text-[13px]">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-[11px] text-[#8a93a6]">0x4f…a21</span>
                  <span className="font-medium text-[#10b981]">bought Up</span>
                  <span className="font-mono font-bold">$120</span>
                  <span className="ml-auto font-mono text-[11px] text-[#8a93a6]">2s</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-[11px] text-[#8a93a6]">satoshi.eth</span>
                  <span className="font-medium text-[#ef4444]">bought Down</span>
                  <span className="font-mono font-bold">$45</span>
                  <span className="ml-auto font-mono text-[11px] text-[#8a93a6]">9s</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-[11px] text-[#8a93a6]">0x9c…07e</span>
                  <span className="font-medium text-[#10b981]">bought Up</span>
                  <span className="font-mono font-bold">$500</span>
                  <span className="ml-auto font-mono text-[11px] text-[#8a93a6]">14s</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-[11px] text-[#8a93a6]">kira.sol</span>
                  <span className="font-medium text-[#ef4444]">bought Down</span>
                  <span className="font-mono font-bold">$25</span>
                  <span className="ml-auto font-mono text-[11px] text-[#8a93a6]">31s</span>
                </div>
              </div>
            </div>

            {/* Comments / Discussion */}
            <div className="rounded-2xl border border-[#252c3b] bg-[#161b26] p-5">
              <div className="flex gap-1 text-xs font-semibold">
                <span className="rounded-full bg-white/10 px-3 py-1.5">Comments 48</span>
                <span className="px-3 py-1.5 text-[#8a93a6]">Top holders</span>
              </div>
              <div className="mt-4 flex gap-3 text-xs md:text-[13px]">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#f7931a]/20 font-bold text-[#f7931a]">
                  M
                </div>
                <div>
                  <span className="font-semibold">mara.btc</span>
                  <p className="mt-0.5 text-[#8a93a6]">Funding flipped negative, fading this bounce.</p>
                </div>
              </div>
            </div>

            {/* FAQ Accordion */}
            <div className="rounded-2xl border border-[#252c3b] bg-[#161b26] p-5 text-xs md:text-[13px]">
              <div className="mb-1 text-sm font-semibold md:text-[15px]">FAQ</div>
              <div className="divide-y divide-[#252c3b]">
                <details className="group py-2.5">
                  <summary className="flex cursor-pointer list-none justify-between font-medium">
                    How are payouts calculated?
                    <span className="text-[#8a93a6] group-open:rotate-45 transition">+</span>
                  </summary>
                  <p className="mt-1.5 text-xs text-[#8a93a6]">
                    Winning stakes share the losing pool proportionally to their bets minus a 1% protocol fee.
                  </p>
                </details>
                <details className="group py-2.5">
                  <summary className="flex cursor-pointer list-none justify-between font-medium">
                    What if the price ties the target?
                    <span className="text-[#8a93a6] group-open:rotate-45 transition">+</span>
                  </summary>
                  <p className="mt-1.5 text-xs text-[#8a93a6]">
                    At exact tie, the round settles UP as the price held the lock line.
                  </p>
                </details>
                <details className="group py-2.5">
                  <summary className="flex cursor-pointer list-none justify-between font-medium">
                    When do winnings settle?
                    <span className="text-[#8a93a6] group-open:rotate-45 transition">+</span>
                  </summary>
                  <p className="mt-1.5 text-xs text-[#8a93a6]">
                    Settlement executes on-chain within 500ms of the round terminating.
                  </p>
                </details>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT STICKY BETTING CONSOLE: exactly as wireframe */}
        <aside>
          <div className="sticky top-6 rounded-[20px] border border-[#252c3b] bg-[#161b26] p-5 shadow-xl">
            {/* Console Header */}
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#f7931a] text-xl font-bold text-white shadow-sm">
                ₿
              </div>
              <div>
                <div className="text-[13px] text-[#8a93a6]">{asset.sym} Up or Down {timeframe}</div>
                <div className="font-semibold text-[#10b981]">Up</div>
              </div>

              {/* × / % Toggle */}
              <span className="ml-auto flex rounded-full bg-[#0d0f17] p-0.5 font-mono text-xs">
                <button
                  onClick={() => setOddsMode("mult")}
                  className={cn(
                    "rounded-full px-2.5 py-1 font-bold transition",
                    oddsMode === "mult" ? "bg-white text-black" : "text-[#8a93a6]",
                  )}
                >
                  ×
                </button>
                <button
                  onClick={() => setOddsMode("pct")}
                  className={cn(
                    "rounded-full px-2.5 py-1 font-bold transition",
                    oddsMode === "pct" ? "bg-white text-black" : "text-[#8a93a6]",
                  )}
                >
                  %
                </button>
              </span>
            </div>

            {/* Big 1.85x Up & 2.15x Down Buttons */}
            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <button
                disabled={buyDisabled || lockUp}
                onClick={() => place("up")}
                className="flex h-14 items-center justify-center gap-1.5 rounded-2xl bg-[#10b981] text-base font-bold text-black shadow-[0_0_24px_#10b98155] transition hover:brightness-105 active:scale-[0.98] disabled:opacity-50"
              >
                Up{" "}
                <span className="font-mono">
                  {oddsMode === "mult" ? `${multUp.toFixed(2)}x` : `${Math.round(pUp * 100)}%`}
                </span>
              </button>

              <button
                disabled={buyDisabled || lockDown}
                onClick={() => place("down")}
                className="flex h-14 items-center justify-center gap-1.5 rounded-2xl border border-[#252c3b] bg-[#1f2533] text-base font-bold text-[#ef4444] transition hover:bg-[#252c3b] active:scale-[0.98] disabled:opacity-50"
              >
                Down{" "}
                <span className="font-mono">
                  {oddsMode === "mult" ? `${multDown.toFixed(2)}x` : `${100 - Math.round(pUp * 100)}%`}
                </span>
              </button>
            </div>

            {/* ONE-TAP BUY CARDS: Stake amount + Green Projected Win Payout */}
            <div className="mt-6 text-sm font-semibold">One-tap buy</div>
            <div className="mt-3 grid grid-cols-3 gap-2.5">
              {[5, 25, 100].map((amt) => {
                const estWin = Math.round(amt * multUp);
                return (
                  <button
                    key={amt}
                    onClick={() => setStake(amt)}
                    className={cn(
                      "rounded-2xl border bg-[#0d0f17] py-3 transition hover:border-[#10b981] active:scale-95",
                      stake === amt ? "border-[#10b981] bg-[#10b981]/10" : "border-[#252c3b]",
                    )}
                  >
                    <div className="font-mono text-lg font-bold md:text-[20px]">${amt}</div>
                    <div className="text-xs text-[#8a93a6]">
                      win <span className="font-semibold text-[#10b981]">${estWin}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Custom Stake Input */}
            <div className="mt-3 flex items-center justify-between rounded-xl border border-[#252c3b] bg-[#0d0f17] px-3 py-2 text-xs">
              <span className="text-[#8a93a6]">Custom Stake</span>
              <input
                type="number"
                value={stake || ""}
                onChange={(e) => setStake(Number(e.target.value) || 0)}
                className="w-20 bg-transparent text-right font-mono font-bold text-[#eef1f7] outline-none"
              />
              <span className="ml-1 font-mono text-[#8a93a6]">USD</span>
            </div>
          </div>
        </aside>
      </main>

      {/* MOBILE STICKY BOTTOM BAR: exactly as in flash-trading-mobile */}
      {mobile && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-2 border-t border-[#252c3b] bg-[#0d0f17] px-3 pb-3 pt-2">
          {isDetermining ? (
            /* Determining Winner Loader State */
            <span className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full border border-[#252c3b] bg-[#161b26] text-sm font-semibold text-[#f7931a]">
              <Loader2 className="h-4 w-4 animate-spin text-[#f7931a]" />
              Hold on, determining winner...
            </span>
          ) : (
            /* Settled Outcome Pill State: e.g. Outcome: Down */
            <span
              className={cn(
                "flex h-12 flex-1 items-center justify-center gap-2 rounded-full border border-[#252c3b] bg-[#161b26] text-[15px] font-semibold",
                lastOutcome === "up" ? "text-[#10b981]" : "text-[#ef4444]",
              )}
            >
              <span
                className={cn(
                  "grid h-5 w-5 place-items-center rounded-full text-[11px] text-white",
                  lastOutcome === "up" ? "bg-[#10b981]" : "bg-[#ef4444]",
                )}
              >
                {lastOutcome === "up" ? "▲" : "▼"}
              </span>
              Outcome: {lastOutcome === "up" ? "Up" : "Down"}
            </span>
          )}

          {/* Action button on its right for clicking UP */}
          <button
            onClick={() => place("up")}
            disabled={buyDisabled || lockUp}
            className="grid h-12 w-12 place-items-center rounded-full bg-white text-black shadow-md hover:bg-white/90 active:scale-95 disabled:opacity-50"
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M9 15V3M4 8l5-5 5 5" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
