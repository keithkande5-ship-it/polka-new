import { CheckCircle2, Loader2, WifiOff } from "lucide-react";
import { useSystemStatus } from "@/lib/net-status";
import { useAdmin } from "@/lib/admin";

/** Persistent incident strip above the global header, across every route. */
export function StatusBanner() {
  const { status, recovered } = useSystemStatus();
  const { alert } = useAdmin();
  if (status === "offline")
    return (
      <div
        role="status"
        className="flex items-center justify-center gap-2 bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground"
      >
        <WifiOff className="h-3.5 w-3.5" />
        No internet connection · Trading paused
      </div>
    );
  if (status === "unstable")
    return (
      <div
        role="status"
        aria-label="Reconnecting"
        title="Unstable network · reconnecting"
        className="fixed right-3 top-3 z-[60] grid h-8 w-8 place-items-center rounded-full border bg-background/80 shadow backdrop-blur"
      >
        <Loader2 className="h-4 w-4 animate-spin text-chart-4" />
      </div>
    );
  if (recovered)
    return (
      <div
        role="status"
        className="flex items-center justify-center gap-2 bg-up px-3 py-1.5 text-xs font-semibold text-up-foreground"
      >
        <CheckCircle2 className="h-3.5 w-3.5" />
        Connected · Feeds synced
      </div>
    );
  return alert ? <div role="status" className={`flex items-center justify-center px-4 py-2 text-xs font-semibold ${alert.tone === "red" ? "bg-destructive text-destructive-foreground" : "bg-chart-4/20 text-chart-4"}`}>{alert.text}</div> : null;
}
