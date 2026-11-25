"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { RecoveryCard, recoveryInputClass } from "@/components/auth/RecoveryCard";
import { isRecoveryTokenHash, MIN_RECOVERY_PASSWORD_LENGTH, validateRecoveryPassword } from "@/utils/auth/passwordRecovery";

function subscribeToHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

function readRecoveryToken() {
  return new URLSearchParams(window.location.hash.slice(1)).get("token_hash") ?? "";
}

function clearRecoveryLink() {
  window.history.replaceState(null, "", window.location.pathname);
}

export default function ResetPasswordPage() {
  const tokenHash = useSyncExternalStore(subscribeToHash, readRecoveryToken, () => null);
  const [outcome, setOutcome] = useState<{ tokenHash: string; status: "invalid" | "complete" } | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ tokenHash: string; message: string } | null>(null);
  const status = !tokenHash || tokenHash === outcome?.tokenHash ? outcome?.status : undefined;
  const message = feedback?.tokenHash === tokenHash ? feedback?.message : undefined;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !tokenHash) return;

    const fields = new FormData(event.currentTarget);
    const password = fields.get("password");
    const confirmation = fields.get("confirmation");
    const validationError = validateRecoveryPassword(password, confirmation);
    setFeedback(validationError ? { tokenHash, message: validationError } : null);
    if (validationError) return;

    setBusy(true);
    try {
      const response = await fetch("/reset-password/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenHash, password, confirmation }),
      });
      const result = await response.json();
      if (result.status === "complete" || result.status === "invalid") {
        if (readRecoveryToken() === tokenHash) clearRecoveryLink();
        setOutcome({ tokenHash, status: result.status });
      } else {
        setFeedback({ tokenHash, message: result.message ?? "We couldn’t update your password. Please try again." });
      }
    } catch {
      setFeedback({ tokenHash, message: "We couldn’t finish the request. Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  }

  if (status === "complete") {
    return (
      <RecoveryCard title="Password updated">
        <p role="status" className="mt-3 text-sm leading-6 text-night-sky/75">You can now log in to LegacyLink with your new password.</p>
        <Link href="/login" className="button-primary mt-6 inline-flex w-full justify-center">Go to login</Link>
      </RecoveryCard>
    );
  }

  if (status === "invalid" || (tokenHash !== null && !isRecoveryTokenHash(tokenHash))) {
    return (
      <RecoveryCard title="Request a new reset link">
        <p role="alert" className="mt-3 text-sm leading-6 text-night-sky/75">This password reset link is invalid, has expired, or has already been used. Request a new link to continue.</p>
        <Link href="/forgot-password" className="button-primary mt-6 inline-flex w-full justify-center">Request a new link</Link>
      </RecoveryCard>
    );
  }

  return (
    <RecoveryCard title="Choose a new password">
      <p id="password-requirements" className="mt-3 text-sm leading-6 text-night-sky/75">Use at least {MIN_RECOVERY_PASSWORD_LENGTH} characters. Numbers and symbols are optional.</p>
      <form key={tokenHash} method="post" onSubmit={handleSubmit} className="mt-8 space-y-5">
        <div>
          <label htmlFor="new-password" className="block text-sm font-medium text-night-sky">New password</label>
          <input id="new-password" name="password" type="password" autoComplete="new-password" required
            minLength={MIN_RECOVERY_PASSWORD_LENGTH} aria-describedby="password-requirements" className={recoveryInputClass} />
        </div>
        <div>
          <label htmlFor="confirm-password" className="block text-sm font-medium text-night-sky">Confirm new password</label>
          <input id="confirm-password" name="confirmation" type="password" autoComplete="new-password" required className={recoveryInputClass} />
        </div>
        {message && <p role="alert" className="rounded-xl bg-coral/10 px-4 py-3 text-sm text-night-sky">{message}</p>}
        <button type="submit" disabled={busy || !tokenHash} className="button-primary w-full">
          {busy ? "Updating password…" : "Update password"}
        </button>
      </form>
    </RecoveryCard>
  );
}
