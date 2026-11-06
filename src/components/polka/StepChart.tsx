import { useHydrated } from "@tanstack/react-router";
import { Skeleton } from "@/components/ui/skeleton";
import { useMemo, useState, useId } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Point } from "@/lib/markets";
import { useIsMobile } from "@/hooks/use-mobile";
import { Btn3D } from "./ui";
import { cn } from "@/lib/utils";
import { autoScaleDomain, FRAME_TICK_MS } from "@/lib/trading-rules";

const frames = {
  "1H": 3600000,
  "1D": 86400000,
  "1W": 604800000,
  "1M": 2592000000,
  ALL: Infinity,
} as const;
type Frame = keyof typeof frames;

const tickFmt = (frame: Frame) => (t: number) => {
  const d = new Date(t);
  if (frame === "1H" || frame === "1D")
    return d.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit", hour12: false });
  return d.toLocaleDateString("en-KE", { month: "short", day: "numeric" });
};

export type OutcomeOption = { id: string; label: string };

export function StepChart({
  data,
  color = "var(--up)",
  height = 280,
  showFrames = true,
  valueFormat = (v: number) => `${Math.round(v * 100)}%`,
  domain = [0, 1],
  lines = [],
  liveProb,
  status,
  onRetry,
  outcomes,
  activeOutcome,
  onOutcome,
  mainLabel,
}: {
  data: Point[];
  color?: string;
  height?: number;
  showFrames?: boolean;
  valueFormat?: (v: number) => string;
  domain?: [number, number] | ["auto", "auto"];
  lines?: { label: string; data: Point[]; color: string }[];
  liveProb?: number | undefined;
  status?: "live" | "stale" | "offline" | undefined;
  onRetry?: () => void;
  /** Outcome selector rendered after the timeframe picker. */
  outcomes?: OutcomeOption[];
  activeOutcome?: string;
  onOutcome?: (id: string) => void;
  mainLabel?: string;
}) {
  const [frame, setFrame] = useState<Frame>("1M");
  const hydrated = useHydrated();
  const id = useId().replace(/:/g, "");
  const mobile = useIsMobile();
  const probability = domain[0] === 0 && domain[1] === 1;

  const sliced = useMemo(() => {
    const last = data.at(-1);
    if (!last) return [];
    const nowMs = Date.now();
    // 1H is anchored to the present; macro frames anchor to the latest trade.
    const anchor = frame === "1H" ? Math.max(nowMs, last.t) : last.t;
    const cutoff = anchor - frames[frame];
    let rows = data.filter((p) => p.t >= cutoff);
    if (rows.length < 2) {
      const prev = data.filter((p) => p.t < cutoff).at(-1) ?? last;
      rows = [{ ...prev, t: cutoff }, ...(rows.length ? rows : [last])];
    }
    // Append the live probability as the newest step so trades show instantly.
    if (liveProb !== undefined && Math.abs((rows.at(-1)?.p ?? 0) - liveProb) > 1e-9) {
      rows = [...rows, { t: nowMs, p: liveProb }];
    }
    // Option 1 continuity: 1H always runs to now; other frames only when the
    // last trade is recent (<30 min), so quiet markets don't show a flat desert.
    const tail = rows.at(-1);
    if (tail && tail.t < nowMs && (frame === "1H" || nowMs - tail.t < 30 * 60_000)) {
      rows = [...rows, { ...tail, t: nowMs }];
    }
    const n = lines.length + 1;
    const stepAt = (d: { t: number; p: number }[], t: number) => {
      let v = d[0]?.p ?? 0;
      for (const x of d) { if (x.t <= t) v = x.p; else break; }
      return v;
    };
    return rows.map((p, i) => {
      const vals: number[] = [p.p ?? 0, ...lines.map((l) => stepAt(l.data, p.t))];
      if (probability && i === 0) vals.fill(lines.length ? 1 / n : 0.5);
      else if (probability && lines.length) {
        const sum = vals.reduce((a, b) => a + Math.max(0, b), 0);
        if (sum > 0) for (let k = 0; k < vals.length; k++) vals[k] = Math.max(0, vals[k] ?? 0) / sum;
      }
      return {
        ...p,
        p: Math.min(1, Math.max(0, vals[0] ?? 0)),
        ...Object.fromEntries(lines.map((_, j) => [`line${j}`, vals[j + 1]])),
      };
    });
  }, [data, frame, probability, lines, liveProb]);

  const current = sliced.at(-1)?.p ?? 0;
  const scaled = useMemo(() => {
    if (!probability) return null;
    const vals: number[] = [];
    for (const r of sliced as Record<string, number>[])
      for (const [k, v] of Object.entries(r)) if (k === "p" || k.startsWith("line")) vals.push(v);
    return autoScaleDomain(vals);
  }, [sliced, probability]);
  const xTicks = useMemo(() => {
    const step = frame === "ALL" ? 0 : FRAME_TICK_MS[frame];
    const a = sliced[0]?.t, b = sliced.at(-1)?.t;
    if (!step || a === undefined || b === undefined) return undefined;
    const out: number[] = [];
    for (let t = Math.ceil(a / step) * step; t <= b; t += step) out.push(t);
    return out.length >= 2 ? out : undefined;
  }, [sliced, frame]);
  const stroke = probability ? color : current >= 0 ? "var(--up)" : "var(--down)";
  const tickStyle = {
    fill: "var(--muted-foreground)",
    fontSize: 10,
    fontFamily: "var(--font-sans)",
    fontVariantNumeric: "tabular-nums",
  };
  const dropdown = mobile && (outcomes?.length ?? 0) > 2;

  return (
    <div className="min-w-0">
      {lines.length > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-4 rounded-full" style={{ background: color }} />
            <span className="font-semibold">{mainLabel ?? "Selected outcome"}</span>
          </span>
          {lines.map((l) => (
            <span key={l.label} className="flex items-center gap-1.5 text-muted-foreground">
              <span className="h-1.5 w-4 rounded-full" style={{ background: l.color }} />
              <span>{l.label}</span>
            </span>
          ))}
        </div>
      )}
      {status && (
        <div className="mb-1 flex justify-end">
          <div className="flex items-center gap-1.5 rounded-full border bg-background/85 px-2 py-0.5 text-[11px] font-medium backdrop-blur">
            <span
              className={
                status === "live"
                  ? "h-1.5 w-1.5 animate-pulse rounded-full bg-up"
                  : status === "stale"
                    ? "h-1.5 w-1.5 rounded-full bg-chart-4"
                    : "h-1.5 w-1.5 rounded-full bg-down"
              }
            />
            {status === "live" ? "Live" : status === "stale" ? "Reconnecting" : "Disconnected"}
            {status === "offline" && onRetry && (
              <button
                onClick={onRetry}
                className="pointer-events-auto rounded border px-1 font-semibold text-foreground"
              >
                Retry
              </button>
            )}
          </div>
          </div>
      )}
      <div
        key={frame}
        className="chart-draw relative h-[280px] min-h-[280px] w-full"
        style={height > 280 ? { height } : undefined}
      >
        <ChartWatermark className="bottom-8 left-12 right-auto" />
        {!hydrated && <Skeleton className="absolute inset-0 rounded-lg" aria-label="Loading chart" />}
        {hydrated && <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={sliced}
            margin={{ top: 12, right: mobile ? 0 : 8, bottom: 0, left: 0 }}
          >
            <defs>
              <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={stroke} stopOpacity={0.25} />
                <stop offset="100%" stopColor={stroke} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              domain={["dataMin", "dataMax"]}
              tickFormatter={tickFmt(frame)}
              {...(xTicks ? { ticks: xTicks } : {})}
              tick={tickStyle}
              axisLine={false}
              tickLine={false}
              minTickGap={48}
              height={22}
            />
            <YAxis
              orientation="right"
              domain={scaled ? scaled.domain : domain}
              allowDataOverflow
              width={probability ? (mobile ? 34 : 44) : mobile ? 64 : 72}
              {...(scaled ? { ticks: scaled.ticks } : {})}
              tickFormatter={valueFormat}
              tick={tickStyle}
              axisLine={false}
              tickLine={false}
            />
            {probability &&
              [0, 0.25, 0.5, 0.75, 1].map((v) => (
                <ReferenceLine key={v} y={v} stroke="var(--border)" strokeDasharray="2 4" />
              ))}
            {!probability && (
              <Area
                type="monotone"
                dataKey="p"
                baseValue={0}
                fill={`url(#${id})`}
                stroke="none"
                isAnimationActive={false}
              />
            )}
            <Tooltip
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <div className="rounded border bg-popover px-3 py-2 text-xs">
                    {payload.map((p, i) => (
                      <p key={i} className="num">
                        {p.name}: {valueFormat(Number(p.value))}
                      </p>
                    ))}
                  </div>
                ) : null
              }
            />
            <Line
              type={probability ? "stepAfter" : "monotone"}
              name={mainLabel ?? (lines.length ? "Selected outcome" : "Value")}
              dataKey="p"
              stroke={stroke}
              strokeWidth={2}
              isAnimationActive={false}
              dot={({ cx, cy, index }: { cx?: number; cy?: number; index?: number }) =>
                index === sliced.length - 1 ? (
                  <g>
                    <circle cx={cx} cy={cy} r={3} fill={stroke} />
                    <circle
                      cx={cx}
                      cy={cy}
                      r={6}
                      stroke={stroke}
                      fill="none"
                      className="radar-dot"
                    />
                  </g>
                ) : (
                  <g />
                )
              }
            />
            {lines.map((l, i) => (
              <Line
                key={l.label}
                name={l.label}
                dataKey={`line${i}`}
                stroke={l.color}
                strokeWidth={2}
                dot={({ cx, cy, index }: { cx?: number; cy?: number; index?: number }) =>
                  index === sliced.length - 1 ? (
                    <g>
                      <circle cx={cx} cy={cy} r={3} fill={l.color} />
                      <circle cx={cx} cy={cy} r={6} stroke={l.color} fill="none" className="radar-dot" />
                    </g>
                  ) : (
                    <g />
                  )
                }
                type="stepAfter"
                isAnimationActive={false}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>}
      </div>
      {(showFrames || (outcomes && onOutcome)) && (
        <div className="mt-3 flex flex-wrap items-center gap-1">
          {showFrames &&
            (Object.keys(frames) as Frame[]).map((f) => (
              <Btn3D
                key={f}
                variant={frame === f ? "primary" : "surface"}
                onClick={() => setFrame(f)}
                className="num h-8 px-3 text-xs"
              >
                {f}
              </Btn3D>
            ))}
          {outcomes && onOutcome && (
            <>
              <span className="ml-auto hidden text-[11px] text-muted-foreground sm:inline">
                Outcome graph
              </span>
              {dropdown ? (
                <select
                  aria-label="Outcome graph"
                  value={activeOutcome}
                  onChange={(e) => onOutcome(e.target.value)}
                  className="ml-auto h-8 max-w-[45vw] rounded-lg bg-secondary px-2 text-xs font-semibold outline-none"
                >
                  <option value="all">All outcomes</option>
                  {outcomes.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="ml-auto flex gap-1">
                  <Btn3D
                    variant={activeOutcome === "all" ? "primary" : "surface"}
                    onClick={() => onOutcome("all")}
                    className="num h-8 px-2.5 text-xs"
                  >
                    All
                  </Btn3D>
                  {outcomes.map((o) => (
                    <Btn3D
                      key={o.id}
                      variant={activeOutcome === o.id ? "primary" : "surface"}
                      onClick={() => onOutcome(o.id)}
                      className={cn("h-8 max-w-28 truncate px-2.5 text-xs")}
                    >
                      {o.label}
                    </Btn3D>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Subdued brand mark for chart canvases and cards, so screenshots carry the Polka name. */
export function ChartWatermark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute bottom-2 right-3 z-0 select-none text-xs font-semibold uppercase tracking-wider text-muted-foreground opacity-20",
        className,
      )}
    >
      Polka
    </span>
  );
}
