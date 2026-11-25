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
  } catch (error) {
    const details = error as { status?: unknown; response?: { status?: unknown }; code?: unknown };
    const status = details?.response?.status ?? details?.status;
    console.warn("[family-calls] Stream token setup failed", {
      status: typeof status === "number" ? status : undefined,
      code: typeof details?.code === "number" ? details.code : undefined,
    });
    return callResponse({ error: "Family Chat could not connect to calling (502)." }, 502);
  }
}
