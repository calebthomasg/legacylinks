const previewSupabaseHost = "dlgwijztbinnfklugyip.supabase.co";

export function getFamilyCallConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const apiKey = process.env.STREAM_API_KEY?.trim();
  const secret = process.env.STREAM_API_SECRET?.trim();
  if (process.env.STREAM_CALLS_ENABLED !== "1" || !supabaseUrl || !apiKey || !secret) return null;

  try {
    const origin = new URL(supabaseUrl);
    if (origin.protocol !== "https:") return null;

    const environment = process.env.VERCEL_ENV;
    const branch = process.env.VERCEL_GIT_COMMIT_REF;
    if (
      environment === "production" && branch === "main" && origin.hostname !== previewSupabaseHost
      || environment === "preview" && branch === "feature/stream-calling" && origin.hostname === previewSupabaseHost
    ) return { apiKey, secret };
  } catch {
    return null;
  }
  return null;
}
