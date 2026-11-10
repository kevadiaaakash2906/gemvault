"use client";

import { useEffect, useRef, useState } from "react";
import { formatFigure, parseFigure } from "@/lib/figure";

/**
 * Shows a formatted figure and counts up to it on load (and from the old figure to the new one when it changes). Other text is shown as is.
 * The page always renders the real figure first, so nothing is lost if scripts do not run. The animation only
 * replaces it frame by frame, and the exact original text is shown again at the end.
 */
export function CountUp({ value, duration = 700 }: { value: string; duration?: number }) {
  const [frame, setFrame] = useState<{ value: string; text: string } | null>(null);   // what the animation is showing, and for which figure
  const from = useRef(0);

  useEffect(() => {
    const fig = parseFigure(value);
    if (!fig || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      if (fig) from.current = fig.target;          // no animation: the figure is simply shown as it is
      return;
    }
    const target = fig.target;
    const start = from.current;
    let handle = 0;
    let t0: number | undefined;
    const tick = (now: number) => {
      t0 ??= now;
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      if (p < 1) {
        setFrame({ value, text: formatFigure(fig, start + (target - start) * eased) });
        handle = requestAnimationFrame(tick);
      } else {
        setFrame({ value, text: value });          // the exact original text at the end
        from.current = target;
      }
    };
    handle = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(handle);
  }, [value, duration]);

  const animated = frame && frame.value === value ? frame.text : null;
  const isFigure = parseFigure(value) !== null;
  // Hidden for an instant only while a figure waits for its first animation frame (the stylesheet shows it anyway after 1.5 s, or at once for reduced motion).
  const waiting = isFigure && animated === null;
  return <span className={waiting ? "countup-pending tabular-nums" : "tabular-nums"}>{animated ?? value}</span>;
}
