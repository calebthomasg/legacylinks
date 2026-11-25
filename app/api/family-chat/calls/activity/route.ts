import type { CallActivity } from "@/lib/family-calls/activity";
import { authorizeFamilyCall, callResponse } from "@/lib/family-calls/server";

const callTypes = ["family_audio", "family_video"] as const;
const isCallType = (type: string): type is (typeof callTypes)[number] =>
  type === "family_audio" || type === "family_video";

function timestamp(value: string | Date) {
  return value instanceof Date ? value.getTime() : Date.parse(value);
}

export async function POST(request: Request) {
  const auth = await authorizeFamilyCall(request);
  if (auth.response) return auth.response;
  const body = await request.json().catch(() => null);
  const threadId = typeof body?.threadId === "string" ? body.threadId : null;
  const stream = auth.stream;
  const now = Date.now();
  const filters = {
    type: { $in: [...callTypes] },
    members: { $in: [auth.userId] },
    created_by_user_id: { $ne: auth.userId },
  };
  try {
    const [recent, history] = await Promise.all([
      stream.video.queryCalls({
        filter_conditions: { ...filters, created_at: { $gt: new Date(now - 60_000).toISOString() } },
        sort: [{ field: "created_at", direction: -1 }],
        limit: 10,
      }),
      threadId ? stream.video.queryCalls({
        filter_conditions: { ...filters, "custom.family_chat_thread_id": threadId },
        sort: [{ field: "created_at", direction: -1 }],
        limit: 50,
      }) : Promise.resolve(null),
    ]);

    const result: CallActivity = { incoming: null, missed: [] };
    for (const { call } of recent.calls) {
      if (!isCallType(call.type) || call.ended_at || call.session?.ended_at || !call.session) continue;
      if (call.session.accepted_by?.[auth.userId] || call.session.rejected_by?.[auth.userId]
        || call.session.rejected_by?.[call.created_by.id] || call.session.missed_by?.[auth.userId]) continue;
      const timeout = call.settings.ring.incoming_call_timeout_ms;
      const expiresAt = timestamp(call.session.started_at ?? call.created_at) + timeout;
      if (!Number.isFinite(expiresAt) || expiresAt <= now) continue;
      result.incoming = { id: call.id, type: call.type, expiresAt };
      break;
    }

    for (const { call } of history?.calls ?? []) {
      const missedAt = call.session?.missed_by?.[auth.userId];
      if (!missedAt || !threadId || call.custom.family_chat_thread_id !== threadId) continue;
      const createdAt = timestamp(missedAt);
      if (!Number.isFinite(createdAt)) continue;
      result.missed.push({
        id: call.id,
        threadId,
        callerId: call.created_by.id,
        callerName: call.created_by.name || "a family member",
        createdAt: new Date(createdAt).toISOString(),
      });
    }
    return callResponse(result);
  } catch {
    console.warn("[family-calls] Could not read call activity");
    return callResponse({ error: "Could not read call activity." }, 502);
  }
}
