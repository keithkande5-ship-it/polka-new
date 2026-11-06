import { useEffect, useState } from "react";

export type SystemStatus = "ok" | "unstable" | "offline";

type NetInfo = { rtt?: number; effectiveType?: string };

function measure(): SystemStatus {
  if (typeof navigator === "undefined") return "ok";
  if (navigator.onLine === false) return "offline";
  const c = (navigator as { connection?: NetInfo }).connection;
  const rtt = c?.rtt ?? 0;
  const slow = c?.effectiveType?.includes("2g") ?? false;
  // rtt is 0/unknown on unsupported browsers — never treat that as unstable.
  if (slow || (rtt > 500 && rtt < 8000)) return "unstable";
  return "ok";
}

/**
 * Global network health for the system status strip: offline, unstable
 * (high round-trip latency or a 2G-class link) or ok. `recovered` stays true
 * for a few seconds after returning to ok so the UI can flash a green strip.
 */
export function useSystemStatus() {
  const [status, setStatus] = useState<SystemStatus>("ok");
  const [recovered, setRecovered] = useState(false);
  useEffect(() => {
    let prev = measure();
    setStatus(prev);
    const update = () => {
      const next = measure();
      if (next === prev) return;
      if (prev !== "ok" && next === "ok") {
        setRecovered(true);
        window.setTimeout(() => setRecovered(false), 3500);
      }
      prev = next;
      setStatus(next);
    };
    const i = setInterval(update, 4000);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      clearInterval(i);
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return { status, recovered };
}
