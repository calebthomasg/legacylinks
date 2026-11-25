import { groupCallsEnabled } from "@/lib/family-calls/config";
import { groupCallType, groupSlot, prepareGroupCallType, reserveGroupCall } from "@/lib/family-calls/groups";
import { authorizeFamilyCall, callResponse, callUsers } from "@/lib/family-calls/server";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const auth = await authorizeFamilyCall(request);
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => null);
  if (
    typeof body?.threadId !== "string" || !uuid.test(body.threadId) ||
    (body.mode !== "audio" && body.mode !== "video" && body.mode !== "status")
  ) return callResponse({ error: "Choose a conversation and call type." }, 400);

  const [{ data: thread, error: threadError }, { data: members, error: membersError }] =
    await Promise.all([
      auth.supabase.from("chat_threads").select("id,thread_type,title").eq("id", body.threadId)
        .is("deleted_at", null).maybeSingle(),
      auth.supabase.from("chat_thread_members").select("user_id")
        .eq("thread_id", body.threadId).is("left_at", null),
    ]);

  if (threadError || membersError) return callResponse({ error: "Could not check conversation access." }, 502);
  const userIds = [...new Set((members ?? []).map((member) => member.user_id as string))];
  if (!thread || !userIds.includes(auth.userId) || userIds.length < 2
    || (thread.thread_type === "direct" && userIds.length !== 2)) {
    return callResponse({ error: "This conversation is unavailable for calls." }, 404);
  }

  if (thread.thread_type === "group") {
    if (!groupCallsEnabled()) return callResponse({ error: "Group calling is unavailable." }, 404);
    try {
      if (body.mode === "status") {
        const slot = await groupSlot(auth, thread.id);
        const active = slot?.active || (slot?.snapshot && !slot.snapshot.call.ended_at
          && !slot.snapshot.call.session?.ended_at && Date.parse(slot.entry.expires_at) > Date.now());
        return callResponse({ mode: active ? slot?.entry.mode : null });
      }
      await prepareGroupCallType(auth);
      const slot = await reserveGroupCall(auth, thread.id, body.mode);
      await auth.stream.upsertUsers(await callUsers(auth.supabase, userIds));
      const { call, members } = await auth.stream.video.call(groupCallType, slot.call_id).getOrCreate({
        data: {
          created_by_id: slot.caller_id,
          members: userIds.map((user_id) => ({ user_id, role: "call_member" })),
          custom: { family_chat_thread_id: thread.id, family_chat_mode: slot.mode, family_chat_group_name: thread.title },
          settings_override: {
            video: {
              enabled: true, camera_facing: "front", camera_default_on: slot.mode === "video",
              target_resolution: { width: 1280, height: 720, bitrate: 1_500_000 },
            },
          },
        },
      });
      if (call.ended_at || call.session?.ended_at) {
        return callResponse({ error: "The previous group call just ended. Try again in a moment." }, 409);
      }
      const enrolled = new Set(members.map((member) => member.user_id));
      const add = userIds.filter((id) => !enrolled.has(id));
      const remove = members.filter((member) => !userIds.includes(member.user_id)).map((member) => member.user_id);
      if (add.length || remove.length) {
        await auth.stream.video.updateCallMembers({
          type: groupCallType, id: slot.call_id, remove_members: remove,
          update_members: add.map((user_id) => ({ user_id, role: "call_member" })),
        });
      }
      return callResponse({
        id: slot.call_id, type: groupCallType, mode: slot.mode,
        ring: Boolean(slot.claimed && slot.caller_id === auth.userId),
      });
    } catch (failure) {
      console.warn("[family-calls] Group call preparation failed", { code: streamCode(failure) });
      return callResponse({ error: "Could not prepare the group call. Please try again." }, 502);
    }
  }

  if (body.mode === "status") return callResponse({ mode: null });
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
