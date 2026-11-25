import { StreamClient } from "@stream-io/node-sdk";
import { getFamilyCallConfig } from "./config";
import { createClient } from "@/utils/supabase/server";

export function callResponse(body: object, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export function isPreviewCallOrigin(request: Request, deploymentHosts = [
  process.env.VERCEL_URL,
  process.env.VERCEL_BRANCH_URL,
]) {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (!origin || (fetchSite && fetchSite !== "same-origin")) return false;

  const previewOrigins = deploymentHosts.filter(Boolean).map((host) => `https://${host}`);
  return origin === new URL(request.url).origin || previewOrigins.includes(origin);
}

export async function authorizeFamilyCall(request: Request) {
  const config = getFamilyCallConfig();
  if (!config) return { response: callResponse({ error: "Calling is unavailable." }, 404) };
  if (!isPreviewCallOrigin(request)) {
    console.warn("[family-calls] Browser origin rejected");
    return { response: callResponse({ error: "The preview rejected the calling connection (403)." }, 403) };
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { response: callResponse({ error: "Sign in again to use Family Chat calling." }, 401) };
  return {
    apiKey: config.apiKey,
    supabase,
    userId: user.id,
    stream: new StreamClient(config.apiKey, config.secret),
  };
}

export async function callUsers(supabase: Awaited<ReturnType<typeof createClient>>, userIds: string[]) {
  const { data } = await supabase.rpc("read_chat_names", { user_ids: userIds });
  const profiles: { id: string; first_name: string | null; last_name: string | null }[] = data ?? [];
  return userIds.map((id) => {
    const profile = profiles.find((person) => person.id === id);
    const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ");
    return { id, role: "user", ...(name ? { name } : {}) };
  });
}
