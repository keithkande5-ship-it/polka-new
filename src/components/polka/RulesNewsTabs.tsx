import { useState } from "react";
import { BadgeCheck, ExternalLink, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

type News = { title: string; url: string; source: string; ago: string };

/** Horizontal "Rules | Verified News" tabs with a fading "View more" expander. */
export function RulesNewsTabs({ rules, oracle, news }: { rules: string; oracle: string; news: News[] }) {
  const [tab, setTab] = useState<"rules" | "news">("rules");
  const [open, setOpen] = useState(false);
  const tabs = [
    { id: "rules" as const, label: "Rules" },
    { id: "news" as const, label: "Verified News" },
  ];
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
              tab === t.id ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className={cn("relative mt-3 overflow-hidden transition-[max-height] duration-300", open ? "max-h-[2000px]" : "max-h-40")}>
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
        ) : news.length === 0 ? (
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
        )}
        {!open && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-card to-transparent" />}
      </div>
      <button onClick={() => setOpen((o) => !o)} className="mt-2 text-xs font-semibold text-primary hover:underline">
        {open ? "Show less" : "View more"}
      </button>
    </section>
  );
}
