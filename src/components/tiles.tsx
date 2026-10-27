import Link from "next/link";
import { ChevronDown } from "lucide-react";

export type Fact = [label: string, value: React.ReactNode];

/** One row shown as a collapsed tile on phones. Tap to open. Works with the keyboard and without JavaScript. */
export function Tile({
  title, subtitle, right, facts, href, hrefLabel, image,
}: { image?: string | null; title: string; subtitle?: string; right?: React.ReactNode; facts: Fact[]; href?: string; hrefLabel?: string }) {
  return (
    <li>
      <details className="group rounded-md border border-gold-soft bg-white">
        <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
          {image !== undefined && (image
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={image} alt="" className="size-12 shrink-0 rounded object-cover" />
            : <div className="size-12 shrink-0 rounded bg-parchment" aria-hidden />)}
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-forest">{title}</p>
            {subtitle && <p className="truncate text-sm text-ink-soft">{subtitle}</p>}
          </div>
          <div className="shrink-0 space-y-1 text-right text-sm">{right}</div>
          <ChevronDown className="size-5 shrink-0 text-ink-soft transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-gold-soft p-4 text-sm">
          {facts.map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="text-ink-soft">{k}</dt>
              <dd className="break-words font-medium">{v}</dd>
            </div>
          ))}
        </dl>
        {href && (
          <div className="border-t border-gold-soft p-3">
            <Link href={href} className="inline-flex min-h-11 items-center rounded-md bg-forest px-4 text-sm font-semibold text-ivory hover:bg-forest-deep">
              {hrefLabel ?? "Open"}
            </Link>
          </div>
        )}
      </details>
    </li>
  );
}

export function TileEmpty({ children }: { children: React.ReactNode }) {
  return <li className="rounded-md border border-gold-soft bg-white p-6 text-center text-ink-soft">{children}</li>;
}
