import { Link, useRouterState } from "@tanstack/react-router";
import { Bell, Home, Search, Zap, LineChart, Trophy, Smartphone, Plus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useStore } from "@/lib/store";
import { fmtKES, getMarket, useMarketsVersion } from "@/lib/markets";
import { cn } from "@/lib/utils";
import { Avatar } from "./AccountUI";
import { Odometer } from "./Odometer";
import { Btn3D, Logo } from "./ui";

function OddsToggle() {
  const { oddsMode, setOddsMode } = useStore();
  return (
    <div className="flex rounded-lg bg-secondary p-0.5 text-xs font-semibold">
      {(["prob", "odds"] as const).map((m) => (
        <button
          key={m}
          onClick={() => setOddsMode(m)}
          className={cn(
            "num rounded-md px-2 py-1 transition-colors",
            oddsMode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground",
          )}
        >
          {m === "prob" ? "% Prob" : "x Mult"}
        </button>
      ))}
    </div>
  );
}

function MobileOddsToggle() {
  const { oddsMode, setOddsMode } = useStore();
  return <Btn3D aria-label={oddsMode === "prob" ? "Show multipliers" : "Show probabilities"} title="Odds display" onClick={() => setOddsMode(oddsMode === "prob" ? "odds" : "prob")} className="num h-8 w-8 px-0 text-xs sm:hidden">{oddsMode === "prob" ? "%" : "×"}</Btn3D>;
}

function Bellbox() {
  const { notifs, markAllRead } = useStore();
  const unread = notifs.filter((n) => !n.read).length;
  return (
    <Popover onOpenChange={(o) => !o && markAllRead()}>
      <PopoverTrigger asChild>
        <button
          aria-label="Notifications"
          className="relative grid h-9 w-9 place-items-center rounded-lg hover:bg-secondary"
        >
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="num absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b px-4 py-3 text-sm font-semibold">Notifications</div>
        <div className="max-h-96 overflow-y-auto">
          {notifs.map((n) => (
            <a
              key={n.id}
              href={n.href ?? "/portfolio"}
              className={cn("flex gap-3 border-b px-4 py-3 hover:bg-secondary/60", !n.read && "bg-primary/5")}
            >
              <div
                className={cn(
                  "grid h-8 w-8 shrink-0 place-items-center rounded-lg",
                  n.kind === "win"
                    ? "bg-up/15 text-up"
                    : n.kind === "mpesa"
                      ? "bg-mpesa/15 text-mpesa"
                      : "bg-secondary",
                )}
              >
                {n.kind === "win" ? (
                  <Trophy className="h-4 w-4" />
                ) : (
                  <Smartphone className="h-4 w-4" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{n.title}</p>
                <p className="num truncate text-xs text-muted-foreground">{n.body}</p>
              </div>
              <span className="text-[11px] text-muted-foreground">{n.ago}</span>
            </a>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

const nav = [
  { to: "/", label: "Markets", icon: Home },
  { to: "/search", label: "Search", icon: Search },
  { to: "/flash", label: "60s Flash", icon: Zap },
  { to: "/portfolio", label: "Portfolio", icon: LineChart },
] as const;

export function Header() {
  const { balance, openCashier, setProfileOpen, user, openAuth, positions } = useStore();
  useMarketsVersion();
  const openPositions = positions.filter((p) => p.status === "open");
  const openValue = openPositions.reduce(
    (a, p) =>
      a +
      p.stake *
        p.mult *
        (getMarket(p.marketId)?.outcomes.find((o) => o.label === p.outcome)?.prob ?? 1 / p.mult),
    0,
  );
  const openPnl = openValue - openPositions.reduce((a, p) => a + p.stake, 0);
  return (
    <header className="sticky top-0 z-40 h-14 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto grid h-14 max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 md:flex md:gap-3 md:px-6">
        <Link to="/" className="min-w-0 shrink-0" aria-label="Polka home">
          <Logo size={44} className="max-w-[100px] md:max-w-[120px]" />
        </Link>
        <nav className="ml-4 hidden items-center gap-1 md:flex">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: n.to === "/" }}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
              activeProps={{ className: "text-primary! bg-primary/10" }}
            >
              {n.label}
            </Link>
          ))}
          <Link
            to="/rewards"
            className="rounded-md px-3 py-1.5 text-sm font-semibold text-rewards hover:bg-rewards/10"
            activeProps={{ className: "bg-rewards/15 text-rewards" }}
          >
            Rewards
          </Link>
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-1.5 md:gap-2">
          <MobileOddsToggle />
          <div className="hidden sm:block">
            <OddsToggle />
          </div>
          {user ? (
            <>
              <Link to="/portfolio" className="hidden text-right text-xs lg:block">
                <span className="text-muted-foreground">Open Positions</span>
                <Odometer
                  value={openValue}
                  format={(v) => fmtKES(v, 2)}
                  className={cn(
                    "block",
                    openPnl > 0.01 ? "text-up" : openPnl < -0.01 ? "text-down" : "text-foreground",
                  )}
                />
              </Link>
              <button
                onClick={() => openCashier()}
                className="btn-3d flex h-9 items-center gap-1.5 rounded-lg bg-secondary pl-2.5 pr-1 text-sm font-semibold"
              >
                <Odometer value={balance} format={(v) => fmtKES(v)} />
                <span className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground">
                  <Plus className="h-4 w-4" />
                </span>
              </button>
              <Bellbox />
              <button
                aria-label="Account"
                onClick={() => setProfileOpen(true)}
                className="grid h-9 w-9 place-items-center rounded-full bg-primary/20 text-sm font-bold text-primary"
              >
                <Avatar handle={user.handle} preset={user.avatar} size="h-9 w-9" />
              </button>
            </>
          ) : (
            <>
              <Btn3D className="h-9 px-3 text-xs" onClick={() => openAuth("login")}>
                Log in
              </Btn3D>
              <Btn3D
                variant="primary"
                className="h-9 px-3 text-xs"
                onClick={() => openAuth("signup")}
              >
                Sign up
              </Btn3D>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function BottomNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { positions } = useStore();
  const openStake = positions
    .filter((p) => p.status === "open")
    .reduce((a, p) => a + p.stake, 0);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      {nav.map((n) => {
        const active =
          n.to === "/" ? path === "/" || path.startsWith("/market") : path.startsWith(n.to);
        return (
          <Link
            key={n.to}
            to={n.to}
            className={cn(
              "flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium",
              active ? "text-primary" : "text-muted-foreground",
            )}
          >
            {n.to === "/flash" ? (
              <span aria-hidden className="flex h-5 w-5 items-center text-sm">
                <span className="text-up">▲</span>
                <span className="text-down">▼</span>
              </span>
            ) : n.to === "/portfolio" && openStake > 0 ? (
              <span className="num grid h-5 place-items-center rounded-full bg-primary/15 px-2 text-[10px] font-bold text-primary">
                {fmtKES(openStake)}
              </span>
            ) : (
              <n.icon className="h-5 w-5" />
            )}
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
