import { useEffect, useState, type ReactNode } from "react";
import { Lock, TrendingDown, TrendingUp, Zap } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { fireConfetti } from "@/lib/confetti";
import { cn } from "@/lib/utils";
import { Logo } from "./ui";

type Step = { title: string; body: string; art: ReactNode };

function Gauge({ v }: { v: number }) {
  const a = (v / 100) * Math.PI;
  const x = 20 - 16 * Math.cos(a);
  const y = 20 - 16 * Math.sin(a);
  return (
    <svg viewBox="0 0 40 22" className="h-7 w-12">
      <path d="M4 20 A16 16 0 0 1 36 20" fill="none" stroke="var(--border)" strokeWidth={4} strokeLinecap="round" />
      <path d={`M4 20 A16 16 0 0 1 ${x} ${y}`} fill="none" stroke="var(--up)" strokeWidth={4} strokeLinecap="round" />
    </svg>
  );
}

function MiniMarket({ faded, className }: { faded?: boolean; className?: string }) {
  return (
    <div className={cn("w-60 rounded-2xl border bg-card p-3 shadow-lg", faded && "opacity-30 blur-[0.5px]", className)}>
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-up/15 text-sm font-bold text-up">K</span>
        <p className="flex-1 text-xs font-semibold leading-tight">Will CBK cut the rate in December?</p>
        <div className="text-center">
          <Gauge v={50} />
          <p className="num -mt-1 text-[11px] font-bold">50%</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <span className="rounded-lg bg-up py-1.5 text-center text-xs font-bold text-primary-foreground">Yes</span>
        <span className="rounded-lg bg-muted py-1.5 text-center text-xs font-bold text-muted-foreground">No</span>
      </div>
    </div>
  );
}

function Ticket({ amt, win, side, className }: { amt: string; win: string; side: "yes" | "no"; className?: string }) {
  return (
    <div className={cn("w-44 rounded-2xl border bg-card p-3 text-center shadow-xl", className)}>
      <p className="num text-2xl font-black">{amt}</p>
      <p className="text-[11px] text-muted-foreground">
        To win <b className="text-up">{win}</b>
      </p>
      <span
        className={cn(
          "mt-2 block rounded-lg py-1.5 text-xs font-bold text-primary-foreground",
          side === "yes" ? "bg-up" : "bg-down",
        )}
      >
        Buy {side === "yes" ? "Yes" : "No"}
      </span>
    </div>
  );
}

function Slip({ title, value, label }: { title: string; value: string; label: string }) {
  return (
    <div className="relative w-64 rounded-2xl border bg-card p-4 shadow-xl">
      <p className="text-sm font-semibold leading-tight">{title}</p>
      <div className="mt-3 space-y-2 text-xs text-muted-foreground">
        <div className="flex justify-between"><span>Odds</span><span className="h-3 w-16 rounded bg-muted" /></div>
        <div className="flex justify-between"><span>Stake</span><span className="h-3 w-16 rounded bg-muted" /></div>
      </div>
      <div className="mt-3 flex items-baseline justify-between">
        <span className="text-sm font-semibold">{label}</span>
        <span className="num text-2xl font-black text-up">{value}</span>
      </div>
      <span className="mt-3 block rounded-lg bg-primary py-1.5 text-center text-xs font-bold text-primary-foreground">
        Cash out to M-Pesa
      </span>
      <span className="pointer-events-none absolute bottom-2 right-3 opacity-15 grayscale"><Logo size={14} /></span>
    </div>
  );
}

