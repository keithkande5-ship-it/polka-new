import { useEffect, useRef, useState } from "react";

export type Asset = {
  sym: string;
  name: string;
  binance?: string;
  seed: number;
  decimals: number;
  local?: boolean;
};

export const assets: Asset[] = [
  { sym: "BTC", name: "Bitcoin", binance: "btcusdt", seed: 108_000, decimals: 2 },
  { sym: "ETH", name: "Ethereum", binance: "ethusdt", seed: 3_900, decimals: 2 },
  { sym: "SOL", name: "Solana", binance: "solusdt", seed: 185, decimals: 3 },
  { sym: "BNB", name: "BNB", binance: "bnbusdt", seed: 1_100, decimals: 2 },
  { sym: "XRP", name: "XRP", binance: "xrpusdt", seed: 2.4, decimals: 4 },
  { sym: "USD/KES", name: "Dollar vs Shilling", seed: 129.2, decimals: 3, local: true },
  { sym: "SCOM", name: "Safaricom (NSE)", seed: 22.4, decimals: 3, local: true },
];

/** live = fresh ticks, stale = reconnecting, offline = gave up until retry. */
export type FeedStatus = "live" | "stale" | "offline";

export type Tick = { t: number; p: number };

/** Seeded preview history; live samples are throttled to four per second. */
export function useLivePrice(asset: Asset) {
  const seedSeries = (center: number): Tick[] => {
    const now = Date.now();
    // ~3 minutes of seeded preview so previous rounds are visible on open.
    return Array.from({ length: 180 }, (_, i) => ({
      t: now - (179 - i) * 1000,
      p: center * (1 + (Math.sin(i * 0.21) * 0.6 + Math.sin(i * 0.83) * 0.3 + Math.sin(i * 2.1) * 0.1) * 0.0004),
    }));
  };
  const [price, setPrice] = useState<number | null>(asset.seed);
  const [live, setLive] = useState(false);
  const [series, setSeries] = useState<Tick[]>(() => seedSeries(asset.seed));
  const [status, setStatus] = useState<FeedStatus>("stale");
  const [ready, setReady] = useState(!asset.binance);
  const retryRef = useRef<() => void>(() => {});
  useEffect(() => {
    let failures = 0;
    let disposed = false;
    let ws: WebSocket | null = null;
    let last = asset.seed;
    let pending: number | null = null;
    let lastMessage = 0;
    let nextRetry = 0;
    let firstLive = true;
    let ticks = seedSeries(asset.seed);
    setSeries(ticks);
    setPrice(asset.seed);
    setLive(false);
    setReady(!asset.binance);
    const push = (p: number) => {
      if (disposed || !Number.isFinite(p) || p <= 0) return;
      last = p;
      ticks = [...ticks.slice(-719), { t: Date.now(), p }];
      setPrice(p);
      setSeries(ticks);
    };
    const connect = () => {
      if (!asset.binance || disposed) return;
      try {
        ws = new WebSocket(`wss://stream.binance.com:9443/ws/${asset.binance}@trade`);
        ws.onmessage = (e) => {
          try {
            const p = Number(JSON.parse(e.data).p);
            if (!Number.isFinite(p) || p <= 0) return;
            if (firstLive) {
              ticks = seedSeries(p);
              firstLive = false;
            }
            pending = p;
            lastMessage = Date.now();
            failures = 0;
            setLive(true);
            setReady(true);
          } catch {
            /* Ignore malformed frames. */
          }
        };
        ws.onerror = () => {
          setLive(false);
          ws?.close();
        };
        ws.onclose = () => {
          if (disposed) return;
          setLive(false);
          ws = null;
          failures++;
          nextRetry = Date.now() + 5000;
        };
      } catch {
        failures++;
        nextRetry = Date.now() + 5000;
      }
    };
    connect();
    retryRef.current = () => {
      failures = 0;
      nextRetry = 0;
      setStatus("stale");
    };
    const timer = setInterval(() => {
      const now = Date.now();
      if (pending !== null) {
        push(pending);
        pending = null;
      } else if (now - lastMessage > 2000) {
        setLive(false);
        push(last * (1 + (Math.random() - 0.5) * 0.00006));
      }
      if (asset.binance && !ws && now >= nextRetry) connect();
      const offline = typeof navigator !== "undefined" && navigator.onLine === false;
      const st: FeedStatus = !asset.binance
        ? "live"
        : now - lastMessage < 2000
          ? "live"
          : offline || failures >= 3
            ? "offline"
            : "stale";
      // Synthetic/local feeds are coherent immediately; remote feeds expose the
      // UI only after the first live snapshot or a final fallback.
      if (!asset.binance || st === "offline") setReady(true);
      setStatus(st);
    }, 250);
    return () => {
      disposed = true;
      clearInterval(timer);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
  }, [asset]);
  return { price, live, series, status, ready, retry: () => retryRef.current() };
}

/** Ticks every 250ms; returns current 60s round and seconds remaining. Null until mounted. */
export function useRound() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const i = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(i);
  }, []);
  if (now === null) return { round: null as number | null, remaining: 60 };
  return { round: Math.floor(now / 60000), remaining: Math.ceil(60 - (now % 60000) / 1000) };
}

export function upProbability(price: number | null, lock: number | null) {
  if (!price || !lock) return 0.5;
  const drift = ((price - lock) / lock) * 400;
  return Math.min(0.92, Math.max(0.08, 0.5 + drift));
}

export function fmtPrice(p: number | null, decimals: number) {
  if (p === null) return "—";
  return p.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Browser connectivity for chart feeds: live while online, offline otherwise. */
export function useConnectionStatus() {
  const [status, setStatus] = useState<"live" | "offline">(() =>
    typeof navigator !== "undefined" && navigator.onLine === false ? "offline" : "live",
  );
  useEffect(() => {
    const up = () => setStatus("live");
    const down = () => setStatus("offline");
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);
  return {
    status,
    retry: () => setStatus(navigator.onLine ? "live" : "offline"),
  };
}
