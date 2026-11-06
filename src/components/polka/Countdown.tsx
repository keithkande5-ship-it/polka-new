import { useEffect, useState, type ReactNode } from "react";
import { Odometer } from "./Odometer";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";

const DAY = 86_400_000;

/** Live countdown under 24h (red under 1h, rolling digits); otherwise the static label. */
export function Countdown({ closesAt, label, className }: { closesAt?: number | undefined; label: string; className?: string | undefined }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!closesAt || now === null) return <span className={className}>{label}</span>;
  const left = closesAt - now;
  if (left <= 0 || left > DAY) return <span className={className}>{label}</span>;
  const s = Math.floor(left / 1000);
  const h = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  const text = h > 0 ? `${p(h)}h ${p(mm)}m ${p(ss)}s` : `${p(mm)}m ${p(ss)}s`;
  return (
    <span className={cn("font-mono font-bold", left < 3_600_000 ? "text-destructive" : "text-foreground/80", className)}>
      <Odometer value={s} format={() => text} />
    </span>
  );
}

/** Centered dialog on desktop, bottom slide-up sheet on phones. */
export function ResponsiveModal({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  const mobile = useIsMobile();
  if (mobile)
    return (
      <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
        <DrawerContent className="max-h-[88dvh] overflow-auto px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <DrawerTitle className="pt-4 text-lg font-semibold">{title}</DrawerTitle>
          {description && <DrawerDescription className="mb-3 text-sm text-muted-foreground">{description}</DrawerDescription>}
          <div className="grid gap-4">{children}</div>
        </DrawerContent>
      </Drawer>
    );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-md overflow-auto">
        <DialogTitle>{title}</DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
        {children}
      </DialogContent>
    </Dialog>
  );
}
