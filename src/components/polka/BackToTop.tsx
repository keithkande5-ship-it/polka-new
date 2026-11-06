import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { Btn3D } from "./ui";
import { cn } from "@/lib/utils";

export function BackToTop() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const update = () => setVisible(window.scrollY > 350);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  return (
    <Btn3D
      aria-label="Back to top"
      title="Back to top"
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible}
      variant="primary"
      className={cn("fixed bottom-20 right-4 z-40 h-11 w-11 transition-[opacity,transform] duration-200 motion-reduce:transition-none", visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0")}
      onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" })}
    >
      <ArrowUp className="h-5 w-5" />
    </Btn3D>
  );
}