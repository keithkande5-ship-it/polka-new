import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Zap } from "lucide-react";
import { assets, fmtPrice, useLivePrice, useRound } from "@/lib/crypto";
import { flashMultipliers } from "@/lib/trading-rules";
import { Btn3D } from "./ui";

export function FlashWidget() {
  const a = assets[0] ?? { sym: "BTC", name: "Bitcoin", seed: 108000, decimals: 2 };
  const { price, live } = useLivePrice(a);
  const { round, remaining } = useRound();
  const lock = useRef<{ r: number; p: number } | null>(null);
  const [, force] = useState(0);
  useEffect(() => {
    if (round !== null && price && lock.current?.r !== round) {
      lock.current = { r: round, p: price };
      force((x) => x + 1);
    }
  }, [round, price]);
  const { up: multUp, down: multDown } = flashMultipliers(price, lock.current?.p ?? null);
  const up = price && lock.current ? price >= lock.current.p : true;
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          <Zap className="h-4 w-4 text-primary" /> BTC 60s Up/Down
        </span>
        <span className="num rounded bg-primary/15 px-1.5 py-0.5 text-xs font-bold text-primary">
          00:{String(remaining).padStart(2, "0")}
        </span>
      </div>
      <div className={`num mt-3 text-2xl font-bold ${up ? "text-up" : "text-down"}`}>
        ${fmtPrice(price, 2)}
      </div>
      <div className="num mt-0.5 text-xs text-muted-foreground">
        To beat ${fmtPrice(lock.current?.p ?? null, 2)} · {live ? "Binance live" : "Backup feed"}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Link to="/flash">
          <Btn3D variant="up" className="num h-10 w-full text-sm">
            Up {multUp.toFixed(2)}x
          </Btn3D>
        </Link>
        <Link to="/flash">
          <Btn3D variant="down" className="num h-10 w-full text-sm">
            Down {multDown.toFixed(2)}x
          </Btn3D>
        </Link>
      </div>
    </div>
  );
}
