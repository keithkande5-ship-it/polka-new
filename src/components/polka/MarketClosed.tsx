import { Gavel, Lock } from "lucide-react";
import type { Market } from "@/lib/markets";
import { closedMarketLabel, outcomeTone } from "@/lib/market-presentation";
import { cn } from "@/lib/utils";

export function MarketClosed({ m, className }: { m: Market; className?: string }) {
  const idx = m.outcomes.findIndex((o) => o.label === m.finalOutcome);
  return (
    <div className={cn("space-y-2 rounded-lg border bg-muted/40 p-3 text-sm", className)}>
      <p className="flex items-center gap-2 font-semibold">
        <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />{closedMarketLabel(m)}
      </p>
      {m.state === "settled" && idx >= 0 && (
        <p className={cn("flex items-center gap-2 font-bold", `outcome-${outcomeTone(m, idx, true)}`)}>
          <Gavel className="h-4 w-4 shrink-0" />{m.finalOutcome} · Winner
        </p>
      )}
      <p className="text-[11px] text-muted-foreground">
        {m.state === "settled" ? "Settled" : "Awaiting final resolution"}
      </p>
    </div>
  );
}