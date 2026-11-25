"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthVerification } from "@/components/AuthVerification";
import { useVerifiedAuth } from "@/components/useVerifiedAuth";
import { RecoveryCard, recoveryInputClass, recoveryLinkClass } from "@/components/auth/RecoveryCard";

export default function ForgotPasswordPage() {
  const verification = useVerifiedAuth();
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = new FormData(event.currentTarget).get("email");
    const result = await verification.submit(async (captchaToken) => {
      const response = await fetch("/forgot-password/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, captchaToken }),
      });
      if (response.ok) return { error: null };
      return { error: { message: response.status === 400
        ? "Enter a valid email address and complete verification again."
        : "We couldn’t accept your request. Please try again." } };
    });

    if (result) setSubmitted(true);
  }

  return (
    <RecoveryCard title={submitted ? "Check your email" : "Forgot your password?"}>
      {submitted ? (
        <div className="mt-3 space-y-5 text-sm leading-6 text-night-sky/75" role="status">
          <p>If the email address is associated with a LegacyLink account, we’ll send a link to reset the password. Check your spam folder if you don’t see it.</p>
          <button type="button" className={recoveryLinkClass} onClick={() => setSubmitted(false)}>Send another request</button>
        </div>
      ) : (
        <>
          <p className="mt-3 text-sm leading-6 text-night-sky/75">Enter the email address you use for LegacyLink and we’ll send you a link to reset your password.</p>
          <form method="post" onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label htmlFor="recovery-email" className="block text-sm font-medium text-night-sky">Email address</label>
              <input id="recovery-email" name="email" type="email" autoComplete="email" maxLength={254} required className={recoveryInputClass} />
            </div>
            <AuthVerification key={verification.attempt} onToken={verification.onToken} />
            {verification.message && <p role="alert" className="text-sm text-night-sky">{verification.message}</p>}
            <button type="submit" disabled={verification.busy || !verification.ready} className="button-primary w-full">
              {verification.busy ? "Submitting…" : "Send reset link"}
            </button>
          </form>
        </>
      )}
      <Link href="/login" className={`mt-6 inline-block text-sm ${recoveryLinkClass}`}>Back to login</Link>
    </RecoveryCard>
  );
}
