/** A brilliant-cut diamond seen from above, drawn as facet lines. */
export function GemMark({ className }: { className?: string }) {
  const c = 100;
  const pts = (r: number, n: number, rot = 0) =>
    Array.from({ length: n }, (_, i) => {
      const a = ((i / n) * 360 + rot - 90) * (Math.PI / 180);
      return [c + r * Math.cos(a), c + r * Math.sin(a)] as const;
    });
  const outer = pts(92, 8);
  const mid = pts(62, 8, 22.5);
  const inner = pts(30, 8);
  const poly = (p: readonly (readonly [number, number])[]) => p.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <svg viewBox="0 0 200 200" className={className} fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" aria-hidden>
      <polygon points={poly(outer)} />
      <polygon points={poly(mid)} />
      <polygon points={poly(inner)} />
      {outer.map(([x, y], i) => (
        <g key={i}>
          <line x1={x} y1={y} x2={mid[i][0]} y2={mid[i][1]} />
          <line x1={x} y1={y} x2={mid[(i + 7) % 8][0]} y2={mid[(i + 7) % 8][1]} />
          <line x1={mid[i][0]} y1={mid[i][1]} x2={inner[i][0]} y2={inner[i][1]} />
          <line x1={mid[i][0]} y1={mid[i][1]} x2={inner[(i + 1) % 8][0]} y2={inner[(i + 1) % 8][1]} />
        </g>
      ))}
    </svg>
  );
}
