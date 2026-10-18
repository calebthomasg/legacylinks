import GpsDiagnosticsClient from "./GpsDiagnosticsClient";

export default function GpsDiagnosticsPage() {
  if (process.env.VERCEL_ENV === "production") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-sand px-5 text-night-sky">
        <div className="max-w-xl text-center">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-teal">Trailhead diagnostics</p>
          <h1 className="mt-3 text-3xl font-bold">Diagnostics are unavailable in production</h1>
          <p className="mt-3 text-sm leading-6 text-night-sky/65">
            This browser GPS test is intended for non-production previews only.
          </p>
        </div>
      </main>
    );
  }

  return <GpsDiagnosticsClient />;
}
