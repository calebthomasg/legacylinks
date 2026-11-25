"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import {
  CallingState, ParticipantsAudio, SpeakerLayout, StreamCall, StreamTheme, StreamVideo, StreamVideoClient,
  ToggleAudioPublishingButton, ToggleVideoPublishingButton, useCalls, useCallStateHooks,
  type Call,
} from "@stream-io/video-react-sdk";
import "@stream-io/video-react-sdk/dist/css/styles.css";

import type { CallActivity, MissedCall } from "@/lib/family-calls/activity";

export type CallRequest = { threadId: string; mode: "audio" | "video" };

async function post<T>(path: string, body: object = {}): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result) {
    throw new Error(result?.error ?? `Family Chat calling is unavailable (${response.status}).`);
  }
  return result;
}

function CallPanel({ call, recovered, dismissRecovered }: {
  call: Call;
  recovered: boolean;
  dismissRecovered: () => void;
}) {
  const {
    useAutoplayBlockedSessionIds, useCallCallingState, useCallCreatedBy, useCallMembers,
    useRemoteParticipants,
  } = useCallStateHooks();
  const state = useCallCallingState();
  const creator = useCallCreatedBy();
  const members = useCallMembers();
  const remoteParticipants = useRemoteParticipants();
  const blockedAudio = useAutoplayBlockedSessionIds();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const audio = call.type === "family_audio";
  const ringing = state === CallingState.RINGING || (recovered && state === CallingState.IDLE);
  const incoming = ringing && !call.isCreatedByMe;
  const connected = state === CallingState.JOINED || state === CallingState.RECONNECTING;
  const other = call.isCreatedByMe
    ? members.find((member) => member.user_id !== creator?.id)?.user
    : creator;

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  async function act(action: () => Promise<unknown>, failure: string) {
    setPending(true);
    setError("");
    try {
      await action();
    } catch {
      setError(failure);
    } finally {
      setPending(false);
    }
  }

  return (
    <dialog ref={dialog} aria-labelledby="family-call-title" onCancel={(event) => event.preventDefault()}
      className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-3xl border-0 bg-white p-5 text-night-sky shadow-2xl backdrop:bg-night-sky/65">
      <h2 id="family-call-title" className="text-xl font-black">{audio ? "Phone call" : "Video call"}</h2>
      <p role="status" className="mb-4 mt-1 text-sm text-night-sky/75">
        {incoming ? `${other?.name || "A family member"} is calling`
          : ringing ? `Calling ${other?.name || "your family member"}…`
            : state === CallingState.RECONNECTING ? "Reconnecting…"
              : connected && remoteParticipants.length ? other?.name || "Call connected"
                : connected ? "Waiting for the other device to connect…" : "Connecting…"}
      </p>
      {connected && (
        <StreamTheme>
          {audio ? <ParticipantsAudio participants={remoteParticipants} /> : (
            <div className="aspect-video overflow-hidden rounded-2xl bg-night-sky">
              <SpeakerLayout />
            </div>
          )}
          <div className="mt-4 flex items-center gap-3">
            <ToggleAudioPublishingButton />
            {!audio && <ToggleVideoPublishingButton />}
            {audio && blockedAudio.length > 0 && (
              <button type="button" className="rounded-full bg-sand px-4 py-2 font-bold text-night-sky"
                onClick={() => void call.resumeAudio()}>
                Play call audio
              </button>
            )}
          </div>
        </StreamTheme>
      )}
      {error && <p role="alert" className="my-3 text-sm text-red-700">{error}</p>}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        {incoming && <button type="button" disabled={pending}
          className="rounded-full bg-night-sky px-4 py-2 font-bold text-white"
          onClick={() => void act(async () => {
            if (recovered && !call.ringing) await call.accept();
            await call.join();
          }, "Could not connect. The call may have ended or your browser may need media permissions.")}>
          Accept
        </button>}
        <button type="button" disabled={pending}
          className="rounded-full bg-red-700 px-4 py-2 font-bold text-white"
          onClick={() => void act(async () => {
            if (ringing) {
              if (recovered && !call.ringing) {
                await call.reject("decline");
                dismissRecovered();
              } else {
                await call.leave({ reject: true, reason: incoming ? "decline" : "cancel" });
              }
            } else {
              try {
                await call.endCall();
              } finally {
                if (call.state.callingState !== CallingState.LEFT) await call.leave();
              }
            }
          }, "Could not close the call. Please try again.")}>
          {incoming ? "Decline" : ringing ? "Cancel call" : "Hang up"}
        </button>
      </div>
    </dialog>
  );
}

