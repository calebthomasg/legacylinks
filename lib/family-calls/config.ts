const previewSupabaseHost = "dlgwijztbinnfklugyip.supabase.co";

export function getFamilyCallConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const apiKey = process.env.STREAM_API_KEY;
  const secret = process.env.STREAM_API_SECRET;
  if (
    process.env.VERCEL_ENV !== "preview" ||
    process.env.VERCEL_GIT_COMMIT_REF !== "feature/stream-calling" ||
    process.env.STREAM_CALLS_ENABLED !== "1" ||
    !supabaseUrl ||
    !apiKey ||
    !secret
  ) return null;

  try {
    const origin = new URL(supabaseUrl);
    return origin.protocol === "https:" && origin.hostname === previewSupabaseHost
      ? { apiKey, secret }
      : null;
  } catch {
    return null;
  }
}
