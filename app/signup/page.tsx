"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthVerification } from "@/components/AuthVerification";
import { useVerifiedAuth } from "@/components/useVerifiedAuth";
import { createClient } from "@/utils/supabase/client";
import { getSafeReturnPath, withReturnPath } from "@/utils/auth/returnPath";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [returnPath, setReturnPath] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const verification = useVerifiedAuth();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setReturnPath(getSafeReturnPath(params.get("next")));
  }, []);

  async function handleSignup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await verification.submit((captchaToken) => supabase.auth.signUp({
      email,
      password,
      options: {
        captchaToken,
        data: {
          first_name: firstName,
          last_name: lastName,
        },
      },
    }));
    if (!result) return;

    if (result.data.session) {
      router.push(returnPath ?? "/profile");
      router.refresh();
      return;
    }

    setConfirmationEmail(email.trim());
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <section className="w-full max-w-md rounded-2xl border border-night-sky/10 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-night-sky/60">LegacyLinks</p>

        {confirmationEmail ? (
          <div role="status">
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-night-sky">Check your email</h1>
            <p className="mt-3 text-sm leading-6 text-night-sky/70">
              To finish creating your account, open the latest confirmation email for{" "}
              <strong className="break-all">{confirmationEmail}</strong> and follow the link.
              If you don’t see it, check your spam folder.
            </p>
            <Link href={withReturnPath("/login", returnPath)} className="mt-6 inline-block font-semibold text-night-sky">
              Go to login
            </Link>
          </div>
        ) : (
          <>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-night-sky">Create your account</h1>

            <p className="mt-3 text-sm leading-6 text-night-sky/70">
              Start saving the stories, memories, and moments your family will carry forward.
            </p>

            <form onSubmit={handleSignup} className="mt-8 space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-night-sky">First name</label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-night-sky/20 px-4 py-3 text-sm outline-none focus:border-night-sky"
                    placeholder="First"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-night-sky">Last name</label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-night-sky/20 px-4 py-3 text-sm outline-none focus:border-night-sky"
                    placeholder="Last"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-night-sky">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-night-sky/20 px-4 py-3 text-sm outline-none focus:border-night-sky"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-night-sky">Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-night-sky/20 px-4 py-3 text-sm outline-none focus:border-night-sky"
                  placeholder="Create a password"
                />
              </div>

              <AuthVerification key={verification.attempt} onToken={verification.onToken} />

              {verification.message && (
                <p className="rounded-xl bg-coral/10 px-4 py-3 text-sm text-coral" role="alert">{verification.message}</p>
              )}

              <button type="submit" disabled={verification.busy || !verification.ready} className="button-primary w-full">
                {verification.busy ? "Creating account..." : "Create account"}
              </button>
            </form>

            <p className="mt-6 text-sm text-night-sky/70">
              Already have an account?{" "}
              <Link href={withReturnPath("/login", returnPath)} className="font-semibold text-night-sky">
                Log in
              </Link>
            </p>
          </>
        )}
      </section>
    </main>
  );
}
