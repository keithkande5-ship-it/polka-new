import { Gavel, TrendingUp, TrendingDown } from "lucide-react";
import { fmtPrice } from "@/lib/crypto";
import { fmtKES } from "@/lib/markets";
import { cn } from "@/lib/utils";

export type FlashResolutionData = {
  round: number; dir: "up" | "down"; lock: number; settle: number;
  stake: number; returned: number; orders: number;
};

export function FlashResolution({ result, decimals }: { result: FlashResolutionData; decimals: number }) {
  const up = result.dir === "up";
  const Icon = up ? TrendingUp : TrendingDown;
  const net = result.returned - result.stake;
  return (
    <div role="status" aria-live="polite" className={cn("flash-resolution absolute inset-0 z-20 flex flex-col justify-center rounded-lg border bg-background/95 p-4 backdrop-blur-sm", up ? "border-up/50" : "border-down/50")}>
      <div className="flex items-center justify-center gap-3">
        <Gavel className={cn("resolution-gavel h-8 w-8 shrink-0", up ? "text-up" : "text-down")} />
        <div><p className="num text-xs text-muted-foreground">Round #{result.round % 10000} · Resolved</p>
          <p className={cn("flex items-center gap-2 text-3xl font-bold", up ? "text-up" : "text-down")}><Icon className="h-7 w-7" />{result.dir.toUpperCase()}</p>
        </div>
      </div>
      <dl className="num mt-5 grid grid-cols-2 gap-2 text-center text-sm">
        <div className="min-w-0"><dt className="text-xs text-muted-foreground">Strike price</dt><dd className="mt-1 break-all font-semibold">{fmtPrice(result.lock, decimals)}</dd></div>
        <div className="min-w-0"><dt className="text-xs text-muted-foreground">Close price</dt><dd className="mt-1 break-all font-semibold">{fmtPrice(result.settle, decimals)}</dd></div>
      </dl>
      {result.orders > 0 && <div className="num mt-4 border-t pt-3 text-center text-sm">
        <p>Returned <b>{fmtKES(result.returned, 2)}</b> · Stake {fmtKES(result.stake, 2)}</p>
        <p className={cn("mt-1 font-bold", net >= 0 ? "text-up" : "text-down")}>{net >= 0 ? "+" : "−"}{fmtKES(Math.abs(net), 2)} net</p>
      </div>}
      <p className="mt-3 text-center text-[11px] text-muted-foreground">Round settled · Next round is counting down</p>
    </div>
  );
}