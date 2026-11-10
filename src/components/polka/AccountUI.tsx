import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Mail, Smartphone, ArrowRight } from "lucide-react";
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useIsMobile } from "@/hooks/use-mobile";
import { useStore } from "@/lib/store";
import { avatarIndex } from "@/lib/profiles";
import { normalizePhone } from "@/lib/trading-rules";
import { fmtKES } from "@/lib/markets";
import { Btn3D, Logo } from "./ui";
import { ResponsiveModal } from "./Countdown";
const avatarClasses = ["avatar-0", "avatar-1", "avatar-2", "avatar-3", "avatar-4", "avatar-5"];
export function Avatar({
  handle,
  preset,
  size = "h-10 w-10",
}: {
  handle: string;
  preset?: number | undefined;
  size?: string;
}) {
  return (
    <span
      aria-hidden
      className={`${avatarClasses[preset ?? avatarIndex(handle)] ?? avatarClasses[0]} ${size} inline-flex shrink-0 items-center justify-center rounded-full text-sm font-bold text-primary-foreground`}
    >
      {handle.replace("@", "").slice(0, 2).toUpperCase()}
    </span>
  );
}
export function AuthDock() {
  const { user, openAuth } = useStore();
  if (user) return null;
  return (
    <>
      <div className="fixed bottom-6 left-1/2 z-30 hidden -translate-x-1/2 items-center gap-4 whitespace-nowrap rounded-full border bg-card/95 px-5 py-3 shadow-lg backdrop-blur md:flex">
        <p className="text-xs">
          <strong>Welcome to Polka</strong> · Trade on real-world outcomes
        </p>
        <Btn3D onClick={() => openAuth("signup", "google")} className="h-9 px-3 text-xs">
          Continue with Google
        </Btn3D>
        <Btn3D
          variant="primary"
          onClick={() => openAuth("signup", "email")}
          className="h-9 px-3 text-xs"
        >
          <Mail className="h-3 w-3" />
          Continue with Email
        </Btn3D>
      </div>
      <Btn3D
        onClick={() => openAuth("signup")}
        variant="primary"
        className="fixed inset-x-0 bottom-[calc(58px+env(safe-area-inset-bottom))] z-30 h-10 rounded-none text-xs md:hidden"
      >
        Welcome to Polka · Log in or sign up <ArrowRight className="h-4 w-4" />
      </Btn3D>
    </>
  );
}

function AuthHeader({ variant }: { variant: "drawer" | "dialog" }) {
  const { auth } = useStore();
  const T = variant === "drawer" ? DrawerTitle : DialogTitle;
  const D = variant === "drawer" ? DrawerDescription : DialogDescription;
  return (
    <>
      <Logo className="justify-center" />
      <T className="text-center">{auth.mode === "signup" ? "Join Polka" : "Welcome back"}</T>
      <D className="text-center">By continuing you agree to the Terms and Privacy Policy. 18+ only.</D>
    </>
  );
}

function AuthBody() {
  const { auth, closeAuth, openAuth } = useStore();
  const [checked, setChecked] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <Btn3D
          className="h-10 text-sm"
          variant={auth.provider === "google" ? "primary" : "surface"}
          onClick={() => {
            openAuth(auth.mode, "google");
            setChecked(false);
          }}
        >
          Google
        </Btn3D>
        <Btn3D
          className="h-10 text-sm"
          variant={auth.provider === "email" ? "primary" : "surface"}
          onClick={() => {
            openAuth(auth.mode, "email");
            setChecked(false);
          }}
        >
          Email
        </Btn3D>
      </div>
      {auth.provider === "email" && (
        <>
          <label className="block text-xs text-muted-foreground">
            Email
            <input
              type="email"
              className="input-field mt-1"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </label>
          <label className="block text-xs text-muted-foreground">
            Password
            <input
              type="password"
              className="input-field mt-1"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={auth.mode === "signup" ? "new-password" : "current-password"}
            />
          </label>
        </>
      )}
      <label className="flex items-start gap-3 text-xs leading-relaxed">
        <Checkbox
          aria-label="Confirm age and accept terms"
          checked={checked}
          onCheckedChange={(v) => setChecked(v === true)}
          className="mt-0.5"
        />
        <span>
          I confirm that I am 18+ years of age and agree to Polka's{" "}
          <Link to="/terms" className="text-primary underline">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link to="/privacy" className="text-primary underline">
            Privacy Policy
          </Link>
          .
        </span>
      </label>
      <Btn3D
        variant="primary"
        className="h-12 w-full"
        disabled={
          !checked ||
          (auth.provider === "email" &&
            (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8))
        }
        onClick={async () => {
          const redirect = window.location.origin;
          if (auth.provider === "google") {
            const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirect } });
            if (error) toast.error(error.message);
            return;
          }
          if (auth.mode === "signup") {
            let ref: string | undefined;
            try { ref = localStorage.getItem("polka-referrer") || undefined; } catch { /* storage unavailable */ }
            const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirect, data: ref ? { referred_by: ref } : {} } });
            if (error) return void toast.error(error.message);
            if (!data.session) toast.success("Check your email to confirm your account.");
          } else {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) return void toast.error(error.message);
          }
          setChecked(false);
          setPassword("");
        }}
      >
        Continue with {auth.provider === "google" ? "Google" : "Email"}
      </Btn3D>
      <Btn3D
        className="h-9 w-full text-xs"
        onClick={() => {
          openAuth(auth.mode === "login" ? "signup" : "login", auth.provider);
          setChecked(false);
        }}
      >
        {auth.mode === "login" ? "Create an account" : "Already have an account? Log in"}
      </Btn3D>
    </>
  );
}

