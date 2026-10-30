"use client";

import { useState } from "react";
import { DIAMOND_SHAPES, OTHER_SHAPE, findShapeBase, shapeVariants } from "@/lib/diamond-shapes";

const selectClass = "block min-h-11 w-full rounded-md border border-gold-soft bg-white px-3 text-base disabled:bg-parchment disabled:text-ink-soft aria-[invalid=true]:border-danger";

/** Diamond Shape as two small dropdowns: Shape, then Style. Calls onChange with the full text to save. */
export function DiamondShapePicker({ id, value, onChange, error }: { id: string; value: string; onChange: (value: string) => void; error?: string }) {
  const [picked, setPicked] = useState("");                      // a Shape chosen before its Style
  const fromValue = findShapeBase(value) ?? (value.trim() ? OTHER_SHAPE : null);
  const base = fromValue ?? picked;
  const variants = base ? shapeVariants(base, value) : [];

  return (
    <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
      <div className="space-y-1.5">
        <label htmlFor={`${id}-shape`} className="block text-sm font-medium">Diamond Shape</label>
        <select id={`${id}-shape`} className={selectClass} value={base} aria-invalid={error ? true : undefined}
          onChange={(e) => { setPicked(e.target.value); onChange(""); }}>
          <option value="">Select shape…</option>
          {Object.keys(DIAMOND_SHAPES).map((b) => <option key={b} value={b}>{b}</option>)}
          {fromValue === OTHER_SHAPE && <option value={OTHER_SHAPE}>Other</option>}
        </select>
      </div>
      <div className="space-y-1.5">
        <label htmlFor={`${id}-style`} className="block text-sm font-medium">Style</label>
        <select id={`${id}-style`} className={selectClass} value={value} disabled={!base} aria-invalid={error ? true : undefined}
          onChange={(e) => onChange(e.target.value)}>
          <option value="">{base ? "Select style…" : "Select shape first…"}</option>
          {variants.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
        </select>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      </div>
    </div>
  );
}
