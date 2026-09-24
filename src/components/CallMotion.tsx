"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { prefersReducedMotion } from "@/lib/hr-motion";

/** Replays the call transition when the engine returns a different call or reasons. */
export function CallMotion({
  signature,
  children,
}: {
  signature: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const first = useRef(true);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (first.current) {
      first.current = false;
      return;
    }
    if (prefersReducedMotion()) return;
    node.classList.remove("is-swapping");
    void node.offsetWidth;
    node.classList.add("is-swapping");
  }, [signature]);

  return (
    <div ref={ref} className="aether-call-wrap">
      {children}
    </div>
  );
}
