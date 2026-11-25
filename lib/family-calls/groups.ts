import { groupCallType } from "./activity";
import type { authorizeFamilyCall } from "./server";

type FamilyCallAuth = Exclude<Awaited<ReturnType<typeof authorizeFamilyCall>>, { response: Response }>;
type Mode = "audio" | "video";
type GroupCallSlot = { call_id: string; caller_id: string; mode: Mode; expires_at: string; claimed?: boolean };

export { groupCallType };

export function streamFailureCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && typeof error.code === "number"
    ? error.code : undefined;
}

export async function groupSlot(auth: FamilyCallAuth, threadId: string) {
  const result = await auth.supabase.from("chat_group_call_slots")
    .select("call_id,caller_id,mode,expires_at").eq("thread_id", threadId).maybeSingle();
  if (result.error) throw result.error;
  const entry = result.data as GroupCallSlot | null;
  if (!entry) return null;

  try {
    const snapshot = await auth.stream.video.getCall({ type: groupCallType, id: entry.call_id, members_limit: 100 });
    const active = Boolean(snapshot.call.session?.started_at && !snapshot.call.session.ended_at && !snapshot.call.ended_at);
    if (active) {
      const renewed = await auth.supabase.rpc("refresh_chat_group_call_slot", {
        thread_uuid: threadId, active_call_uuid: entry.call_id,
      });
      if (renewed.error) throw renewed.error;
    }
    return { entry, snapshot, active };
  } catch (error) {
    if (streamFailureCode(error) !== 16) throw error;
    return { entry, snapshot: null, active: false };
  }
}

export async function reserveGroupCall(auth: FamilyCallAuth, threadId: string, mode: Mode) {
  const current = await groupSlot(auth, threadId);
  if (current?.active) return current.entry;
  if (current && Date.parse(current.entry.expires_at) > Date.now()) return current.entry;
  const { data, error } = await auth.supabase.rpc("reserve_chat_group_call", {
    thread_uuid: threadId, requested_mode: mode,
  });
  if (error) throw error;
  const slot = (data as GroupCallSlot[] | null)?.[0];
  if (!slot) throw new Error("Could not reserve a group call");
  return slot;
}


let groupTypeReady: Promise<void> | undefined;

export function prepareGroupCallType(auth: FamilyCallAuth) {
  groupTypeReady ??= (async () => {
    try {
      await auth.stream.video.getCallType({ name: groupCallType });
    } catch (error) {
      if (streamFailureCode(error) !== 16) throw error;
      try {
        await auth.stream.video.createCallType({
          name: groupCallType,
          grants: {
            user: [], anonymous: [], guest: [],
            call_member: ["join-call", "read-call", "send-audio", "send-video"],
          },
          settings: {
            lifecycle: { mode: "single_use" },
            ring: { auto_cancel_timeout_ms: 30_000, incoming_call_timeout_ms: 30_000, missed_call_timeout_ms: 33_000 },
            session: { inactivity_timeout_seconds: 5 },
            recording: { mode: "disabled" },
            transcription: { mode: "disabled", closed_caption_mode: "disabled" },
            screensharing: { enabled: false },
            thumbnails: { enabled: false },
          },
        });
      } catch (creationError) {
        // Another preview worker may have created it since the first lookup.
        await auth.stream.video.getCallType({ name: groupCallType }).catch(() => { throw creationError; });
      }
    }
  })().catch((error) => {
    groupTypeReady = undefined;
    throw error;
  });
  return groupTypeReady;
}
