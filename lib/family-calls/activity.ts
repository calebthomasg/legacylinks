export const groupCallType = "family_group";
export const familyCallTypes = ["family_audio", "family_video", groupCallType] as const;

export function isFamilyCall(type: string): type is (typeof familyCallTypes)[number] {
  return familyCallTypes.some((candidate) => candidate === type);
}

export type GroupCallDeparture = { id: string; threadId: string; name: string; createdAt: string };

export type MissedCall = {
  id: string;
  threadId: string;
  callerId: string;
  callerName: string;
  createdAt: string;
};

export type IncomingCall = {
  id: string;
  type: (typeof familyCallTypes)[number];
  expiresAt: number;
};

export type CallActivity = { incoming: IncomingCall | null; missed: MissedCall[]; latestCalls: ConversationCallActivity[] };

export type ConversationCallActivity = {
  threadId: string;
  mode: "audio" | "video";
  at: string;
};

export function conversationCallActivity(call: {
  type: string;
  custom?: Record<string, unknown>;
}, at: string | Date): ConversationCallActivity | null {
  if (!isFamilyCall(call.type)) return null;
  const threadId = call.custom?.family_chat_thread_id;
  const date = new Date(at);
  if (typeof threadId !== "string" || !Number.isFinite(date.getTime())) return null;
  const mode = call.type === "family_audio" || call.custom?.family_chat_mode === "audio" ? "audio" : "video";
  return { threadId, mode, at: date.toISOString() };
}

export function latestCallByConversation(entries: ConversationCallActivity[]) {
  const byThread: Record<string, ConversationCallActivity> = {};
  for (const entry of entries) {
    const previous = byThread[entry.threadId];
    if (!previous || entry.at > previous.at) byThread[entry.threadId] = entry;
  }
  return byThread;
}
