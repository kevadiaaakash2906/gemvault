"use client";

import { similarTo } from "@/lib/similar-buyers";

/** Under a "Sold to" box: warns when the typed name is close to an existing buyer, so one business does not end up with two names. */
export function SimilarBuyerHint({ value, buyers, onPick }: { value: string; buyers: string[]; onPick: (name: string) => void }) {
  const close = similarTo(value, buyers);
  if (close.length === 0) return null;
  return (
    <p role="status" className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
      This looks like a buyer you already have. Use{" "}
      {close.map((name, i) => (
        <span key={name}>
          {i > 0 && " or "}
          <button type="button" onClick={() => onPick(name)} className="font-semibold underline underline-offset-4">{name}</button>
        </span>
      ))}
      {" "}instead?
    </p>
  );
}
