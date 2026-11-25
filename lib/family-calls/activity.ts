export type MissedCall = {
  id: string;
  threadId: string;
  callerId: string;
  callerName: string;
  createdAt: string;
};

export type IncomingCall = {
  id: string;
  type: "family_audio" | "family_video";
  expiresAt: number;
};

export type CallActivity = { incoming: IncomingCall | null; missed: MissedCall[] };
