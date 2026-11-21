import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { useStore } from "@/lib/store";
import { avatarPresets } from "@/lib/profiles";
import { validHandle, normalizePhone } from "@/lib/trading-rules";
import { Avatar } from "@/components/polka/AccountUI";
import { Btn3D } from "@/components/polka/ui";
export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Trader settings | Polka" },
      {
        name: "description",
        content: "Manage your Polka profile, account, trading preferences and notifications.",
      },
      { property: "og:title", content: "Trader settings | Polka" },
      { property: "og:description", content: "Your profile and trading preferences on Polka." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Settings,
});
function Settings() {
  const { user, openAuth, updateProfile, oddsMode, setOddsMode, logout } = useStore();
  const [tab, setTab] = useState("Profile");
  const [error, setError] = useState("");
  if (!user)
    return (
      <div className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="text-2xl font-bold">Settings</h1>
        <Btn3D onClick={() => openAuth()} variant="primary" className="mt-5 h-11 px-6">
          Log in
        </Btn3D>
      </div>
    );
  const field = (label: string, key: "displayName" | "handle" | "bio" | "phone") => (
    <label className="block text-xs text-muted-foreground">
      {label}
      <input
        className="input-field mt-2"
        value={user[key]}
        onChange={(e) => {
          updateProfile({ [key]: e.target.value.replace(key === "handle" ? /^@/ : /$^/, "") });
          setError("");
        }}
        maxLength={key === "handle" ? 16 : key === "bio" ? 240 : 100}
      />
    </label>
  );
  const toggle = (
    label: string,
    key: "oneClick" | "stkAlerts" | "resolutionAlerts" | "replyAlerts",
  ) => (
    <div className="flex items-center justify-between border-b py-4 text-sm">
      <span>{label}</span>
      <Switch
        aria-label={label}
        checked={user[key]}
        onCheckedChange={(v) => updateProfile({ [key]: v })}
      />
    </div>
  );
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 md:px-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Settings</h1>
        <Link to="/profile" className="text-sm text-primary">
          View profile
        </Link>
      </div>
      <p className="text-xs text-muted-foreground">
        Manage your profile, security and notification preferences.
      </p>
      <div role="tablist" className="grid grid-cols-4 gap-1 border-b pb-3">
        {["Profile", "Account", "Trading", "Notifications"].map((t) => (
          <Btn3D
            role="tab"
            aria-selected={tab === t}
            key={t}
            variant={tab === t ? "primary" : "surface"}
            className="h-10 min-w-0 px-1 text-[11px] sm:text-sm"
            onClick={() => setTab(t)}
          >
            {t}
          </Btn3D>
        ))}
      </div>
      <section role="tabpanel" className="space-y-5">
        {tab === "Profile" && (
          <>
            <div className="flex items-center gap-4">
              <Avatar handle={user.handle} preset={user.avatar} size="h-16 w-16" />
              <div>
                <p className="font-bold">@{user.handle}</p>
                <p className="text-xs text-muted-foreground">
                  Joined {new Date(user.joined).toLocaleDateString("en-KE")}
                </p>
              </div>
            </div>
            {field("Display name", "displayName")}
            {field("@handle · 3–16 letters, numbers or underscores", "handle")}
            <div>
              <p className="mb-3 text-xs text-muted-foreground">Avatar</p>
              <div className="flex flex-wrap gap-3">
                {avatarPresets.map((name, i) => (
                  <Btn3D
                    key={name}
                    aria-label={name}
                    aria-pressed={user.avatar === i}
                    title={name}
                    className={`h-12 w-12 p-1 ${user.avatar === i ? "ring-2 ring-primary" : ""}`}
                    onClick={() => updateProfile({ avatar: i })}
                  >
                    <Avatar handle={user.handle} preset={i} size="h-9 w-9" />
                  </Btn3D>
                ))}
              </div>
            </div>
            {field("Bio", "bio")}
                       <Btn3D
              variant="primary"
              className="h-11 px-5"
              onClick={() => {
                if (!validHandle(user.handle)) {
                  setError("Handle must be 3–16 letters, numbers or underscores.");
                  return;
                }
                updateProfile({ displayName: user.displayName, bio: user.bio, handle: user.handle });
                toast.success("Profile saved");
              }}
            >
              Save profile
            </Btn3D>
          </>
        )}
        {tab === "Account" && (
          <>
            {field("Linked Safaricom M-Pesa number", "phone")}
            <Btn3D
              className="h-10 px-4"
              onClick={() => {
                const p = normalizePhone(user.phone);
                if (!p) {
                  setError("Enter a valid +254 7… or +254 1… number.");
                  return;
                }
                updateProfile({ phone: p });
                toast.success("M-Pesa number saved");
              }}
            >
              Save number
            </Btn3D>

            <dl className="space-y-4 border-y py-5 text-sm">
              <div className="flex justify-between">
                <dt>Identity tier</dt>
                <dd className="text-muted-foreground">Pending verification</dd>
              </div>
              <div className="flex justify-between">
                <dt>Daily limits</dt>
                <dd className="text-muted-foreground">Not configured</dd>
              </div>
            </dl>
            <h3 className="font-semibold">Active sessions</h3>
            <p className="text-sm text-muted-foreground">This browser · Current session</p>
            <Btn3D variant="down-soft" className="h-10 px-5" onClick={logout}>
              Log out
            </Btn3D>
          </>
        )}
        {tab === "Trading" && (
          <>
            <p className="text-sm font-semibold">Price display</p>
            <div className="flex gap-2">
              {(["prob", "odds"] as const).map((m) => (
                <Btn3D
                  variant={oddsMode === m ? "primary" : "surface"}
                  key={m}
                  className="num h-10 px-5"
                  onClick={() => setOddsMode(m)}
                >
                  {m === "prob" ? "% Prob" : "x Mult"}
                </Btn3D>
              ))}
            </div>
            <p className="text-sm font-semibold">Quick amount presets (KES)</p>
            <div className="grid grid-cols-4 gap-2">
              {user.quickAmounts.map((v, i) => (
                <input
                  key={i}
                  aria-label={`Quick amount ${i + 1}`}
                  className="input-field num"
                  type="number"
                  min={1}
                  value={v}
                  onChange={(e) =>
                    updateProfile({
                      quickAmounts: user.quickAmounts.map((n, j) =>
                        j === i ? Math.max(1, Number(e.target.value)) : n,
                      ),
                    })
                  }
                />
              ))}
            </div>
            {toggle("1-click trade", "oneClick")}
            <p className="text-xs text-muted-foreground">
              Buy and hold until settlement. No opposing outcomes.
            </p>
          </>
        )}
        {tab === "Notifications" && (
          <>
            {toggle("STK status", "stkAlerts")}
            {toggle("Market resolution alerts", "resolutionAlerts")}
            {toggle("Comment reply alerts", "replyAlerts")}
          </>
        )}
        {error && (
          <p role="alert" className="text-sm text-down">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}
