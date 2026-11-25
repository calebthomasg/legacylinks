import { authorizeFamilyCall, callResponse, callUsers } from "@/lib/family-calls/server";

export async function POST(request: Request) {
  const auth = await authorizeFamilyCall(request);
  if (auth.response) return auth.response;
  try {
    const users = await callUsers(auth.supabase, [auth.userId]);
    await auth.stream.upsertUsers(users);
    return callResponse({
      apiKey: auth.apiKey,
      token: auth.stream.generateUserToken({ user_id: auth.userId, validity_in_seconds: 900 }),
    });
  } catch {
    return callResponse({ error: "Could not connect to Family Chat calling." }, 502);
  }
}
