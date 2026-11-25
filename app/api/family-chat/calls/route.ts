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

  const mode = body.mode;
  const id = crypto.randomUUID();
  const data = {
    created_by_id: auth.userId,
    custom: { family_chat_thread_id: thread.id, family_chat_mode: mode },
    members: userIds.map((user_id) => ({ user_id, role: "call_member" })),
  };

  try {
    await auth.stream.upsertUsers(await callUsers(auth.supabase, userIds));
    if (mode === "video") {
      await auth.stream.video.call("family_video", id).getOrCreate({ data });
      return callResponse({ id, type: "family_video" });
    }

    try {
      await auth.stream.video.call("family_video", id).getOrCreate({
        data: {
          ...data,
          settings_override: {
            video: {
              enabled: true,
              camera_default_on: false,
              camera_facing: "front",
              target_resolution: { width: 1280, height: 720, bitrate: 1_500_000 },
            },
          },
        },
      });
      return callResponse({ id, type: "family_video" });
    } catch (failure) {
      // If Stream rejects the customization, preserve a working audio call
      // with the dedicated camera-disabled type.
      const code = streamCode(failure);
      console.warn("[family-calls] Upgradeable audio preparation rejected", { code });
      if (code !== 4) throw failure;
      await auth.stream.video.call("family_audio", id).getOrCreate({ data });
      return callResponse({ id, type: "family_audio" });
    }
  } catch (failure) {
    console.warn("[family-calls] Call preparation failed", { mode, code: streamCode(failure) });
    return callResponse({ error: "Could not prepare the call. Please try again." }, 502);
  }
}

function streamCode(failure: unknown) {
  if (typeof failure !== "object" || failure === null || !("code" in failure)) return undefined;
  return typeof failure.code === "number" ? failure.code : undefined;
}
