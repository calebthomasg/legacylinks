import { conversationCallActivity, latestCallByConversation, type CallActivity } from "@/lib/family-calls/activity";
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
  const filters = { members: { $in: [auth.userId] } };
  try {
    const result: CallActivity = { incoming: null, missed: [], latestCalls: [] };
    let next: string | undefined;
    do {
      const page = await stream.video.queryCalls({
        filter_conditions: filters,
        sort: [{ field: "created_at", direction: -1 }],
        limit: 25,
        next,
      });
      for (const { call } of page.calls) {
        if (!isCallType(call.type) || (!call.session && !call.ended_at)) continue;
        const activity = conversationCallActivity(call, call.ended_at ?? call.session?.started_at ?? call.created_at);
        if (activity) result.latestCalls.push(activity);
        if (call.created_by.id === auth.userId) continue;
        if (!result.incoming) result.incoming = getIncoming(call, auth.userId, now);
        if (!activity || activity.threadId !== threadId || !call.session || call.session.accepted_by?.[auth.userId]) continue;
        const missedAt = call.session.missed_by?.[auth.userId]
          ?? call.session.rejected_by?.[auth.userId]
          ?? call.session.rejected_by?.[call.created_by.id]
          ?? call.ended_at;
        if (!missedAt) continue;
        const createdAt = timestamp(missedAt);
        if (!Number.isFinite(createdAt)) continue;
        result.missed.push({
          id: call.id,
          threadId: activity.threadId,
          callerId: call.created_by.id,
          callerName: call.created_by.name || "a family member",
          createdAt: new Date(createdAt).toISOString(),
        });
      }
      next = page.next;
    } while (next);
    result.latestCalls = Object.values(latestCallByConversation(result.latestCalls));
    return callResponse(result);
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
    console.warn("[family-calls] Could not read call activity", { code: typeof code === "number" ? code : undefined });
    return callResponse({ error: "Could not read call activity." }, 502);
  }
}

function getIncoming(call: {
  type: string;
  id: string;
  ended_at?: string | Date;
  created_at: string | Date;
  created_by: { id: string };
  settings: { ring: { incoming_call_timeout_ms: number } };
  session?: {
    ended_at?: string | Date;
    started_at?: string | Date;
    accepted_by?: Record<string, unknown>;
    rejected_by?: Record<string, unknown>;
    missed_by?: Record<string, unknown>;
  };
}, userId: string, now: number): CallActivity["incoming"] {
  const session = call.session;
  if (!isCallType(call.type) || call.ended_at || !session || session.ended_at
    || session.accepted_by?.[userId] || session.rejected_by?.[userId]
    || session.rejected_by?.[call.created_by.id] || session.missed_by?.[userId]) return null;
  const expiresAt = timestamp(session.started_at ?? call.created_at) + call.settings.ring.incoming_call_timeout_ms;
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return null;
  return { id: call.id, type: call.type, expiresAt };
}
