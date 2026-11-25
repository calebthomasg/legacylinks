import { createClient } from "@supabase/supabase-js";
import { after, NextResponse } from "next/server";

export async function POST(request: Request) {
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json") {
    return new NextResponse(null, { status: 415 });
  }

  const input = await request.json().catch(() => null);
  const email = typeof input?.email === "string" ? input.email.trim() : "";
  const captchaToken = input?.captchaToken;
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    || typeof captchaToken !== "string" || !captchaToken || captchaToken.length > 2048) {
    return new NextResponse(null, { status: 400 });
  }

  // Keep provider errors and email delivery time out of the public response.
  after(async () => {
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
      );
      const { error } = await supabase.auth.resetPasswordForEmail(email, { captchaToken });
      if (error) console.warn("Password recovery request:", error.code ?? error.status ?? "provider_error");
    } catch {
      console.error("Password recovery request failed");
    }
  });

  return new NextResponse(null, { status: 202 });
}
