"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
      setIsLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <section className="w-full max-w-md rounded-2xl border border-night-sky/10 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-night-sky/60">
          LegacyLinks
        </p>

        <h1 className="mt-3 text-3xl font-bold tracking-tight text-night-sky">
          Welcome back
        </h1>

        <p className="mt-3 text-sm leading-6 text-night-sky/70">
          Log in to continue building your family story.
        </p>

        <form onSubmit={handleLogin} className="mt-8 space-y-5">
          <div>
            <label className="block text-sm font-medium text-night-sky">
              Email
            </label>
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
            <label className="block text-sm font-medium text-night-sky">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 w-full rounded-xl border border-night-sky/20 px-4 py-3 text-sm outline-none focus:border-night-sky"
              placeholder="Enter your password"
            />
          </div>

          {message && (
            <p className="rounded-xl bg-coral/10 px-4 py-3 text-sm text-coral">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-[14px] border-b-[5px] border-sky-depth bg-sky px-4 py-3 text-sm font-bold uppercase tracking-[0.12em] text-white transition-[transform,border-width,filter] hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-depth active:translate-y-[3px] active:border-b-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Logging in..." : "Log in"}
          </button>
        </form>

        <p className="mt-6 text-sm text-night-sky/70">
          Need an account?{" "}
          <Link href="/signup" className="font-semibold text-night-sky">
            Create one
          </Link>
        </p>
      </section>
    </main>
  );
}
