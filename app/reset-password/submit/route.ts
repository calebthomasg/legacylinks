import { createServerClient } from "@supabase/ssr";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { isRecoveryTokenHash, validateRecoveryPassword } from "@/utils/auth/passwordRecovery";

const RECOVERY_COOKIE_PATH = "/reset-password";
const RECOVERY_SESSION_SECONDS = 15 * 60;

function invalidLink() {
  return NextResponse.json({ status: "invalid" }, { status: 400 });
}

export async function POST(request: NextRequest) {
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json") {
    return new NextResponse(null, { status: 415 });
  }

  const input = await request.json().catch(() => null);
  const password = input?.password;
  const validationError = validateRecoveryPassword(password, input?.confirmation);
  if (validationError) {
    return NextResponse.json({ status: "error", message: validationError }, { status: 400 });
  }

  const tokenHash = input?.tokenHash;
  if (!isRecoveryTokenHash(tokenHash)) return invalidLink();

  // Bind a retry session to its own email link, including when multiple tabs are open.
  const cookieId = createHash("sha256").update(tokenHash).digest("hex").slice(0, 32);
  const cookieName = `legacylink-recovery-${cookieId}`;

  const cookieStore = await cookies();
  const recoveryCookies = () => cookieStore.getAll().filter(({ name }) =>
    name === cookieName || name.startsWith(`${cookieName}.`),
  );

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookieOptions: {
        name: cookieName,
        path: RECOVERY_COOKIE_PATH,
        sameSite: "strict",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
      },
      cookies: {
        getAll: recoveryCookies,
        setAll(values) {
          for (const { name, value, options } of values) {
            cookieStore.set(name, value, { ...options, maxAge: options.maxAge === 0 ? 0 : RECOVERY_SESSION_SECONDS });
          }
        },
      },
    },
  );

  if (!recoveryCookies().length) {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
    if (error?.status === 429 || (error && (!error.status || error.status >= 500))) {
      return NextResponse.json({ status: "error", message: "We couldn’t check your link. Please try again in a moment." }, { status: 503 });
    }
    if (error || !data.session) return invalidLink();
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (error.name === "AuthSessionMissingError" || error.status === 401 || error.status === 403) return invalidLink();
    const message = error.code === "same_password"
      ? "Choose a password that’s different from your current password."
      : error.code === "weak_password"
        ? "Choose a stronger password. Try a longer password with a mix of letters, numbers, and symbols."
        : "We couldn’t update your password. Please try again in a moment.";
    return NextResponse.json({ status: "error", message }, { status: 422 });
  }

  const { error: signOutError } = await supabase.auth.signOut();
  if (signOutError) console.warn("Password recovery sign-out:", signOutError.code ?? "provider_error");
  for (const { name } of recoveryCookies()) {
    cookieStore.set(name, "", { path: RECOVERY_COOKIE_PATH, maxAge: 0 });
  }
  return NextResponse.json({ status: "complete" });
}
