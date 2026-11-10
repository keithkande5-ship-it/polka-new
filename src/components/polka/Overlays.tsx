import { CommunityCard } from "./WhatsAppIcon";
import { referralLink } from "@/lib/site";
import { useEffect, useState, useRef } from "react";
import { Link } from "@tanstack/react-router";
import {
  Copy,
  Gift,
  LogOut,
  Moon,
  Settings,
  Share2,
  User,
  Loader2,
  CheckCircle2,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Switch } from "@/components/ui/switch";
import { useIsMobile } from "@/hooks/use-mobile";
import { useStore } from "@/lib/store";
import { fmtKES, fmtDateTime } from "@/lib/markets";
import { cashierQuote, normalizePhone } from "@/lib/trading-rules";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { startDeposit, checkCashier } from "@/lib/cashier.functions";
import { Btn3D } from "./ui";
import { Avatar, AccountOnboarding } from "./AccountUI";
import { TradePanel } from "./TradePanel";
export function TradeSheet() {
  const { slip, closeSlip, slipDocked } = useStore();
  const mobile = useIsMobile();
  // On desktop market pages the ticket is docked in the right rail — no floating dialog.
  const show = !!slip && (mobile || !slipDocked);
  const body = slip && (
    <TradePanel marketId={slip.marketId} outcomeId={slip.outcomeId} onDone={closeSlip} />
  );
  return mobile ? (
    <Drawer open={show} onOpenChange={(o) => !o && closeSlip()} repositionInputs={false}>
      <DrawerContent className="max-h-[85dvh] overflow-auto px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <DrawerTitle className="sr-only">Order Ticket</DrawerTitle>
        <DrawerDescription className="sr-only">Choose trade size and buy outcome</DrawerDescription>
        <div className="pt-4">{body}</div>
      </DrawerContent>
    </Drawer>
  ) : (
    <Dialog open={show} onOpenChange={(o) => !o && closeSlip()}>
      <DialogContent className="max-h-[90dvh] max-w-md overflow-auto">
        <DialogTitle>Order Ticket</DialogTitle>
        <DialogDescription>Buy and hold until settlement</DialogDescription>
        {body}
      </DialogContent>
    </Dialog>
  );
}
export function ProfileDrawer() {
  const { profileOpen, setProfileOpen, user, theme, toggleTheme, logout } = useStore();
  const link = referralLink(user?.handle);
  return (
    <Sheet open={profileOpen} onOpenChange={setProfileOpen}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-sm">
        <SheetHeader className="border-b p-5">
          <div className="flex items-center gap-3">
            <Avatar handle={user?.handle ?? ""} preset={user?.avatar} />
            <div>
              <SheetTitle>{user?.displayName}</SheetTitle>
              <SheetDescription>@{user?.handle}</SheetDescription>
            </div>
          </div>
        </SheetHeader>
        <div className="space-y-5 p-5">
          <CommunityCard />
          <h3 className="flex items-center gap-2 text-sm font-semibold text-primary">
            <Gift className="h-4 w-4" />
            Referrals · 10% commission
          </h3>
          <p className="text-xs text-muted-foreground">
            Referral preview · Earnings are not active.
          </p>
          <div className="flex items-center gap-2">
            <span className="num min-w-0 flex-1 truncate text-xs">{link}</span>
            <Btn3D
              aria-label="Copy invite link"
              title="Copy invite link"
              className="h-8 w-8"
              onClick={() => {
                navigator.clipboard?.writeText(link);
                toast("Invite link copied");
              }}
            >
              <Copy className="h-4 w-4" />
            </Btn3D>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Link
              to="/rewards"
              onClick={() => setProfileOpen(false)}
              className="btn-3d inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-rewards font-semibold text-white [--bevel:color-mix(in_oklab,var(--rewards)_45%,black)]"
            >
              <Gift className="h-4 w-4" />
              Rewards
            </Link>
            <Btn3D
              variant="primary"
              className="h-10 w-full"
              onClick={() =>
                navigator.share
                  ? navigator.share({ title: "Join Polka", url: link }).catch(() => {})
                  : navigator.clipboard?.writeText(link)
              }
            >
              <Share2 className="h-4 w-4" />
              Invite friends
            </Btn3D>
          </div>
          <div className="space-y-2">
            <Link
              to="/profile"
              onClick={() => setProfileOpen(false)}
              className="flex gap-3 py-3 text-sm"
            >
              <User className="h-4 w-4" />
              Profile
            </Link>
            <Link
              to="/settings"
              onClick={() => setProfileOpen(false)}
              className="flex gap-3 py-3 text-sm"
            >
              <Settings className="h-4 w-4" />
              Settings
            </Link>
            <div className="flex items-center gap-3 py-3 text-sm">
              <Moon className="h-4 w-4" />
              <span className="flex-1">Dark mode</span>
              <Switch checked={theme === "dark"} onCheckedChange={toggleTheme} />
            </div>
            <Btn3D className="h-10 w-full" variant="down-soft" onClick={logout}>
              <LogOut className="h-4 w-4" />
              Log out
            </Btn3D>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
export function Cashier() {
  const { cashier, closeCashier, balance, adjustBalance, pushNotif, user, cashierLog, recordCashierTx } =
    useStore();
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState(500);
  const [stage, setStage] = useState<"form" | "pending" | "done">("form");
  const [view, setView] = useState<"deposit" | "withdraw" | "history">("deposit");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  useEffect(() => {
    if (cashier.open) {
      setStage("form");
      setPhone(user?.phone ?? "");
      setAmount(cashier.amount ?? 500);
      setView(cashier.tab === "withdraw" ? "withdraw" : "deposit");
    }
  }, [cashier.open, cashier.amount, user?.phone, cashier.tab]);
  const deposit = view === "deposit";
  const q = cashierQuote(amount, deposit);
  const invalid =
    !Number.isInteger(amount) ||
    amount < 1 ||
    !normalizePhone(phone) ||
    (!deposit && (amount > balance || q.net <= 0));
  const submit = () => {
    if (invalid || stage !== "form") return;
    setStage("pending");
    const quoted = q;
    const fail = (msg: string) => {
      toast.error(msg);
      setStage("form");
    };
    if (!deposit) {
      if (quoted.amount < 20) return fail("Minimum withdrawal is KES 20");
      void supabase
        .rpc("request_withdrawal", { p_amount: quoted.amount, p_fee: quoted.fee, p_phone: normalizePhone(phone) ?? phone })
        .then(({ error }) => {
          if (error) return fail(error.message || "Withdrawal failed, try again later");
          adjustBalance(-quoted.amount);
          recordCashierTx({ kind: "withdraw", amount: quoted.amount, at: Date.now(), receipt: "PENDING" });
          pushNotif({ kind: "mpesa", title: "Withdrawal requested", body: `${fmtKES(quoted.net)} will be sent to your M-Pesa` });
          setStage("done");
        });
      return;
    }
    startDeposit({ data: { amount: quoted.amount, phone } })
      .then(({ id }) => {
        toast.info("Check your phone and enter your M-Pesa PIN");
        let tries = 0;
        const poll = async () => {
          tries++;
          try {
            const r = await checkCashier({ data: { id } });
            const s = (r.status ?? "").toLowerCase();
            if (s === "success" || s === "completed") {
              adjustBalance(quoted.net);
              recordCashierTx({ kind: "deposit", amount: quoted.amount, at: Date.now(), receipt: r.receipt ?? "M-PESA" });
              pushNotif({ kind: "mpesa", title: "Deposit received", body: `${fmtKES(quoted.net)} added to your wallet` });
              setStage("done");
              timer.current = null;
              return;
            }
            if (["failed", "cancelled", "expired", "reversed"].includes(s)) {
              timer.current = null;
              return fail("M-Pesa payment was not completed");
            }
          } catch {
            /* keep polling */
          }
          if (tries >= 40) {
            timer.current = null;
            return fail("Still waiting for M-Pesa. Your balance will update once it confirms.");
          }
          timer.current = setTimeout(poll, 3000);
        };
        timer.current = setTimeout(poll, 4000);
      })
      .catch((e: unknown) => fail(e instanceof Error ? e.message : "M-Pesa request failed, try again later"));
  };
  return (
    <Sheet
      open={cashier.open}
      onOpenChange={(o) => {
        if (!o) {
          if (timer.current) clearTimeout(timer.current);
          closeCashier();
        }
      }}
    >
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-sm">
        <SheetHeader className="border-b p-5">
          <SheetTitle className="flex gap-2">
            <Smartphone className="h-5 w-5 text-mpesa" />
            M-Pesa Cashier
          </SheetTitle>
          <SheetDescription>M-Pesa deposits and withdrawals via PalPluss</SheetDescription>
          <p className="num text-sm">Balance {fmtKES(balance, 2)}</p>
        </SheetHeader>
        <div className="space-y-4 p-5">
          <div className="grid grid-cols-3 gap-2">
            {(["deposit", "withdraw", "history"] as const).map((t) => (
              <Btn3D
                key={t}
                className="h-10 text-sm capitalize"
                variant={view === t ? "primary" : "surface"}
                disabled={stage === "pending"}
                onClick={() => setView(t)}
              >
                {t}
              </Btn3D>
            ))}
          </div>
          {view === "history" ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Preview receipts · session only</p>
              {cashierLog.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No M-Pesa transactions yet.
                </p>
              )}
              {cashierLog.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center gap-3 rounded-lg bg-muted p-3 text-xs"
                >
                  <Smartphone
                    className={cn(
                      "h-4 w-4 shrink-0",
                      tx.kind === "deposit" ? "text-up" : "text-chart-4",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="num font-semibold">{tx.receipt}</p>
                    <p className="text-muted-foreground">{fmtDateTime(tx.at)}</p>
                  </div>
                  <div className="text-right">
                    <p
                      className={cn(
                        "num font-bold",
                        tx.kind === "deposit" ? "text-up" : "text-down",
                      )}
                    >
                      {tx.kind === "deposit" ? "+" : "−"}
                      {fmtKES(tx.amount)}
                    </p>
                    <p className="capitalize text-muted-foreground">{tx.kind}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : stage === "form" ? (
            <>
              <label className="block text-xs text-muted-foreground">
                M-Pesa number
                <input
                  aria-label="M-Pesa number"
                  type="tel"
                  className="input-field num mt-1"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+254 7… or +254 1…"
                />
              </label>
              <label className="block text-xs text-muted-foreground">
                {deposit ? "Deposit amount" : "Requested payout"} (KES)
                <input
                  aria-label="Cashier amount"
                  className="input-field num mt-1 text-2xl font-bold"
                  inputMode="numeric"
                  value={amount || ""}
                  onChange={(e) => setAmount(Number(e.target.value.replace(/\D/g, "")))}
                />
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[100, 500, 1000, 5000].map((v) => (
                  <Btn3D className="num h-9 text-xs" key={v} onClick={() => setAmount(v)}>
                    {v.toLocaleString()}
                  </Btn3D>
                ))}
              </div>
              <dl className="space-y-2 border-y py-4 text-xs">
                <div className="flex justify-between">
                  <dt>{deposit ? "Wallet credit" : "Requested payout"}</dt>
                  <dd className="num">{fmtKES(amount)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>PalPluss processing</dt>
                  <dd className="num">{fmtKES(q.providerFee)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Polka handling</dt>
                  <dd className="num">{fmtKES(q.handlingFee)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Processing fee (total)</dt>
                  <dd className="num">{fmtKES(q.fee)}</dd>
                </div>
                <div className="flex justify-between border-t pt-2 font-semibold">
                  <dt>{deposit ? "STK prompt total" : "Net KES received"}</dt>
                  <dd className="num text-up">{fmtKES(deposit ? q.total : q.net)}</dd>
                </div>
              </dl>
              {!deposit && q.net <= 0 && (
                <p className="text-xs text-down">Requested payout must exceed processing fees.</p>
              )}
              <Btn3D
                variant="mpesa"
                disabled={invalid}
                className="h-12 w-full text-sm"
                onClick={submit}
              >
                {deposit ? `Pay with M-Pesa · ${fmtKES(q.total)}` : `Withdraw · ${fmtKES(q.net)}`}
              </Btn3D>
            </>
          ) : stage === "pending" ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <Loader2 className="h-10 w-10 animate-spin text-mpesa" />
              <p>{deposit ? "Enter your M-Pesa PIN on your phone…" : "Submitting withdrawal…"}</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-12">
              <CheckCircle2 className="h-10 w-10 text-up" />
              <p>{deposit ? "Deposit received" : "Withdrawal requested"}</p>
              <p className="num text-sm">Balance {fmtKES(balance, 2)}</p>
              <Btn3D onClick={closeCashier} className="h-10 px-5">
                Done
              </Btn3D>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
export function Onboarding() {
  return <AccountOnboarding />;
}
