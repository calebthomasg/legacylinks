"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthVerification } from "@/components/AuthVerification";
import { useVerifiedAuth } from "@/components/useVerifiedAuth";
import { createClient } from "@/utils/supabase/client";

export default function ConfirmationPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const verification = useVerifiedAuth();

  async function resend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await verification.submit((captchaToken) => createClient().auth.resend({
      type: "signup",
      email: email.trim(),
      options: { captchaToken, emailRedirectTo: new URL("/auth/confirm", window.location.origin).href },
    }));
    if (result) setSent(true);
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <section className="w-full max-w-md space-y-5 rounded-2xl border border-night-sky/10 bg-white p-8">
        <h1 className="text-3xl font-bold text-night-sky">{sent ? "Check your email" : "Request a fresh confirmation link"}</h1>
        {sent ? (
          <p role="status">If this account is awaiting confirmation, look for a new email at {email}. Open the newest link in this browser.</p>
        ) : (
          <form onSubmit={resend} className="space-y-5">
            <p>If your link expired or didn’t work, enter the email you used to sign up.</p>
            <label className="block">Email
              <input className="mt-2 w-full rounded-xl border px-4 py-3" type="email" autoComplete="email" value={email} required onChange={(event) => setEmail(event.target.value)} />
            </label>
            <AuthVerification key={verification.attempt} onToken={verification.onToken} />
            {verification.message && <p role="alert">{verification.message}</p>}
            <button className="button-primary w-full" disabled={verification.busy || !verification.ready}>Send confirmation link</button>
          </form>
        )}
        <Link className="inline-block font-semibold" href="/login">Go to login</Link>
      </section>
    </main>
  );
}
