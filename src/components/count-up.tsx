"use client";

import { useEffect, useRef, useState } from "react";
import { formatFigure, parseFigure } from "@/lib/figure";

/** Shows a formatted figure and counts up to it on load (and from the old figure to the new one when it changes). Other text is shown as is. */
export function CountUp({ value, duration = 700 }: { value: string; duration?: number }) {
  const [text, setText] = useState(value);
  const [ready, setReady] = useState(false);
  const from = useRef(0);

  useEffect(() => {
    const fig = parseFigure(value);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fig || reduced) { setText(value); setReady(true); return; }
    const target = fig.target;
    const start = from.current;
    let frame = 0;
    let t0: number | undefined;
    const tick = (now: number) => {
      t0 ??= now;
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      if (p < 1) {
        setText(formatFigure(fig, start + (target - start) * eased));
        frame = requestAnimationFrame(tick);
      } else {
        setText(value);                      // the exact original text at the end
        from.current = target;
      }
    };
    setText(formatFigure(fig, start));
    setReady(true);
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return <span className={ready ? "tabular-nums" : "countup-pending tabular-nums"}>{text}</span>;
}
