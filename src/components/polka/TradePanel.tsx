import { getRake, safeQuote } from "@/lib/trading-rules";
import { Lock, Trophy } from "lucide-react";
import { toast } from "sonner";
import { fmtKES, fmtOutcome, payout, toMultiplier, useMarket, useNowTick } from "@/lib/markets";
import { useStore } from "@/lib/store";
import { Btn3D, Thumb } from "./ui";
import { Odometer } from "./Odometer";
import { canBuy, DEFAULT_EVENT_POT_RAKE_BPS, zeroFeeRemainingMs } from "@/lib/trading-rules";
import { cn } from "@/lib/utils";

const chips = [50, 100, 500, 1000];

/** After the mobile keyboard closes, snap the page and the slide-up back down. */
export function releaseKeyboard() {
  if (typeof window === "undefined") return;
  const reset = () => {
    window.scrollTo({ top: window.scrollY, behavior: "instant" as ScrollBehavior });
    document.querySelectorAll<HTMLElement>("[data-vaul-drawer]").forEach((el) => {
      el.style.removeProperty("bottom");
      el.style.removeProperty("height");
      el.style.removeProperty("transform");
    });
  };
  setTimeout(reset, 60);
  setTimeout(reset, 300);
}

export function TradePanel({
  marketId,
  outcomeId,
  onDone,
}: {
  marketId: string;
  outcomeId: string;
  onDone?: () => void;
}) {
  const m = useMarket(marketId);
  const { balance, addPosition, openCashier, oddsMode, openSlip, positions, user, openAuth } =
    useStore();
  const [sel, setSel] = useState(outcomeId);
  const [stake, setAmount] = useState(10);
  useEffect(() => setSel(outcomeId), [outcomeId]);
  const nowTick = useNowTick();
  const zeroLeft = zeroFeeRemainingMs(user, nowTick);

  if (!m) return <p>Market unavailable.</p>;
  const o = m.outcomes.find((x) => x.id === sel) ?? m.outcomes[0];
  if (!o) return <p>No outcomes available.</p>;
  const frozen = !!m.state && m.state !== "open";
  const blocked = !canBuy(positions, m.id, o.label);
  const idx = m.outcomes.indexOf(o);
  const binary = m.outcomes.length === 2;
  const quote = safeQuote(stake, o.prob, m.volume, getRake());
  const mult = stake > 0 ? quote.mult : toMultiplier(o.prob);
  const win = stake > 0 ? quote.payout : payout(stake, mult);
  const short = !!user && stake > balance;

  const place = () => {
    if (!user) return openAuth();
    if (frozen || stake <= 0 || stake > balance || blocked) return;
    if (!addPosition({ marketId: m.id, title: m.question, outcome: o.label, stake, mult })) return;
    toast.success(`Bought ${o.label} · ${fmtKES(stake)}`, {
      description: `Projected payout ${fmtKES(win, 2)} at ${mult.toFixed(2)}x`,
    });
    setAmount(10);
    onDone?.();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex min-w-0 items-center gap-3">
        {(() => {
          const sp = m.sport;
          const src = o.img ?? (sp ? (idx === 0 ? sp.homeCrest : idx === m.outcomes.length - 1 ? sp.awayCrest : undefined) : undefined);
          return src ? (
            <img key={src} src={src} alt={o.label} className="size-9 shrink-0 animate-in fade-in rounded-md object-contain" />
          ) : (
            <Thumb m={m} />
          );
        })()}
        <p className="line-clamp-2 text-sm font-medium">{m.question}</p>
      </div>

      <div className={cn("grid gap-2", m.outcomes.length === 3 ? "grid-cols-3" : "grid-cols-2")}>
        {m.outcomes.map((x, i) => {
          const active = x.id === o.id;
          const v = binary ? (i === 0 ? "up" : "down") : "primary";
          return (
            <Btn3D
              key={x.id}
              variant={active ? v : "surface"}
              onClick={() => {
                setSel(x.id);
                openSlip(m.id, x.id);
              }}
              className="h-11 flex-col gap-0 px-2 text-xs"
            >
              <span className="truncate">{x.label}</span>
              <span className="num text-sm font-bold">{fmtOutcome(x.prob, oddsMode)}</span>
            </Btn3D>
          );
        })}
      </div>

      {zeroLeft > 0 && (
        <div className="num flex items-center justify-between rounded-lg border border-up/40 bg-up/10 px-3 py-2 text-xs font-semibold text-up">
          <span>0% trading fees · first 24h</span>
          <span>
            {Math.floor(zeroLeft / 3_600_000)}h {Math.floor((zeroLeft % 3_600_000) / 60_000)}m left
          </span>
        </div>
      )}
      <div className="rounded-xl bg-muted p-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Amount</span>
          <button onClick={() => openCashier()} className="num hover:text-foreground">
            Bal {fmtKES(balance, 2)}
          </button>
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-lg font-semibold text-muted-foreground">KES</span>
          <input
            inputMode="numeric"
            enterKeyHint="done"
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            onBlur={releaseKeyboard}
            value={stake ? stake.toLocaleString("en-KE") : ""}
            placeholder="0"
            onChange={(e) =>
              setAmount(Math.min(1_000_000, Number(e.target.value.replace(/\D/g, "")) || 0))
            }
            className="num w-full min-w-0 bg-transparent text-4xl font-bold outline-none placeholder:text-muted-foreground/50"
          />
        </div>
        <div className="mt-3 grid grid-cols-5 gap-1.5">
          {(user?.quickAmounts ?? chips).map((c) => (
            <Btn3D key={c} onClick={() => setAmount((s) => s + c)} className="num h-8 px-0 text-xs">
              +{c.toLocaleString()}
            </Btn3D>
          ))}
          <Btn3D onClick={() => setAmount(Math.floor(balance))} className="h-8 px-0 text-xs">
            Max
          </Btn3D>
        </div>
      </div>

      <div className="space-y-1.5 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <span>Multiplier</span>
          <Odometer value={mult} format={(v) => `${v.toFixed(2)}x`} className="text-foreground" />
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span className="num">
            {fmtKES(stake)} × {mult.toFixed(2)}
          </span>
          <span>Estimated return</span>
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Platform Rake</span>
          <span>
            {zeroLeft > 0
              ? "0% · referral welcome bonus"
              : `${DEFAULT_EVENT_POT_RAKE_BPS / 100}% on losing pot upon settlement`}
          </span>
        </div>
        <div className="flex items-end justify-between border-t pt-2">
          <span className="font-medium">Projected payout</span>
          <Odometer
            value={win}
            format={(v) => fmtKES(v, 2)}
            className="text-2xl font-bold text-up"
          />
        </div>
      </div>

      {blocked && !frozen && (
        <p className="text-xs text-down">Opposing position already open. Hold until settlement.</p>
      )}
           {frozen ? (
        <div className="space-y-2.5">
          {m.state === "settled" || m.state === "resolved" ? (
            <div className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 p-3.5 text-sm font-bold text-emerald-400">
              <Trophy className="h-4 w-4 shrink-0 text-emerald-400" />
              <span>
                {m.finalOutcome
                  ? `${m.finalOutcome}: Won`
                  : m.outcomes.length === 2
                  ? `${m.outcomes[0]?.label}: Won`
                  : `${o.label}: Won`}
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 rounded-xl bg-secondary border border-border p-3.5 text-sm font-semibold text-muted-foreground">
              <Lock className="h-4 w-4 shrink-0" />
              <span>Markets Closed · Trading Disabled</span>
            </div>
          )}
        </div>
      ) : short ? (
        <div className="space-y-2">
          <p className="text-center text-xs text-down">
            Insufficient balance — short by {fmtKES(stake - balance)}
          </p>
          <Btn3D
            variant="mpesa"
            className="h-12 w-full text-base"
            onClick={() => openCashier("deposit", Math.ceil(stake - balance))}
          >
            Top up {fmtKES(Math.ceil(stake - balance))} via M-Pesa
          </Btn3D>
        </div>
      ) : (
        <Btn3D
          variant={binary && idx === 1 ? "down" : binary ? "up" : "primary"}
          disabled={stake <= 0 || blocked}
          onClick={place}
          className="h-12 w-full text-base"
        >
          Buy {o.label}
          {stake > 0 && <span className="num">· {fmtKES(stake)}</span>}
        </Btn3D>
      )}
      <p className="text-center text-[11px] text-muted-foreground">
        {frozen
          ? "This market is no longer accepting new positions."
          : "Buy and hold until settlement. Opposing outcomes are blocked."}
      </p>
    </div>
  );
}
