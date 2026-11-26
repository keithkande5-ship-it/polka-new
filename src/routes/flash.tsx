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
  TrendingDown,
  TrendingUp,
  CheckCircle2,
  History,
  Percent,
  Zap,
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


export const Route = createFileRoute("/flash")({
  validateSearch: (search: Record<string, unknown>) => {
    const a = search["asset"];
    return typeof a === "string" && a.length > 0 ? { asset: a } : {};
  },
  head: () => ({
    meta: [
      { title: "Flash Up or Down — Fast Crypto Rounds | Polka" },
      {
        name: "description",
        content: "Call BTC, ETH, SOL and more Up or Down in fast rounds with live Binance prices.",
      },
      { property: "og:title", content: "Flash Up or Down | Polka" },
      {
        property: "og:description",
        content: "Fast Up/Down crypto rounds on live Binance prices with instant M-Pesa payouts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Flash,
});

type ChartMode = "line" | "candle" | "chance";
type Timeframe = "60s" | "5m" | "10m" | "15m";
type OddsDisplay = "multiplier" | "percentage";
type FlashRoundPhase = "next" | "active";

const FLASH_NEXT_SECONDS = 3;
const FLASH_ACTIVE_SECONDS = 60;
const FLASH_CYCLE_MS = (FLASH_NEXT_SECONDS + FLASH_ACTIVE_SECONDS) * 1000;

function useFlashRound() {
  const [now, setNow] = useState<number | null>(null);
  const origin = useRef<number | null>(null);

  useEffect(() => {
    const start = Date.now();
    origin.current = start;
    setNow(start);

    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  if (now === null || origin.current === null) {
    return {
      round: null as number | null,
      remaining: FLASH_NEXT_SECONDS,
      phase: "next" as FlashRoundPhase,
      roundStart: null as number | null,
    };
  }

  const elapsed = now - origin.current;
  const cycle = Math.floor(elapsed / FLASH_CYCLE_MS);
  const cycleOffset = elapsed % FLASH_CYCLE_MS;
  const phase: FlashRoundPhase =
    cycleOffset < FLASH_NEXT_SECONDS * 1000 ? "next" : "active";

  return {
    round: cycle,
    phase,
    remaining:
      phase === "next"
        ? Math.ceil((FLASH_NEXT_SECONDS * 1000 - cycleOffset) / 1000)
        : Math.ceil((FLASH_CYCLE_MS - cycleOffset) / 1000),
    roundStart: origin.current + cycle * FLASH_CYCLE_MS + FLASH_NEXT_SECONDS * 1000,
  };
}
/** Traditional 5-second OHLC candles spanning the previous and current round. */
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
  const openX = ((roundStart - (roundStart - spanMs)) / (spanMs * 2)) * plotW;
  const isUp = (last?.c ?? 0) >= (lock ?? 0);
  const trackerColor = isUp ? "var(--up)" : "var(--down)";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full overflow-visible" preserveAspectRatio="none">
      <defs>
        <pattern id="grid" width="60" height="40" patternUnits="userSpaceOnUse">
          <path d="M 60 0 L 0 0 0 40" fill="none" stroke="var(--border)" strokeWidth="0.5" strokeDasharray="2 4" />
        </pattern>
      </defs>
      <rect width={plotW} height={plotH} y={top} fill="url(#grid)" opacity={0.6} />

      {/* Orange Target Line (Price to Beat) */}
      {lock && (
        <g>
          <line x1={0} x2={plotW} y1={y(lock)} y2={y(lock)} stroke="#f7931a" strokeWidth="1.5" strokeDasharray="4 3" />
          <rect x={plotW + 4} y={y(lock) - 10} width="66" height="20" rx="4" fill="#f7931a" />
          <text x={plotW + 8} y={y(lock) + 4} fill="#000000" fontSize="10" fontWeight="bold" fontFamily="var(--font-mono)">
            {fmtPrice(lock, decimals)}
          </text>
        </g>
      )}

      {/* Dynamic Live Price Tracker Line */}
      {last && (
        <g>
          <line x1={0} x2={plotW} y1={y(last.c)} y2={y(last.c)} stroke={trackerColor} strokeWidth="1.2" strokeDasharray="3 3" opacity={0.8} />
          <rect x={plotW + 4} y={y(last.c) - 10} width="66" height="20" rx="4" fill={trackerColor} />
          <text x={plotW + 8} y={y(last.c) + 4} fill="#ffffff" fontSize="10" fontWeight="bold" fontFamily="var(--font-mono)">
            {fmtPrice(last.c, decimals)}
          </text>
        </g>
      )}

      {/* Y-Axis High & Low Guide Prices */}
      <text x={plotW + 8} y={top + 10} fill="var(--muted-foreground)" fontSize="9" fontFamily="var(--font-mono)">
        {fmtPrice(hi, decimals)}
      </text>
      <text x={plotW + 8} y={top + plotH} fill="var(--muted-foreground)" fontSize="9" fontFamily="var(--font-mono)">
        {fmtPrice(lo, decimals)}
      </text>

      {/* Round Open Line */}
      <line x1={openX} x2={openX} y1={top} y2={top + plotH} stroke="var(--primary)" strokeWidth="1" strokeDasharray="3 3" opacity={0.6} />

      {/* Candlesticks */}
      {[...buckets.entries()].map(([k, c]) => {
        const cx = xOf(k);
        const up = c.c >= c.o;
        const color = up ? "var(--up)" : "var(--down)";
        const topY = y(Math.max(c.o, c.c));
        const botY = y(Math.min(c.o, c.c));
        const h = Math.max(1.5, botY - topY);
        return (
          <g key={k}>
            <line x1={cx} x2={cx} y1={y(c.h)} y2={y(c.l)} stroke={color} strokeWidth="1.2" />
            <rect x={cx - bodyW / 2} y={topY} width={bodyW} height={h} fill={color} rx="1" />
          </g>
        );
      })}

      {/* Entry Markers */}
      {entries.map((e) => (
        <circle key={e.id} cx={plotW - 12} cy={y(e.p)} r="3.5" fill={e.up ? "var(--up)" : "var(--down)"} stroke="var(--background)" strokeWidth="1" />
      ))}
    </svg>
  );


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
        const rel = Math.max(-1, Math.min(1, (s.move / (entry * 0.0005)) * (s.side === "UP" ? 1 : -1)));
        const pos = 50 + rel * 50;
        return (
          <div
            key={s.id}
            className={cn(
              "rounded-xl border p-3",
              s.winning ? "border-up/40 bg-up/5" : s.tie ? "border-border" : "border-down/40 bg-down/5",
            )}
          >
            <div className="num flex items-center justify-between text-xs font-semibold">
              <span className={s.winning ? "text-up" : s.tie ? "text-muted-foreground" : "text-down"}>
                {s.side} · {s.winning ? "WINNING" : s.tie ? "EVEN" : "LOSING"}
              </span>
              <span className="text-muted-foreground">{remaining}s left</span>
            </div>
            <div className="relative mt-2 h-2.5 overflow-hidden rounded-full bg-muted">
              <div className="absolute inset-y-0 left-0 bg-down/40" style={{ width: "50%" }} />
              <div className="absolute inset-y-0 right-0 bg-up/40" style={{ width: "50%" }} />
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

function roundMeta(round: number) {
  const h = hashId(`flash-round-${round}`);
  return { volume: 45_000 + (h % 55_000), traders: 140 + (h % 380) };
}

function AssetList({ current, onPick }: { current: Asset; onPick: (a: Asset) => void }) {
  return (
    <div className="divide-y">
      {[
        ["Crypto · Binance Live", assets.filter((a) => !a.local)],
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
                <span className="block text-sm font-semibold">{a.sym} Up or Down</span>
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
  const [timeframe, setTimeframe] = useState<Timeframe>("60s");
  const [oddsMode, setOddsMode] = useState<OddsDisplay>("multiplier");
  const [chartMode, setChartMode] = useState<ChartMode>("line");
  const [stake, setStake] = useState(100);
  const [selectedSide, setSelectedSide] = useState<"up" | "down">("up");
  const [selectedHistory, setSelectedHistory] = useState<Result | null>(null);

  const { price, live, series, status, ready, retry } = useLivePrice(asset);
  const { round, remaining, phase } = useFlashRound(timeframe);
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

  // Simulated preview activity; these are not real user trades.
  const [botTrades, setBotTrades] = useState([
    { id: "b1", user: "0x7a…e4", side: "UP" as const, stake: 250, time: "2s ago" },
    { id: "b2", user: "Kamau.eth", side: "DOWN" as const, stake: 100, time: "5s ago" },
    { id: "b3", user: "CryptoOtieno", side: "UP" as const, stake: 500, time: "11s ago" },
    { id: "b4", user: "0x91…bc", side: "UP" as const, stake: 1000, time: "18s ago" },
    { id: "b5", user: "Wanjiku_t", side: "DOWN" as const, stake: 200, time: "27s ago" },
  ]);

  const [comments, setComments] = useState([
    { id: "c1", user: "satoshi.ke", text: "Bullish divergence on the 5m candles!", time: "1m ago", sentiment: "UP" as const },
    { id: "c2", user: "AminaTrades", text: "Holding the price to beat nicely this round.", time: "3m ago", sentiment: "UP" as const },
    { id: "c3", user: "NairobiWhale", text: "Heavy sell pressure incoming on Binance spot.", time: "6m ago", sentiment: "DOWN" as const },
  ]);
  const [newComment, setNewComment] = useState("");

  useEffect(() => {
    const names = ["0x4f…a2", "Mwangi.eth", "AmaniTrader", "0x88…f1", "Kip_crypto", "Baraka99"];
    const stakes = [50, 100, 250, 500, 1000];

    const interval = window.setInterval(() => {
      const side = Math.random() > 0.48 ? "UP" : "DOWN";
      const username = names[Math.floor(Math.random() * names.length)];
      const stakeAmount = stakes[Math.floor(Math.random() * stakes.length)];

      setBotTrades((previous) => [
        {
          id: `${Date.now()}-${Math.random()}`,
          user: username,
          side,
          stake: stakeAmount,
          time: "just now",
        },
        ...previous.slice(0, 5),
      ]);
    }, 4500);

    return () => window.clearInterval(interval);
  }, []);

  lastPrice.current = price;

  useEffect(() => {
    if (!resolution) return;
    setLastOutcome(resolution.dir);
    const timer = window.setTimeout(() => setResolution(null), FLASH_RESULT_DISPLAY_MS);
    return () => window.clearTimeout(timer);
  }, [resolution]);

  const locked = remaining <= FLASH_LOCK_WINDOW_SECONDS;

  // Trigger "Determining winner..." loader in the final seconds of the round
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
        setHistory((h) => [{ round: prev.r, dir, lock: prev.p, settle, at: Date.now() }, ...h].slice(0, 30));
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
            toast.success(`You won: +${fmtKES(net, 2)}`, {
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
  const upStake = meta.volume * biasRatio(pUp);
  function biasRatio(prob: number) {
    return Math.max(0.1, Math.min(0.9, prob * 0.8 + 0.1));
  }
  const bias = meta.volume > 0 ? upStake / meta.volume : 0.5;

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
  const evenMult = parimutuelMultiplier(0.5, 1, 2, rakePct);
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

  const place = (side: "up" | "down", amount = stake) => {
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
    if (amount > balance) return openCashier("deposit", amount - balance);

    const mult = side === "up" ? multUp : multDown;
    if (
      !addPosition({
        marketId: "flash",
        marketTitle: `${asset.sym} ${timeframe} Up or Down`,
        outcome: side.toUpperCase() as "UP" | "DOWN",
        stake: amount,
        mult,
        round,
        asset: asset.sym,
        lock: lockP,
        entry: price ?? lockP,
      })
    )
      return;

    toast(`${side.toUpperCase()} · ${fmtKES(amount)} @ ${mult.toFixed(2)}x`, {
      description: `Projected payout ${fmtKES(payout(amount, mult), 2)}`,
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
  const myStatus = myOrders.map((o) => {
    const entry = o.entry ?? o.lock ?? lockP ?? 0;
    const move = (price ?? entry) - entry;
    const winning = o.outcome === "UP" ? move > 0 : move < 0;
    return { id: o.id, side: o.outcome, winning, tie: move === 0, move, payout: payout(o.stake, o.mult) };
  });

  const lo = Math.min(...prices, lockP ?? asset.seed, ...entries.map((e) => e.p));
  const hi = Math.max(...prices, lockP ?? asset.seed, ...entries.map((e) => e.p));
  const pad = (hi - lo) * 0.25 + asset.seed * 0.0001;

  const settled = positions.filter(
    (p) => p.marketId === "flash" && (p.status === "won" || p.status === "lost"),
  );
  const pnl = settled.reduce(
    (a, p) => a + (p.status === "won" ? p.stake * p.mult - p.stake : -p.stake),
    0,
  );
  const buyDisabled = !!user && (!tradeAllowed || !lockP || !live || !ready || phase === "next");

  const presetStakes = [50, 100, 250, 500, 1000];

  const trigger = (
    <button className="flex items-center gap-2 rounded-xl bg-secondary/80 px-3 py-1.5 text-base font-bold shadow-sm transition hover:bg-secondary">
      <CoinIcon symbol={asset.sym} />
      <span>{asset.sym} Up/Down</span>
      <ChevronDown className="h-4 w-4 text-muted-foreground" />
    </button>
  );

  return (
    <div className="mx-auto max-w-7xl px-3 pb-44 pt-3 md:px-6 md:pb-10 md:pt-5">
      <h1 className="sr-only">Up or Down Crypto Prediction Rounds</h1>
      <Tutorial variant="flash" />

      {/* TOP BAR: Asset picker, Timeframe pills, & WebSocket Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-3">
        <div className="flex items-center gap-3">
          {mobile ? (
            <>
              <div onClick={() => setPicker(true)}>{trigger}</div>
              <Drawer open={picker} onOpenChange={setPicker}>
                <DrawerContent className="px-2 pb-6">
                  <DrawerTitle className="px-3 pt-3 font-bold">Select market</DrawerTitle>
                  <DrawerDescription className="sr-only">Choose an asset</DrawerDescription>
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

          {/* Timeframe Selector Pills */}
          <div className="flex items-center rounded-lg bg-secondary/80 p-1 text-xs font-semibold">
            {(["60s", "5m", "10m", "15m"] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={cn(
                  "rounded-md px-2.5 py-1 transition",
                  timeframe === tf
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        {/* Binance Live Feed Indicator */}
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
              live ? "bg-up/10 text-up" : "bg-muted text-muted-foreground",
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
                      ? "bg-amber-400"
                      : "bg-down",
              )}
            />
            {!asset.local && status === "stale" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Radio className="h-3.5 w-3.5" />
            )}
            {asset.local
              ? "Simulated"
              : status === "live"
                ? "Binance live"
                : status === "stale"
                  ? "Reconnecting"
                  : "Offline"}
          </span>
          {!asset.local && status === "offline" && (
            <button
              onClick={retry}
              className="rounded-md border px-2 py-0.5 text-xs font-semibold hover:bg-secondary"
            >
              Retry
            </button>
          )}
        </div>
      </div>

      {/* ROUND NAVIGATION PILL CAROUSEL */}
      <div className="no-scrollbar mt-3 flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <Popover>
          <PopoverTrigger asChild>
            <button className="flex shrink-0 items-center gap-1.5 rounded-lg border bg-secondary/50 px-2.5 py-1.5 font-semibold text-muted-foreground hover:text-foreground">
              <History className="h-3.5 w-3.5" />
              <span>Past</span>
              <ChevronDown className="h-3 w-3" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 p-2">
            <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Recent Settlements
            </p>
            {history.length === 0 ? (
              <p className="px-2 py-2 text-xs text-muted-foreground">No settled rounds yet.</p>
            ) : (
              <div className="max-h-48 divide-y overflow-y-auto">
                {history.slice(0, 10).map((h) => (
                  <div key={h.round} className="flex items-center justify-between py-1.5 text-xs">
                    <span className="font-mono text-muted-foreground">#{h.round % 10000}</span>
                    <span className={cn("font-bold", h.dir === "up" ? "text-up" : "text-down")}>
                      {h.dir.toUpperCase()}
                    </span>
                    <span className="font-mono text-[11px]">{fmtPrice(h.settle, asset.decimals)}</span>
                  </div>
                ))}
              </div>
            )}
          </PopoverContent>
        </Popover>

               {/* Clickable Recent Mini History Dots */}
        {history.slice(0, 5).map((h) => (
          <button
            key={h.round}
            onClick={() => setSelectedHistory(h)}
            aria-label={`View details for round ${h.round % 10000}`}
            className="flex shrink-0 items-center gap-1 rounded-md border border-border/40 bg-card px-2 py-1 font-mono text-[11px] transition hover:border-primary"
          >
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                h.dir === "up" ? "bg-up" : "bg-down",
              )}
            />
            <span>#{h.round % 10000}</span>
          </button>
        ))}

        {/* Live Active Round Pill */}
        <div className="flex shrink-0 items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1 font-semibold text-primary">
          <span className="h-2 w-2 animate-ping rounded-full bg-primary" />
          <span>Round #{round !== null ? round % 10000 : "—"}</span>
          <span className="rounded bg-primary/20 px-1 font-mono text-[10px]">
            {phase === "next" ? "PREPARING" : "LIVE"}
          </span>
        </div>
      {/* Selected Round History Details */}
      {selectedHistory && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-secondary/50 p-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-bold">
              Round #{selectedHistory.round % 10000} Details
            </span>
            <span
              className={cn(
                "rounded px-2 py-0.5 font-bold",
                selectedHistory.dir === "up"
                  ? "bg-up/20 text-up"
                  : "bg-down/20 text-down",
              )}
            >
              {selectedHistory.dir.toUpperCase()} WIN
            </span>
            <span className="text-muted-foreground">
              Price to Beat:{" "}
              <strong className="text-foreground">
                {fmtPrice(selectedHistory.lock, asset.decimals)}
              </strong>
            </span>
            <span className="text-muted-foreground">
              Settled:{" "}
              <strong className="text-foreground">
                {fmtPrice(selectedHistory.settle, asset.decimals)}
              </strong>
            </span>
            <span className="text-muted-foreground">
              Settled at:{" "}
              <strong className="text-foreground">
                {new Date(selectedHistory.at).toLocaleTimeString()}
              </strong>
            </span>
          </div>
          <button
            onClick={() => setSelectedHistory(null)}
            className="rounded px-2 py-0.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            Close ✕
          </button>
        </div>
      )}
       {/* Upcoming Round */}
        <div className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border/40 bg-card px-2.5 py-1 text-muted-foreground">
          <span>Next #{round !== null ? (round + 1) % 10000 : "—"}</span>
        </div>
      </div>

      {/* MAIN TWO-COLUMN TRADING GRID */}
      <div className="mt-4 grid gap-5 md:grid-cols-[minmax(0,1fr)_340px]">
        {/* LEFT COLUMN: Price hero, Chart & Live round status */}
        <section className="min-w-0 rounded-2xl border bg-card p-4 shadow-sm md:p-5">
          {/* Header Stats */}
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/30 pb-4">
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  {asset.sym}/{asset.local ? "KES" : "USDT"} Current Price
                </p>
                {ready ? (
                  <Odometer
                    value={price ?? asset.seed}
                    format={(v) => fmtPrice(v, asset.decimals)}
                    className={cn(
                      "num mt-1 text-3xl font-extrabold tracking-tight md:text-4xl",
                      diff >= 0 ? "text-up" : "text-down",
                    )}
                  />
                ) : (
                  <div className="mt-2 h-10 w-48 animate-pulse rounded bg-muted" />
                )}
              </div>

              <div className="border-l border-border/60 pl-4">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Price to Beat
                </p>
                <p className="num mt-1 text-sm font-bold">
                  {ready && lockP ? fmtPrice(lockP, asset.decimals) : "—"}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-secondary/40 px-3.5 py-2 text-right">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Time Left
              </p>
              <p
                className={cn(
                  "num text-xl font-black",
                  locked ? "text-down animate-pulse" : "text-primary",
                )}
              >
                00:{String(remaining).padStart(2, "0")}
              </p>
            </div>
          </div>
          {/* Chart Controls Bar */}
          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-foreground">
                {Math.round(pUp * 100)}% UP chance
              </span>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs font-medium text-muted-foreground">
                {100 - Math.round(pUp * 100)}% DOWN
              </span>
            </div>

            <div className="flex items-center gap-1 rounded-lg bg-secondary/70 p-0.5 text-xs">
              <button
                onClick={() => setChartMode("line")}
                className={cn(
                  "rounded-md px-2 py-1 font-medium transition",
                  chartMode === "line" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
                )}
              >
                Line
              </button>
              <button
                onClick={() => setChartMode("candle")}
                className={cn(
                  "rounded-md px-2 py-1 font-medium transition",
                  chartMode === "candle" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
                )}
              >
                Candles
              </button>
              <button
                onClick={() => setChartMode("chance")}
                className={cn(
                  "rounded-md px-2 py-1 font-medium transition",
                  chartMode === "chance" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
                )}
              >
                % Chance
              </button>
            </div>
          </div>

          {/* Active Moving Chart Viewport */}
          <div className="relative mt-2 h-[290px] min-h-[260px] min-w-0">
        
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
                        <circle cx={cx} cy={cy} r={4} fill={pUp >= 0.5 ? "var(--up)" : "var(--down)"} />
                      ) : (
                        <g />
                      )
                    }
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : ready ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
                  <XAxis
                    dataKey="t"
                    type="number"
                    domain={[winStart, winEnd]}
                    allowDataOverflow
                    tickFormatter={(t) =>
                      new Date(t).toLocaleTimeString([], { minute: "2-digit", second: "2-digit" })
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
                    width={64}
                  />
                  <ReferenceLine x={roundStart} stroke="var(--primary)" strokeOpacity={0.6} strokeDasharray="3 3" />
                                   {/* Orange Target Line (Price to Beat) */}
                  {lockP && (
                    <ReferenceLine
                      y={lockP}
                      stroke="#f7931a"
                      strokeWidth={1.5}
                      strokeDasharray="4 3"
                      label={{
                        value: `Target $${fmtPrice(lockP, asset.decimals)}`,
                        position: "insideTopRight",
                        fill: "#f7931a",
                        fontSize: 10,
                        fontFamily: "var(--font-mono)",
                        fontWeight: "bold",
                      }}
                    />
                  )}

                  {/* Current Price Horizontal Tracker Line */}
                  {price && (
                    <ReferenceLine
                      y={price}
                      stroke={diff >= 0 ? "var(--up)" : "var(--down)"}
                      strokeWidth={1.2}
                      strokeDasharray="3 3"
                      label={{
                        value: `$${fmtPrice(price, asset.decimals)}`,
                        position: "insideBottomRight",
                        fill: diff >= 0 ? "var(--up)" : "var(--down)",
                        fontSize: 10,
                        fontFamily: "var(--font-mono)",
                        fontWeight: "bold",
                      }}
                    />
                  )}
                  <Line
                    type="monotone"
                    dataKey="p"
                    stroke={diff >= 0 ? "var(--up)" : "var(--down)"}
                    strokeWidth={2.5}
                    dot={({ cx, cy, index }: { cx?: number; cy?: number; index?: number }) =>
                      index === chartData.length - 1 ? (
                        <circle cx={cx} cy={cy} r={4.5} fill={diff >= 0 ? "var(--up)" : "var(--down)"} />
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

          <RoundPoll status={myStatus} price={price} entries={entries} decimals={asset.decimals} remaining={remaining} />
        </section>

        {/* RIGHT COLUMN: Polymarket Betting Sidebar */}
               {/* RIGHT COLUMN: P2P One-Tap Trade Console */}
        <section className="hidden space-y-4 rounded-2xl border bg-card p-4 shadow-sm md:block">
          {/* Side Selector Tabs (UP vs DOWN) */}
          <div className="flex items-center justify-between border-b border-border/30 pb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Select Outcome
            </span>
            <div className="flex items-center rounded-lg bg-secondary p-0.5 text-xs font-semibold">
              <button
                onClick={() => setSelectedSide("up")}
                className={cn(
                  "flex items-center gap-1 rounded-md px-3 py-1 font-bold transition",
                  selectedSide === "up"
                    ? "bg-up text-black shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                ▲ UP ({multUp.toFixed(2)}x)
              </button>
              <button
                onClick={() => setSelectedSide("down")}
                className={cn(
                  "flex items-center gap-1 rounded-md px-3 py-1 font-bold transition",
                  selectedSide === "down"
                    ? "bg-down text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                ▼ DOWN ({multDown.toFixed(2)}x)
              </button>
            </div>
          </div>

          {/* One-tap buy buttons */}
          <div>
            <div className="mb-2 flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>One-Tap Buy ({selectedSide.toUpperCase()})</span>
              <span>Executes Instantly</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[100, 250, 500].map((amt) => {
                const activeMult = selectedSide === "up" ? multUp : multDown;
                const estWin = payout(amt, activeMult);

                return (
                  <button
                    key={amt}
                    disabled={buyDisabled || (selectedSide === "up" ? lockUp : lockDown)}
                    onClick={() => place(selectedSide, amt)}
                    className={cn(
                      "flex flex-col items-center justify-center rounded-xl border p-2.5 text-center transition hover:scale-[1.02] active:scale-95 disabled:opacity-50",
                      selectedSide === "up"
                        ? "border-up/40 bg-up/10 hover:border-up"
                        : "border-down/40 bg-down/10 hover:border-down",
                    )}
                  >
                    <span className="font-mono text-sm font-bold text-foreground">
                      {amt} KES
                    </span>
                    <span className="mt-1 flex items-center font-mono text-[10px] font-semibold text-up">
                      win&nbsp;
                      <Odometer
                        value={estWin}
                        format={(v) => fmtKES(v)}
                        className="font-mono"
                      />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom stake and Buy button */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center gap-2">
              <input
                aria-label="Custom stake amount"
                inputMode="numeric"
                value={stake ? stake.toLocaleString("en-KE") : ""}
                placeholder="Custom stake..."
                onChange={(e) =>
                  setStake(Math.min(1_000_000, Number(e.target.value.replace(/\D/g, "")) || 0))
                }
                className="num h-10 flex-1 rounded-xl border bg-secondary/40 px-3 text-sm font-bold outline-none focus:border-primary"
              />
              <Btn3D
                variant={selectedSide}
                disabled={buyDisabled || (selectedSide === "up" ? lockUp : lockDown)}
                onClick={() => place(selectedSide)}
                className="h-10 px-4 text-xs font-bold"
              >
                Buy {selectedSide.toUpperCase()}
              </Btn3D>
            </div>
            <p className="text-center text-[11px] text-muted-foreground">
              Win payout:{" "}
              <strong className="text-up">
                {fmtKES(payout(stake, selectedSide === "up" ? multUp : multDown))}
              </strong>
            </p>
          </div>

          {/* Intermission and lock status */}
          {phase === "next" && (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary/10 py-2.5 text-center text-xs font-bold text-primary">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Next round starting in {remaining}s...</span>
            </div>
          )}
          {phase === "active" && locked && !lockUp && !lockDown && myOrders.length === 0 && (
            <p className="text-center text-xs font-medium text-down">
              Round Locked · Resolving in {remaining}s
            </p>
          )}
        </section>
      </div>

      {/* LOWER SECTION: P2P Live Activity & Your PnL */}
      <section className="mt-6 grid gap-5 md:grid-cols-2">
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-border/40 pb-3">
            <h3 className="text-sm font-bold">Your Positions & PnL</h3>
            <span
              className={cn(
                "font-mono text-xs font-bold",
                pnl >= 0 ? "text-up" : "text-down",
              )}
            >
              {pnl >= 0 ? `+${fmtKES(pnl, 2)}` : `-${fmtKES(Math.abs(pnl), 2)}`}
            </span>
          </div>
          <div className="mt-3 divide-y divide-border/40 text-xs">
            {settled.length === 0 && (
              <p className="py-4 text-center text-muted-foreground">No settled positions yet this session.</p>
            )}
            {settled.slice(0, 6).map((p) => (
              <div key={p.id} className="flex items-center justify-between py-2.5">
                <div>
                  <span className={cn("font-bold", p.outcome === "UP" ? "text-up" : "text-down")}>
                    {p.outcome}
                  </span>
                  <span className="ml-2 text-muted-foreground">Round #{p.round ?? "—"}</span>
                </div>
                <span
                  className={cn(
                    "font-mono font-bold",
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

        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-border/40 pb-3">
            <h3 className="text-sm font-bold">Live P2P Activity</h3>
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-up" />
              Realtime
            </span>
          </div>
          <div className="mt-3 divide-y divide-border/40 text-xs">
            {history.length === 0 && (
              <p className="py-4 text-center text-muted-foreground">Live orders and settlements appear here.</p>
            )}
            {history.slice(0, 6).map((h) => (
              <div key={h.round} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded font-bold text-[10px]",
                      h.dir === "up" ? "bg-up/20 text-up" : "bg-down/20 text-down",
                    )}
                  >
                    {h.dir === "up" ? "▲" : "▼"}
                  </span>
                  <span>
                    Round #{h.round % 10000} settled <strong className={h.dir === "up" ? "text-up" : "text-down"}>{h.dir.toUpperCase()}</strong>
                  </span>
                </div>
                <span className="font-mono text-muted-foreground">
                  {fmtPrice(h.settle, asset.decimals)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MARKET RULES & CONTEXT */}
      <section className="mt-5 rounded-2xl border bg-card p-4 shadow-sm">
        <h3 className="text-sm font-bold">Market Rules & Context</h3>
        <div className="mt-3 divide-y divide-border/40 text-xs text-muted-foreground">
          <div className="py-2.5">
            <p className="font-semibold text-foreground">Oracle Price Source</p>
            <p className="mt-1">
              Resolves directly via the official Binance WebSocket feed for {asset.sym}/USDT. The lock price is recorded at round start, and the last observed tick at round end determines the outcome.
            </p>
          </div>
          <div className="py-2.5">
            <p className="font-semibold text-foreground">Anti-Sniping Lock Window</p>
            <p className="mt-1">
              Trading freezes {FLASH_LOCK_WINDOW_SECONDS} seconds before the round terminates to prevent millisecond sniping. Multipliers freeze into final fixed settlement odds.
            </p>
          </div>
          <div className="py-2.5">
            <p className="font-semibold text-foreground">Parimutuel Fair Multipliers</p>
            <p className="mt-1">
              Multipliers are balanced dynamically based on live liquidity and pool sentiment after a {Math.round(rakePct * 100)}% platform rake.
            </p>
          </div>
        </div>
      </section>

      {/* FLASH FAQS */}
      <section className="mt-5 rounded-2xl border bg-card p-4 shadow-sm">
        <h3 className="text-sm font-bold">Frequently Asked Questions</h3>
        <div className="mt-3 divide-y divide-border/40 text-xs">
          {[
            [
              "How does a round settle?",
              "Each round records a target lock price at 00:00. If the closing price is at or above the lock, UP wins; if below, DOWN wins.",
            ],
            [
              "What happens if Binance WebSocket feed drops?",
              "If the live feed drops mid-round, the round is voided automatically and 100% of all stakes are immediately refunded to your wallet.",
            ],
            [
              "How do I withdraw winnings?",
              "Winnings credit your Polka wallet balance instantly upon resolution. You can cash out anytime via M-Pesa B2C.",
            ],
          ].map(([q, a]) => (
            <details key={q} className="group py-2.5">
              <summary className="cursor-pointer list-none font-medium text-foreground hover:text-primary">
                {q}
              </summary>
              <p className="mt-1 text-muted-foreground">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* MOBILE STICKY SETTLEMENT & BETTING BAR */}
      {mobile && (
        <div className="fixed inset-x-0 bottom-[calc(57px+env(safe-area-inset-bottom))] z-40 space-y-2 border-t bg-background/95 p-2.5 backdrop-blur shadow-lg md:hidden">
          {/* Determining Winner Loader */}
          {isDetermining && (
            <div className="flex items-center justify-between rounded-xl bg-primary/10 px-3 py-2 text-primary border border-primary/20">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-xs font-bold">Hold on, determining winner...</span>
              </div>
              <Btn3D
                variant="up"
                disabled={buyDisabled || lockUp}
                onClick={() => place("up")}
                className="h-8 px-3 text-xs font-bold"
              >
                ▲ UP
              </Btn3D>
            </div>
          )}

         {phase === "next" && lastOutcome && (
  <div className="flex items-center justify-center rounded-xl border border-border bg-secondary px-3 py-2">
    <span className="text-xs font-bold">
      Outcome:{" "}
      <span className={cn(lastOutcome === "up" ? "text-up" : "text-down")}>
        {lastOutcome.toUpperCase()}
      </span>
    </span>
  </div>
)}

          {/* Regular Mobile Betting Controls */}
          {!isDetermining && !resolution && (
            <>
              {(lockUp || lockDown) && (
                <p className="rounded-md bg-down/15 py-1 text-center text-[10px] font-semibold text-down">
                  Max Liability Reached · Market Locked
                </p>
              )}
              {locked && !lockUp && !lockDown && (
                <p className="num text-center text-xs font-semibold text-down">
                  Round Locked · Resolving in {remaining}s
                </p>
              )}
              <div className="grid grid-cols-4 gap-1.5">
                {[50, 100, 250, 500].map((c) => (
                  <button
                    key={c}
                    onClick={() => setStake(c)}
                    className={cn(
                      "rounded-lg border py-1 font-mono text-[11px] font-bold transition",
                      stake === c ? "border-primary bg-primary/15 text-primary" : "bg-secondary text-foreground",
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 pt-0.5">
                <Btn3D
                  variant="up"
                  disabled={buyDisabled || lockUp}
                  onClick={() => place("up")}
                  className="h-12 flex-col gap-0 rounded-xl"
                >
                  <span className="text-xs font-bold">▲ UP</span>
                  <span className="font-mono text-xs font-extrabold">{multUp.toFixed(2)}x</span>
                </Btn3D>
                <Btn3D
                  variant="down"
                  disabled={buyDisabled || lockDown}
                  onClick={() => place("down")}
                  className="h-12 flex-col gap-0 rounded-xl"
                >
                  <span className="text-xs font-bold">▼ DOWN</span>
                  <span className="font-mono text-xs font-extrabold">{multDown.toFixed(2)}x</span>
                </Btn3D>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
