import { authorizeFamilyCall, callResponse, callUsers } from "@/lib/family-calls/server";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const auth = await authorizeFamilyCall(request);
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => null);
  if (
    typeof body?.threadId !== "string" || !uuid.test(body.threadId) ||
    (body.mode !== "audio" && body.mode !== "video")
  ) return callResponse({ error: "Choose a direct conversation and call type." }, 400);

  const [{ data: thread, error: threadError }, { data: members, error: membersError }] =
    await Promise.all([
      auth.supabase.from("chat_threads").select("id").eq("id", body.threadId)
        .eq("thread_type", "direct").is("deleted_at", null).maybeSingle(),
      auth.supabase.from("chat_thread_members").select("user_id")
        .eq("thread_id", body.threadId).is("left_at", null),
    ]);

  if (threadError || membersError) return callResponse({ error: "Could not check conversation access." }, 502);
  const userIds = [...new Set((members ?? []).map((member) => member.user_id as string))];
  if (!thread || userIds.length !== 2 || !userIds.includes(auth.userId)) {
    return callResponse({ error: "This conversation is unavailable for calls." }, 404);
  }

  const video = body.mode === "video";
  const type = video ? "family_video" : "family_audio";
  const id = crypto.randomUUID();
  try {
    await auth.stream.upsertUsers(await callUsers(auth.supabase, userIds));
    await auth.stream.video.call(type, id).getOrCreate({
      ring: true,
      video,
      data: {
        created_by_id: auth.userId,
        members: userIds.map((user_id) => ({ user_id, role: "call_member" })),
      },
    });
    return callResponse({ id, type });
  } catch {
    return callResponse({ error: "Could not start the call. Please try again." }, 502);
  }
}
