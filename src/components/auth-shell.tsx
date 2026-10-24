import { GemMark } from "@/components/gem-mark";

export function AuthShell({ title, intro, children }: { title: string; intro?: string; children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden bg-forest text-gold-soft lg:flex lg:flex-col lg:justify-between lg:p-14">
        <p className="font-display text-3xl tracking-wide text-ivory">GemVault</p>
        <GemMark className="absolute -right-24 top-1/2 size-[34rem] -translate-y-1/2 text-gold/60" />
        <p className="relative max-w-sm font-display text-2xl leading-snug text-ivory">
          Every stone, every sale, accounted for.
        </p>
      </section>
      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <p className="mb-8 font-display text-2xl text-forest lg:hidden">GemVault</p>
          <h1 className="font-display text-3xl text-forest">{title}</h1>
          {intro && <p className="mt-2 text-ink-soft">{intro}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </section>
    </main>
  );
}
