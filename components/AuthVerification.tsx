"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

export const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

interface TurnstileApi {
  render(container: HTMLElement, options: {
    sitekey: string;
    callback: (token: string) => void;
    "expired-callback": () => void;
    "error-callback": () => void;
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
    const id = api.render(container.current, {
      sitekey: siteKey,
      size: "flexible",
      callback(token) {
        setWarning("");
        onToken(token);
      },
      "expired-callback": () => onToken(""),
      "error-callback"() {
        onToken("");
        setWarning("Verification could not finish. Check your connection and try again.");
      },
    });
    return () => api.remove(id);
  }, [ready, onToken]);

  if (!siteKey) return null;
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