type Notice = { text: string; error?: boolean };

function CallSession({ client, request, threadId, onMissed, onHandled, onBusy }: {
  client: StreamVideoClient;
  request: CallRequest | null;
  threadId: string | null;
  onMissed: (items: MissedCall[]) => void;
  onHandled: () => void;
  onBusy: (busy: boolean) => void;
}) {
  const calls = useCalls();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [dialing, setDialing] = useState(false);
  const sending = useRef(false);
  const [recovered, setRecovered] = useState<{ call: Call; expiresAt: number } | null>(null);
  const live = calls.find((call) => (
    (call.type === "family_audio" || call.type === "family_video") &&
    call.state.callingState !== CallingState.IDLE &&
    call.state.callingState !== CallingState.LEFT
  ));

  const current = live ?? recovered?.call;

  const recoverCall = useEffectEvent(async (active: () => boolean) => {
    if (document.hidden) return;
    const { incoming, missed } = await post<CallActivity>("/api/family-chat/calls/activity", { threadId });
    if (!active()) return;
    onMissed(missed);
    if (current || !incoming || sending.current || incoming.expiresAt <= Date.now()) return;
    const call = client.call(incoming.type, incoming.id, { reuseInstance: true });
    const { call: snapshot } = await call.get();
    if (!active() || snapshot.ended_at || snapshot.session?.ended_at || incoming.expiresAt <= Date.now()) return;
    const userId = call.currentUserId;
    if (!userId || snapshot.session?.accepted_by?.[userId] || snapshot.session?.rejected_by?.[userId]
      || snapshot.session?.missed_by?.[userId] || call.state.callingState !== CallingState.IDLE) return;
    setRecovered({ call, expiresAt: incoming.expiresAt });
  });

  useEffect(() => {
    let active = true;
    let generation = 0;
    const timers = new Set<number>();
    const sync = () => {
      const version = ++generation;
      void recoverCall(() => active && version === generation).catch(() => undefined);
    };
    const retryAfterEnd = () => {
      const timer = window.setTimeout(() => { timers.delete(timer); sync(); }, 1800);
      timers.add(timer);
    };
    sync();
    window.addEventListener("focus", sync);
    window.addEventListener("pageshow", sync);
    document.addEventListener("visibilitychange", sync);
    const unsubscribeMissed = client.on("call.missed", (event) => {
      const key = event.call.custom.family_chat_thread_id;
      if (typeof key === "string" && (event.call.type === "family_audio" || event.call.type === "family_video")) {
        onMissed([{
          id: event.call.id, threadId: key, callerId: event.call.created_by.id,
          callerName: event.call.created_by.name || "a family member", createdAt: event.created_at,
        }]);
      }
      sync();
      retryAfterEnd();
    });
    return () => {
      active = false;
      timers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener("focus", sync);
      window.removeEventListener("pageshow", sync);
      document.removeEventListener("visibilitychange", sync);
      unsubscribeMissed();
    };
  }, [client, threadId, onMissed]);

  useEffect(() => {
    if (!recovered) return;
    const { call, expiresAt } = recovered;
    const dismiss = () => setRecovered((previous) => previous?.call === call ? null : previous);
    const timer = window.setTimeout(dismiss, Math.max(0, expiresAt - Date.now()));
    const unsubscribe = [
      call.on("call.ended", dismiss),
      call.on("call.missed", dismiss),
      call.on("call.accepted", dismiss),
      call.on("call.rejected", dismiss),
    ];
    return () => {
      window.clearTimeout(timer);
      unsubscribe.forEach((off) => off());
    };
  }, [recovered]);

  useEffect(() => {
    onBusy(Boolean(current) || dialing);
  }, [current, dialing, onBusy]);

  useEffect(() => {
    if (!current?.isCreatedByMe) return;
    return current.on("call.rejected", (event) => {
      if (event.user.id !== current.state.createdBy?.id) {
        setNotice({ text: event.reason === "timeout" ? "No answer." : "Call declined." });
      }
    });
  }, [current]);

  useEffect(() => {
    if (!request || sending.current) return;
    if (current) {
      onHandled();
      return;
    }
    sending.current = true;
    void Promise.resolve().then(async () => {
      setDialing(true);
      setNotice(null);
      try {
        const { id, type } = await post<{ id: string; type: string }>("/api/family-chat/calls", request);
        const outgoing = client.call(type, id);
        // The initiating browser must register the ringing call so the SDK
        // can show it locally and join when the recipient accepts.
        await outgoing.get({ ring: true, video: request.mode === "video" });
      } catch (error) {
        setNotice({ error: true, text: error instanceof Error ? error.message : "Could not start the call." });
      } finally {
        sending.current = false;
        setDialing(false);
        onHandled();
      }
    });
  }, [request, client, current, onHandled]);

  return (
    <>
      {(dialing || notice) && (
        <div role={notice?.error ? "alert" : "status"}
          className="fixed bottom-5 left-1/2 z-[90] flex w-max max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-3 rounded-xl bg-night-sky px-4 py-3 text-sm text-white shadow-xl">
          {dialing ? "Starting your call…" : notice?.text}
          {!dialing && notice && <button type="button" aria-label="Dismiss call status" className="px-2"
            onClick={() => setNotice(null)}>×</button>}
        </div>
      )}
      {current && <StreamCall call={current}><CallPanel key={current.cid} call={current} recovered={current === recovered?.call} dismissRecovered={() => setRecovered(null)} /></StreamCall>}
    </>
  );
}

