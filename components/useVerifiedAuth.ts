"use client";

import { useCallback, useRef, useState } from "react";

type AuthResult = { error: { message: string; code?: string } | null };

export function useVerifiedAuth() {
  const token = useRef("");
  const pending = useRef(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [message, setMessage] = useState("");

  const onToken = useCallback((value: string) => {
    token.current = value;
    setReady(Boolean(value));
  }, []);

  async function submit<T extends AuthResult>(request: (captchaToken: string) => Promise<T>) {
    if (pending.current || !token.current) return;
    pending.current = true;
    const captchaToken = token.current;
    onToken("");
    setBusy(true);
    setMessage("");
    try {
      const result = await request(captchaToken);
      if (!result.error) return result;
      const { code, message } = result.error;
      setMessage(code === "captcha_failed" || /captcha/i.test(message)
        ? "Verification was rejected. Complete the new verification and try again."
        : message);
    } catch {
      setMessage("The request could not finish. Check your connection, complete verification again, and retry.");
    } finally {
      onToken("");
      setAttempt((current) => current + 1);
      pending.current = false;
      setBusy(false);
    }
  }

  return { submit, ready, busy, attempt, message, onToken };
}
