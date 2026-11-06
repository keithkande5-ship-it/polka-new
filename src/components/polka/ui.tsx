import btcAsset from "@/assets/btc.png.asset.json";
import ethAsset from "@/assets/eth.png.asset.json";
import solAsset from "@/assets/sol.jpeg.asset.json";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import type { Market } from "@/lib/markets";

export { Odometer } from "./Odometer";

type Variant = "primary" | "up" | "down" | "surface" | "up-soft" | "down-soft" | "mpesa";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-primary-foreground [--bevel:var(--primary-bevel)]",
  up: "bg-up text-up-foreground [--bevel:var(--up-bevel)]",
  down: "bg-down text-down-foreground [--bevel:var(--down-bevel)]",
  surface: "bg-secondary text-secondary-foreground [--bevel:var(--surface-bevel)]",
  "up-soft": "bg-up/15 text-up [--bevel:color-mix(in_oklab,var(--up)_45%,transparent)]",
  "down-soft": "bg-down/15 text-down [--bevel:color-mix(in_oklab,var(--down)_45%,transparent)]",
  mpesa: "bg-mpesa text-up-foreground [--bevel:color-mix(in_oklab,var(--mpesa)_60%,black)]",
};

export const Btn3D = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }
>(({ variant = "surface", className, ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "btn-3d inline-flex select-none items-center justify-center gap-2 rounded-lg font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring",
      variants[variant],
      className,
    )}
    {...props}
  />
));
Btn3D.displayName = "Btn3D";

const tones: Record<Market["thumb"]["tone"], string> = {
  primary: "bg-primary/20 text-primary",
  up: "bg-up/20 text-up",
  down: "bg-down/20 text-down",
  "chart-4": "bg-chart-4/20 text-chart-4",
  "chart-5": "bg-chart-5/20 text-chart-5",
};

function coinImg(m: Market): string | undefined {
  const s = `${m.id} ${m.question} ${m.thumb.text}`.toLowerCase();
  if (/\bbtc\b|bitcoin/.test(s)) return btcAsset.url;
  if (/\beth\b|ethereum/.test(s)) return ethAsset.url;
  if (/\bsol\b|solana/.test(s)) return solAsset.url;
  return undefined;
}

export function Thumb({ m, size = 36 }: { m: Market; size?: number }) {
  const img = m.thumb.img || coinImg(m);
  return (
    <div
      style={{ width: size, height: size }}
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-lg text-[10px] font-bold leading-none tracking-tight",
        tones[m.thumb.tone],
      )}
    >
      {img ? (
        <img src={img} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className={m.thumb.text.length <= 2 ? "text-base" : ""}>{m.thumb.text}</span>
      )}
    </div>
  );
}

export function Logo({ className, size = 24 }: { className?: string; size?: number }) {
  return (
    <span className={cn("inline-flex items-center", className)} aria-label="Polka">
      <img
        src="/logo-white.png"
        alt="Polka"
        style={{ height: size }}
        className="max-w-full w-auto object-contain light:hidden"
      />
      <img
        src="/logo-dark.png"
        alt="Polka"
        style={{ height: size }}
        className="hidden max-w-full w-auto object-contain light:block"
      />
    </span>
  );
}

/** Dull translucent brand watermark for chart canvases and shareable cards. */
export function Watermark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute bottom-7 left-3 z-0 select-none opacity-[0.12] grayscale",
        className,
      )}
    >
      <Logo size={22} />
    </span>
  );
}


/** Floating team crest — transparent, no bounding box. Falls back to a monochrome football vector. */
export function Crest({
  name,
  src,
  size = 64,
}: {
  name: string;
  src?: string | undefined;
  size?: number;
}) {
  if (src)
    return (
      <img
        src={src}
        alt={name}
        style={{ width: size, height: size }}
        className="shrink-0 bg-transparent object-contain"
      />
    );
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={name}
      className="shrink-0 text-foreground/70"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinejoin="round"
    >
      <path d="M32 5 L54 12 V30 C54 44 44 54 32 59 C20 54 10 44 10 30 V12 Z" />
      <path d="M32 5 V59" strokeWidth="1.5" opacity="0.5" />
      <path d="M18 24 L32 32 L46 24" />
      <path d="M18 34 L32 42 L46 34" opacity="0.6" />
    </svg>
  );
}

/** Dual-crest fixture badge: free-floating transparent crests, spacing and a centered VS pill. */
export function CrestPair({
  home,
  away,
  homeSrc,
  awaySrc,
  size = 30,
}: {
  home: string;
  away: string;
  homeSrc?: string | undefined;
  awaySrc?: string | undefined;
  size?: number;
}) {
  const ring = "grid place-items-center";
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5">
      <span className={ring}>
        <Crest name={home} src={homeSrc} size={size} />
      </span>
      <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-muted-foreground">
        VS
      </span>
      <span className={ring}>
        <Crest name={away} src={awaySrc} size={size} />
      </span>
    </span>
  );
}