export default function FamilyChatCalls({ userId, request, threadId, onMissed, onHandled, onReady, onBusy }: {
  userId: string;
  request: CallRequest | null;
  threadId: string | null;
  onMissed: (items: MissedCall[]) => void;
  onHandled: () => void;
  onReady: (ready: boolean) => void;
  onBusy: (busy: boolean) => void;
}) {
  const [client, setClient] = useState<StreamVideoClient | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let ended = false;
    let connected: StreamVideoClient | undefined;
    type Credentials = { apiKey: string; token: string };
    const getCredentials = () => post<Credentials>("/api/family-chat/calls/token");
    void (async () => {
      try {
        const { apiKey, token } = await getCredentials().catch((error: unknown) => {
          if (!ended) setFailure(error instanceof Error ? error.message : "Could not load calling credentials.");
          return { apiKey: "", token: "" };
        });
        if (ended || !apiKey || !token) return;
        let initialToken: string | undefined = token;
        const sdk = new StreamVideoClient({ apiKey });
        connected = sdk;
        await sdk.connectUser({ id: userId }, async () => {
          const firstToken = initialToken;
          initialToken = undefined;
          return firstToken ?? (await getCredentials()).token;
        });
        if (ended) return;
        setClient(sdk);
        onReady(true);
      } catch {
        if (!ended) setFailure("Could not open Stream’s live connection.");
      }
    })();
    return () => {
      ended = true;
      onReady(false);
      if (connected) void connected.disconnectUser().catch(() => undefined);
    };
  }, [attempt, onReady, userId]);

  if (failure) return (
    <div role="alert" className="fixed bottom-5 right-5 z-[90] rounded-xl bg-night-sky px-4 py-3 text-sm text-white shadow-xl">
      {failure}{" "}
      <button type="button" className="font-bold underline" onClick={() => {
        setFailure(null);
        setAttempt((previous) => previous + 1);
      }}>Retry</button>
    </div>
  );
  if (!client) return null;
  return (
    <StreamVideo client={client}>
      <CallSession client={client} request={request} threadId={threadId} onMissed={onMissed} onHandled={onHandled} onBusy={onBusy} />
    </StreamVideo>
  );
}
