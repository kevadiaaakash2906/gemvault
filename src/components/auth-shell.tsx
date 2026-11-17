import Image from "next/image";

export function AuthShell({ title, intro, children }: { title: string; intro?: string; children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <section className="hidden items-center justify-center bg-forest lg:flex">
        <Image src="/vinere-logo-white.png" alt="Vinere Jewellery" width={212} height={92} priority className="h-24 w-auto" />
      </section>
      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <p className="mb-8 font-display text-2xl text-forest lg:hidden">Vinere</p>
          <h1 className="font-display text-3xl text-forest">{title}</h1>
          {intro && <p className="mt-2 text-ink-soft">{intro}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </section>
    </main>
  );
}
