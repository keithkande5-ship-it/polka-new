import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { DEFAULT_WA_CHANNEL, hydrateLinks, useAdmin } from "@/lib/admin";
import { WhatsAppIcon } from "./WhatsAppIcon";

const KEY = "polka-wa-slideup-dismissed";

/** "Stay in the loop" prompt shown once to visitors, a few seconds after landing. */
export function WhatsAppSlideup() {
  const { links } = useAdmin();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    hydrateLinks();
    try {
      if (localStorage.getItem(KEY)) return;
    } catch {
      return;
    }
    const t = window.setTimeout(() => setOpen(true), 6000);
    return () => window.clearTimeout(t);
  }, []);
  const close = () => {
    setOpen(false);
    try {
      localStorage.setItem(KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
  };
  if (!open) return null;
  return (
    <div className="fixed inset-x-0 bottom-20 z-50 flex justify-center px-4 md:bottom-6 animate-in slide-in-from-bottom-10 fade-in duration-500">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-up/30 bg-card/85 p-5 shadow-2xl backdrop-blur-xl">
        <div className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 animate-pulse rounded-full bg-up/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -right-10 h-48 w-48 animate-pulse rounded-full bg-primary/25 blur-3xl [animation-delay:1s]" />
        <button aria-label="Close" onClick={close} className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground hover:bg-muted">
          <X className="h-4 w-4" />
        </button>
        <div className="relative flex items-start gap-4">
          <WhatsAppIcon className="h-12 w-12 shrink-0 drop-shadow-lg" />
          <div className="min-w-0">
            <h3 className="text-lg font-bold">Stay in the loop</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Get notified when new markets drop. Join our WhatsApp channel for updates.
            </p>
          </div>
        </div>
        <div className="relative mt-4 grid grid-cols-2 gap-2">
          <button onClick={close} className="h-11 rounded-xl border border-border bg-muted/40 text-sm font-semibold hover:bg-muted">
            Maybe later
          </button>
          <a
            href={links.channel || DEFAULT_WA_CHANNEL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={close}
            className="btn-3d inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-up text-sm font-bold text-primary-foreground [--bevel:color-mix(in_oklab,var(--up)_45%,black)]"
          >
            Join WhatsApp Channel
          </a>
        </div>
      </div>
    </div>
  );
}
