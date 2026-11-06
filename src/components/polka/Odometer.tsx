import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

function Reel({ d }: { d: number }) {
  return (
    <span className="odo-reel" style={{ transform: `translateY(${-d}em)` }}>
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
        <span key={n} className="odo-digit">
          {n}
        </span>
      ))}
    </span>
  );
}

/** Fixed-width digit reels that roll on change — green glow up, red glow down. */
export function Odometer({
  value,
  format,
  className,
}: {
  value: number;
  format: (n: number) => string;
  className?: string;
}) {
  const prev = useRef(value);
  const dir = value > prev.current + 1e-9 ? "up" : value < prev.current - 1e-9 ? "down" : null;
  useEffect(() => {
    prev.current = value;
  }, [value]);
  const text = format(value);
  return (
    <span
      className={cn("num odo", dir === "up" && "odo-up", dir === "down" && "odo-down", className)}
      aria-label={text}
    >
      {text
        .split("")
        .map((ch, i) => (/\d/.test(ch) ? <Reel key={i} d={+ch} /> : <span key={i}>{ch}</span>))}
    </span>
  );
}
