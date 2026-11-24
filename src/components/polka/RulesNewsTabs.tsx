import { useState } from "react";
import { BadgeCheck, ExternalLink, ShieldCheck, CheckCircle2, Clock, Landmark, Coins } from "lucide-react";
import { cn } from "@/lib/utils";

type News = { title: string; url: string; source: string; ago: string };

export function RulesNewsTabs({
  rules,
  oracle,
  news,
  status = "open",
}: {
  rules: string;
  oracle: string;
  news: News[];
  status?: "open" | "closed" | "disputed" | "resolved";
}) {
  const [tab, setTab] = useState<"rules" | "news" | "status">("rules");
  const [open, setOpen] = useState(false);

  const tabs = [
    { id: "rules" as const, label: "Rules" },
    { id: "news" as const, label: "Verified News" },
    { id: "status" as const, label: "Market Status" },
  ];

  // 4-stage lifecycle tracker
  const steps = [
    { id: "open", label: "Open for Trading", icon: Clock },
    { id: "close", label: "Trading Concluded", icon: Landmark },
    { id: "resolution", label: "Oracle Resolution", icon: ShieldCheck },
    { id: "payouts", label: "Payouts Confirmed", icon: Coins },
  ];

  const currentStepIdx =
    status === "resolved" ? 3 : status === "disputed" || status === "closed" ? 1 : 0;

  return (
    <section className="rounded-xl border bg-card p-4">
      <div role="tablist" className="flex gap-6 border-b">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => {
              setTab(t.id);
              setOpen(false);
            }}
            className={cn(
              "-mb-px border-b-2 pb-2 text-sm font-semibold transition-colors",
              tab === t.id
                ? "border-primary text-foreground font-bold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className={cn("relative mt-3 overflow-hidden transition-[max-height] duration-300", open ? "max-h-[2000px]" : "max-h-56")}>
        {tab === "rules" ? (
          <div>
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-up" />
              <span className="whitespace-pre-line">{rules}</span>
            </p>
            <div className="mt-3 rounded-lg bg-muted p-3 text-xs">
              <span className="font-semibold text-foreground">Oracle source: </span>
              <span className="text-muted-foreground">{oracle}</span>
            </div>
          </div>
        ) : tab === "news" ? (
          news.length === 0 ? (
            <p className="text-sm text-muted-foreground">No verified news yet.</p>
          ) : (
            <div className="divide-y">
              {news.map((n) => (
                <a key={n.title} href={n.url} target="_blank" rel="noreferrer" className="group block py-2.5">
                  <div className="flex items-center gap-2 text-xs">
                    <BadgeCheck className="h-3.5 w-3.5 text-primary" />
                    <span className="font-bold text-primary">{n.source}</span>
                    <span className="text-muted-foreground">{n.ago}</span>
                    <ExternalLink className="ml-auto h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                  </div>
                  <p className="mt-0.5 text-sm group-hover:underline">{n.title}</p>
                </a>
              ))}
            </div>
          )
        ) : (
          /* Market Status Lifecycle Stepper */
          <div className="py-2 space-y-4">
            <div className="relative flex items-center justify-between">
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-0.5 bg-border -z-0" />
              {steps.map((step, idx) => {
                const Icon = step.icon;
                const isDone = idx < currentStepIdx;
                const isActive = idx === currentStepIdx;
                return (
                  <div key={step.id} className="relative z-10 flex flex-col items-center">
                    <div
                      className={cn(
                        "size-8 rounded-full flex items-center justify-center text-xs font-bold transition-all border",
                        isDone
                          ? "bg-yes text-white border-yes"
                          : isActive
                          ? "bg-primary text-primary-foreground border-primary ring-4 ring-primary/20"
                          : "bg-secondary text-muted-foreground border-border"
                      )}
                    >
                      {isDone ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-3.5 w-3.5" />}
                    </div>
                    <span
                      className={cn(
                        "mt-1.5 text-[11px] font-medium text-center max-w-[70px]",
                        isActive ? "text-primary font-bold" : "text-muted-foreground"
                      )}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground pt-2">
              All markets on Polka resolve strictly according to oracle feeds. Payouts are distributed to winning positions immediately upon confirmation.
            </p>
          </div>
        )}
      </div>

      {tab !== "status" && (
        <button onClick={() => setOpen((o) => !o)} className="mt-2 text-xs font-semibold text-primary hover:underline">
          {open ? "Show less" : "View more"}
        </button>
      )}
    </section>
  );
}
