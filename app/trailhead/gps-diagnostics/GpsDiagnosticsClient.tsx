"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type TestStatus = "idle" | "running" | "success" | "error" | "no-response";
type TestResult = {
  status: TestStatus;
  message: string;
  startedAt?: string;
  endedAt?: string;
  elapsedMs?: number;
};
type TestKey = "standard" | "high";

const initialResults: Record<TestKey, TestResult> = {
  standard: { status: "idle", message: "Not tested yet." },
  high: { status: "idle", message: "Not tested yet." },
};

function labelForError(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED) return "permission denied";
  if (error.code === error.POSITION_UNAVAILABLE) return "position unavailable";
  if (error.code === error.TIMEOUT) return "browser timeout";
  return "unknown error";
}

function formatElapsed(ms?: number) {
  if (ms === undefined) return "";
  return `${(ms / 1000).toFixed(1)} seconds`;
}

export default function GpsDiagnosticsClient() {
  const [results, setResults] = useState(initialResults);
  const [activeTest, setActiveTest] = useState<TestKey | null>(null);
  const needsReload = Object.values(results).some((result) => result.status === "no-response");
  const [permission, setPermission] = useState<string>("Checking...");
  const requestId = useRef(0);
  const timers = useRef<number[]>([]);
  useEffect(() => {
    let disposed = false;
    let permissionStatus: PermissionStatus | undefined;
    const updatePermission = () => {
      if (!disposed && permissionStatus) setPermission(permissionStatus.state);
    };
    if (navigator.permissions?.query) {
      navigator.permissions.query({ name: "geolocation" }).then((status) => {
        if (disposed) return;
        permissionStatus = status;
        updatePermission();
        status.addEventListener("change", updatePermission);
      }).catch(() => {
        if (!disposed) setPermission("Not reported by this browser");
      });
    } else {
      Promise.resolve().then(() => {
        if (!disposed) setPermission("Not reported by this browser");
      });
    }
    return () => {
      disposed = true;
      permissionStatus?.removeEventListener("change", updatePermission);
      requestId.current += 1;
      timers.current.forEach(window.clearTimeout);
    };
  }, []);
  const canUseGeolocation = typeof navigator !== "undefined" && "geolocation" in navigator;
  const context = useMemo(() => {
    if (typeof window === "undefined") return null;
    return {
      secure: window.isSecureContext,
      protocol: window.location.protocol,
      host: window.location.host,
      userAgent: window.navigator.userAgent,
    };
  }, []);

  const runTest = (key: TestKey, enableHighAccuracy: boolean) => {
    if (activeTest !== null || needsReload) return;
    if (!canUseGeolocation) {
      setResults((current) => ({
        ...current,
        [key]: { status: "error", message: "Browser geolocation API unavailable." },
      }));
      return;
    }

    const started = performance.now();
    const id = ++requestId.current;
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
    const startedAt = new Date().toLocaleTimeString();
    setActiveTest(key);
    setResults((current) => ({
      ...current,
      [key]: {
        status: "running",
        message: enableHighAccuracy ? "Requesting high-accuracy GPS..." : "Requesting standard browser location...",
        startedAt,
      },
    }));

    let completed = false;
    const finish = (result: TestResult) => {
      if (completed || id !== requestId.current) return;
      completed = true;
      timers.current.forEach(window.clearTimeout);
      timers.current = [];
      setActiveTest(null);
      setResults((current) => ({ ...current, [key]: result }));
    };

    timers.current.push(window.setTimeout(() => {
      if (completed || id !== requestId.current) return;
      setResults((current) => ({
        ...current,
        [key]: {
          status: "running",
          message: "No callback after 15 seconds. Still observing until 60 seconds; keep this page open.",
          startedAt,
          elapsedMs: Math.round(performance.now() - started),
        },
      }));
    }, 15000));

    timers.current.push(window.setTimeout(() => {
      finish({
        status: "no-response",
        message: "No success or error callback arrived within 60 seconds. This observation ended; the browser request cannot be cancelled. Reload before another test.",
        startedAt,
        endedAt: new Date().toLocaleTimeString(),
        elapsedMs: Math.round(performance.now() - started),
      });
    }, 60000));

    navigator.geolocation.getCurrentPosition(
      (position) => {
        finish({
          status: "success",
          message: `Location callback succeeded. Accuracy was about ${Math.round(position.coords.accuracy)} meters. Coordinates were intentionally not shown or stored.`,
          startedAt,
          endedAt: new Date().toLocaleTimeString(),
          elapsedMs: Math.round(performance.now() - started),
        });
      },
      (error) => {
        finish({
          status: "error",
          message: `Location callback failed: ${labelForError(error)} (code ${error.code}).`,
          startedAt,
          endedAt: new Date().toLocaleTimeString(),
          elapsedMs: Math.round(performance.now() - started),
        });
      },
      { enableHighAccuracy, timeout: 12000, maximumAge: 0 },
    );
  };

  const statusClass = (status: TestStatus) => {
    if (status === "success") return "border-teal bg-teal/10 text-night-sky";
    if (status === "error" || status === "no-response") return "border-coral bg-coral/10 text-night-sky";
    if (status === "running") return "border-night-sky/25 bg-white text-night-sky";
    return "border-night-sky/10 bg-white text-night-sky";
  };

  return (
    <main className="min-h-screen bg-sand px-5 py-8 text-night-sky">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-teal">Trailhead diagnostics</p>
        <h1 className="mt-3 text-3xl font-bold">Browser GPS test</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-night-sky/65">
          This page tests the browser geolocation API without Mapbox, Trailhead map controls, or adventure startup. It reports timing and accuracy only. It does not show or store coordinates.
        </p>

        <section className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            disabled={activeTest !== null || needsReload}
            onClick={() => runTest("standard", false)}
            className="rounded-2xl bg-night-sky px-5 py-4 text-left font-bold text-white disabled:opacity-50"
          >
            Standard GPS
            <span className="block pt-1 text-xs font-normal text-white/70">enableHighAccuracy: false</span>
          </button>
          <button
            type="button"
            disabled={activeTest !== null || needsReload}
            onClick={() => runTest("high", true)}
            className="rounded-2xl bg-teal px-5 py-4 text-left font-bold text-white disabled:opacity-50"
          >
            High-accuracy GPS
            <span className="block pt-1 text-xs font-normal text-white/80">enableHighAccuracy: true</span>
          </button>
        </section>

        <section className="mt-6 grid gap-4">
          {(["standard", "high"] as TestKey[]).map((key) => (
            <article key={key} className={`rounded-2xl border p-4 ${statusClass(results[key].status)}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-bold">{key === "standard" ? "Standard GPS" : "High-accuracy GPS"}</h2>
                <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-bold uppercase tracking-[.12em]">
                  {results[key].status.replace("-", " ")}
                </span>
              </div>
              <p role="status" className="mt-2 text-sm leading-6 text-night-sky/70">{results[key].message}</p>
              {results[key].elapsedMs !== undefined && (
                <p className="mt-2 text-xs font-semibold text-night-sky/50">Elapsed: {formatElapsed(results[key].elapsedMs)}</p>
              )}
              {results[key].startedAt && (
                <p className="mt-1 text-xs text-night-sky/45">
                  Started {results[key].startedAt}
                  {results[key].endedAt ? ` · Ended ${results[key].endedAt}` : ""}
                </p>
              )}
            </article>
          ))}
        </section>

        <section className="mt-6 rounded-2xl border border-night-sky/10 bg-white p-4">
          <h2 className="font-bold">Page context</h2>
          <dl className="mt-3 grid gap-2 text-sm text-night-sky/65">
            <div className="flex justify-between gap-4">
              <dt>Location permission</dt>
              <dd className="text-right font-semibold text-night-sky">{permission}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Secure context</dt>
              <dd className="font-semibold text-night-sky">{context?.secure ? "Yes" : "No"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Protocol</dt>
              <dd className="font-semibold text-night-sky">{context?.protocol ?? "Unknown"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Host</dt>
              <dd className="break-all text-right font-semibold text-night-sky">{context?.host ?? "Unknown"}</dd>
            </div>
            <div>
              <dt>User agent</dt>
              <dd className="mt-1 break-words text-xs text-night-sky/55">{context?.userAgent ?? "Unknown"}</dd>
            </div>
          </dl>
        </section>
      </div>
    </main>
  );
}