/** Centered dialog on desktop, bottom drawer on mobile. */
export function AuthDrawer() {
  const { auth, closeAuth } = useStore();
  const mobile = useIsMobile();
  if (mobile)
    return (
      <Drawer
        open={auth.open}
        onOpenChange={(o) => {
          if (!o) closeAuth();
        }}
      >
        <DrawerContent className="max-h-[90dvh] overflow-y-auto">
          <div className="mx-auto w-full max-w-md space-y-4 px-5 py-5">
            <AuthHeader variant="drawer" />
            <AuthBody />
          </div>
        </DrawerContent>
      </Drawer>
    );
  return (
    <Dialog
      open={auth.open}
      onOpenChange={(o) => {
        if (!o) closeAuth();
      }}
    >
      <DialogContent className="max-w-md">
        <AuthHeader variant="dialog" />
        <AuthBody />
      </DialogContent>
    </Dialog>
  );
}
export function AccountOnboarding() {
  const { onboarding, setOnboarding, updateProfile, openCashier } = useStore();
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState(100);
  return (
    <Drawer open={onboarding !== null} onOpenChange={(o) => !o && setOnboarding(null)}>
      <DrawerContent>
        <div className="mx-auto w-full max-w-md space-y-3 px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Smartphone className="h-8 w-8 text-mpesa" />
          <DrawerTitle>
            {onboarding === "phone" ? "Link Safaricom M-Pesa" : "First deposit"}
          </DrawerTitle>
          <DrawerDescription>
            {onboarding === "phone"
              ? "Your Safaricom number for deposits and withdrawals."
              : "Cashier preview · No money moves."}
          </DrawerDescription>
          {onboarding === "phone" ? (
            <>
              <label className="block text-xs text-muted-foreground">
                Safaricom M-Pesa number
                <input
                  aria-label="Safaricom M-Pesa number"
                  className="input-field num mt-1"
                  type="tel"
                  placeholder="+254 7… or +254 1…"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </label>
              <Btn3D
                variant="mpesa"
                disabled={!normalizePhone(phone)}
                className="h-12 w-full"
                onClick={() => {
                  const n = normalizePhone(phone);
                  if (!n) return;
                  updateProfile({ phone: n });
                  setOnboarding("deposit");
                }}
              >
                Link number
              </Btn3D>
            </>
          ) : (
            <>
              <p className="num text-3xl font-bold">{fmtKES(amount)}</p>
              <div className="grid grid-cols-3 gap-2">
                {[100, 500, 1000].map((v) => (
                  <Btn3D
                    key={v}
                    className="num h-10 text-xs"
                    onClick={() => setAmount((a) => a + v)}
                  >
                    +{fmtKES(v)}
                  </Btn3D>
                ))}
              </div>
              <Btn3D
                variant="primary"
                className="h-12 w-full"
                onClick={() => openCashier("deposit", amount)}
              >
                Continue to deposit
              </Btn3D>
            </>
          )}
          <Btn3D className="h-10 w-full text-sm" onClick={() => setOnboarding(null)}>
            Skip &amp; explore
          </Btn3D>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
export function PublicTraderModal() {
  const { publicTrader, setPublicTrader, user, positions } = useStore();
  const own = publicTrader === user?.handle;
  const resolved = own ? positions.filter((p) => p.status !== "open") : [];
  const volume = own ? positions.reduce((a, p) => a + p.stake, 0) : null;
  return (
    <ResponsiveModal open={!!publicTrader} onOpenChange={(o) => !o && setPublicTrader(null)} title="Trader profile" description="Public trading activity">
        <div className="flex items-center gap-3">
          <Avatar
            handle={publicTrader ?? ""}
            preset={own ? user?.avatar : undefined}
            size="h-16 w-16"
          />
          <div>
            <p className="font-bold">@{publicTrader}</p>
            <p className="text-xs text-muted-foreground">{own ? user?.bio : "Community trader"}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 border-y py-4">
          <div>
            <p className="text-xs text-muted-foreground">Volume traded</p>
            <p className="num font-bold">{volume === null ? "—" : fmtKES(volume)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Win rate</p>
            <p className="num font-bold">
              {resolved.length
                ? `${Math.round((resolved.filter((p) => p.status === "won").length / resolved.length) * 100)}%`
                : "—"}
            </p>
          </div>
        </div>
        <h3 className="text-sm font-semibold">Resolved predictions</h3>
        {resolved.length ? (
          resolved.map((p) => (
            <div key={p.id} className="border-b py-2 text-sm">
              <p>{p.title}</p>
              <p className="num text-muted-foreground">
                {p.outcome} · {p.status === "won" ? `Profit +KES ${Math.round(p.stake * p.mult - p.stake).toLocaleString()}` : p.status === "lost" ? `Loss -KES ${Math.round(p.stake).toLocaleString()}` : "Open"}
              </p>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No verified public activity available.</p>
        )}
    </ResponsiveModal>
  );
}
