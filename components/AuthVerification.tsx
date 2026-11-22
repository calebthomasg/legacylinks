"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();

interface TurnstileApi {
  render(container: HTMLElement, options: {
    sitekey: string;
    callback: (token: string) => void;
    "expired-callback": () => void;
    "error-callback": (code: string) => void;
    "timeout-callback": () => void;
    size: "flexible";
  }): string;
  remove(id: string): void;
}

declare global {
  interface Window { turnstile?: TurnstileApi }
}

export function AuthVerification({ onToken }: { onToken: (token: string) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [warning, setWarning] = useState("");

  useEffect(() => {
    const api = window.turnstile;
    if (!siteKey || !ready || !api || !container.current) return;
    let active = true;
    const publish = (value: string) => { if (active) onToken(value); };
    const id = api.render(container.current, {
      sitekey: siteKey,
      size: "flexible",
      callback(token) {
        setWarning("");
        publish(token);
      },
      "expired-callback": () => publish(""),
      "timeout-callback": () => publish(""),
      "error-callback"(code) {
        publish("");
        setWarning(code === "110200" ? "Verification is unavailable on this hostname. Open the authorized preview address or contact support." : "Verification could not finish. Check your connection and try again.");
      },
    });
    return () => {
      active = false;
      api.remove(id);
    };
  }, [ready, onToken]);

  if (!siteKey) return <p role="alert">Verification is unavailable on this deployment. Please contact support.</p>;
  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        onReady={() => setReady(true)}
        onError={() => setWarning("Verification could not load. Refresh this page to try again.")}
      />
      <div ref={container} />
      {warning && <p role="alert" className="text-sm text-coral">{warning}</p>}
    </>
  );
}
