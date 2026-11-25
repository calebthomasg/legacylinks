import Image from "next/image";
import Link from "next/link";

export const recoveryInputClass = "mt-2 w-full rounded-xl border border-night-sky/20 px-4 py-3 text-sm outline-none focus:border-night-sky";
export const recoveryLinkClass = "font-semibold text-night-sky underline underline-offset-4";

export function RecoveryCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 pb-12 pt-24">
      <Link href="/" className="absolute left-6 top-6 sm:left-10 sm:top-8" aria-label="LegacyLink home">
        <Image src="/images/ll-logo.svg" alt="LegacyLink" width={192} height={44} className="h-auto w-40 sm:w-48" priority />
      </Link>
      <section aria-labelledby="recovery-title" className="w-full max-w-md rounded-2xl border border-night-sky/10 bg-white p-8 shadow-sm">
        <h1 id="recovery-title" className="text-3xl font-bold tracking-tight text-night-sky">{title}</h1>
        {children}
      </section>
    </main>
  );
}