function Dots() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: 26 }, (_, i) => (
        <span
          key={i}
          className={cn("absolute h-1 w-2.5 rounded-sm", i % 3 === 0 ? "bg-up" : i % 3 === 1 ? "bg-primary" : "bg-chart-4")}
          style={{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 100}%`, transform: `rotate(${i * 29}deg)`, opacity: 0.6 }}
        />
      ))}
    </div>
  );
}

const homeSteps: Step[] = [
  {
    title: "1. Choose a Market",
    body: "Buy 'Yes' or 'No' shares based on what you honestly think will happen. Prices move in real time as other traders trade.",
    art: (
      <div className="relative grid h-full place-items-center">
        <MiniMarket faded className="absolute -left-16 top-2 -rotate-6" />
        <MiniMarket faded className="absolute -right-16 bottom-2 -rotate-6" />
        <MiniMarket className="relative -rotate-3" />
      </div>
    ),
  },
  {
    title: "2. Make Your Trade",
    body: "Add funds instantly via M-Pesa (card and crypto coming soon), then choose your position. Trade on real-world events with full transparency.",
    art: (
      <div className="relative grid h-full place-items-center">
        <Ticket amt="KES 100" win="KES 133" side="no" className="absolute right-[12%] top-6 rotate-3" />
        <Ticket amt="KES 100" win="KES 400" side="yes" className="absolute left-[12%] bottom-6 -rotate-2" />
      </div>
    ),
  },
  {
    title: "3. Cash Out 🤑",
    body: "When the market settles, the total prize pool is shared proportionally among winning shares using our parimutuel pool. Start predicting in minutes.",
    art: (
      <div className="relative grid h-full place-items-center">
        <Dots />
        <Slip title="Will CBK cut the rate in December?" value="KES 250" label="To win" />
      </div>
    ),
  },
];

const flashSteps: Step[] = [
  {
    title: "1. Pick Direction",
    body: "Predict if BTC or another crypto will settle ABOVE or BELOW the lock price in 60 seconds. Tap Up or Down to pick your side.",
    art: (
      <div className="grid h-full place-items-center">
        <div className="w-64 rounded-2xl border bg-card p-4 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold">BTC / USD</span>
            <span className="flex items-center gap-1 text-[11px] font-semibold text-up"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-up" />Live</span>
          </div>
          <p className="num mt-1 text-2xl font-black">$108,214.50</p>
          <svg viewBox="0 0 100 30" className="mt-1 h-10 w-full"><polyline fill="none" stroke="var(--up)" strokeWidth={2} points="0,22 12,20 24,24 36,15 48,17 60,10 72,13 84,6 100,8" /></svg>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <span className="flex items-center justify-center gap-1 rounded-lg bg-up py-2 text-xs font-bold text-primary-foreground"><TrendingUp className="h-3.5 w-3.5" />Up 1.84x</span>
            <span className="flex items-center justify-center gap-1 rounded-lg bg-down py-2 text-xs font-bold text-primary-foreground"><TrendingDown className="h-3.5 w-3.5" />Down 1.84x</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    title: "2. 20-Second Lock",
    body: "Trades lock at 20s remaining to prevent late snipers — your payout multiplier locks in at the moment you trade.",
    art: (
      <div className="grid h-full place-items-center">
        <div className="w-64 space-y-3 rounded-2xl border bg-card p-4 shadow-xl">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Est. multiplier</span>
            <span className="num font-bold"><span className="text-up">Up 1.03x</span> · <span className="text-down">Down 3.10x</span></span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full w-2/3 rounded-full bg-primary" /></div>
          <div className="flex items-center justify-center gap-2 rounded-lg border border-chart-4/40 bg-chart-4/10 py-2 text-xs font-semibold text-chart-4">
            <Lock className="h-3.5 w-3.5" /> Round Locked · Resolving in 20s
          </div>
        </div>
      </div>
    ),
  },
  {
    title: "3. Instant Payout ⚡",
    body: "Win up to 2x+ your stake with 0% hidden fees, credited to your wallet immediately when the round settles.",
    art: (
      <div className="relative grid h-full place-items-center">
        <Dots />
        <div className="relative w-64 rounded-2xl border border-up/40 bg-card p-4 text-center shadow-xl">
          <Zap className="mx-auto h-6 w-6 text-up" />
          <p className="mt-1 text-xs text-muted-foreground">You made a profit</p>
          <p className="num text-3xl font-black text-up">+KES 84.00</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Round #2841 · Up @ 1.84x</p>
        </div>
      </div>
    ),
  },
];

/** First-visit 3-step tutorial: bottom drawer on phones, floating card on desktop. */
export function Tutorial({ variant, forceOpen = false }: { variant: "home" | "flash"; forceOpen?: boolean }) {
  const key = variant === "flash" ? "polka-seen-flash-tutorial" : `polka_onboarded_${variant}`;
  const steps = variant === "home" ? homeSteps : flashSteps;
  const mobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!forceOpen && localStorage.getItem(key)) return undefined;
    const t = window.setTimeout(() => setOpen(true), 700);
    return () => window.clearTimeout(t);
  }, [key, forceOpen]);
  const close = () => {
    localStorage.setItem(key, "1");
    setOpen(false);
  };
  const next = () => {
    if (i < steps.length - 1) {
      setI(i + 1);
      if (i + 1 === steps.length - 1) fireConfetti(60);
    } else close();
  };
  const s = steps[i]!;
  const body = (
    <div className="flex flex-col">
      <div className="relative h-64 overflow-hidden bg-secondary/40 md:rounded-t-2xl">{s.art}</div>
      <div className="mt-4 flex justify-center gap-2">
        {steps.map((_, k) => (
          <button
            key={k}
            aria-label={`Step ${k + 1}`}
            onClick={() => setI(k)}
            className={cn("h-1.5 w-10 rounded-full transition-colors", k === i ? "bg-primary" : "bg-primary/20")}
          />
        ))}
      </div>
      <div className="space-y-2 px-5 pt-5">
        <h2 className="text-2xl font-bold tracking-tight">{s.title}</h2>
        <p className="min-h-[72px] text-sm leading-relaxed text-muted-foreground">{s.body}</p>
      </div>
      <div className="px-5 pb-5 pt-3">
        <button
          onClick={next}
          className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground transition-transform active:scale-[0.98]"
        >
          {i < steps.length - 1 ? "Next" : variant === "home" ? "Get Started" : "Got it, let's trade"}
        </button>
      </div>
    </div>
  );
  const title = variant === "home" ? "Welcome to Polka" : "How 60s Flash works";
  if (mobile)
    return (
      <Drawer open={open} onOpenChange={(o) => !o && close()}>
        <DrawerContent className="p-0">
          <DrawerTitle className="sr-only">{title}</DrawerTitle>
          <DrawerDescription className="sr-only">Three-step introduction</DrawerDescription>
          {body}
        </DrawerContent>
      </Drawer>
    );
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-md overflow-hidden p-0">
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">Three-step introduction</DialogDescription>
        {body}
      </DialogContent>
    </Dialog>
  );
}
