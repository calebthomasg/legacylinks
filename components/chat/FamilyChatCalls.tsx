"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import {
  CallingState, ParticipantsAudio, SpeakerLayout, StreamCall, StreamTheme, StreamVideo, StreamVideoClient,
  hasVideo, useCalls, useCallStateHooks,
  type Call,
} from "@stream-io/video-react-sdk";
import "@stream-io/video-react-sdk/dist/css/styles.css";

import { useCallTone, useCallToneUnlock } from "./useCallTone";
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

const glyphs = {
  accept: "m5 12 5 5L20 7",
  decline: "m6 6 12 12M18 6 6 18",
  hangup: "M3 16v-2a2 2 0 0 1 1-1.7 16 16 0 0 1 16 0 2 2 0 0 1 1 1.7v2h-5v-3a12 12 0 0 0-8 0v3Z",
  microphone: "M9 6a3 3 0 0 1 6 0v6a3 3 0 0 1-6 0Zm-3 6a6 6 0 0 0 12 0m-6 6v4m-4 0h8",
  speaker: "M3 9h4l5-4v14l-5-4H3Zm12 0a4 4 0 0 1 0 6m3-9a8 8 0 0 1 0 12",
  video: "M3 6h12v12H3Zm12 4 6-4v12l-6-4",
};

function CallControl({ label, icon, style = "standard", onClick, disabled, pressed }: {
  label: string;
  icon: keyof typeof glyphs;
  style?: "standard" | "coral" | "sky";
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
}) {
  const color = style === "coral" ? "bg-coral text-night-sky"
    : style === "sky" ? "bg-sky text-night-sky"
      : "border border-white/30 bg-white/10 text-white aria-pressed:bg-white aria-pressed:text-night-sky";
  return (
    <button type="button" disabled={disabled} aria-pressed={pressed} onClick={onClick}
      className="group flex min-w-20 flex-col items-center gap-2 text-sm font-bold disabled:opacity-45">
      <span className={`grid size-14 place-items-center rounded-full transition group-hover:brightness-110 sm:size-16 ${color}`}>
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" className="size-7">
          <path d={glyphs[icon]} />
        </svg>
      </span>
      {label}
    </button>
  );
}

function formatDuration(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function CallPanel({ call, recovered, dismissRecovered }: {
  call: Call;
  recovered: boolean;
  dismissRecovered: () => void;
}) {
  const {
    useAutoplayBlockedSessionIds, useCallCallingState, useCallCreatedBy, useCallCustomData,
    useCallMembers, useCameraState, useMicrophoneState, useRemoteParticipants, useSpeakerState,
  } = useCallStateHooks();
  const state = useCallCallingState();
  const creator = useCallCreatedBy();
  const members = useCallMembers();
  const custom = useCallCustomData();
  const remoteParticipants = useRemoteParticipants();
  const blockedAudio = useAutoplayBlockedSessionIds();
  const { optimisticIsMute: microphoneMuted } = useMicrophoneState();
  const { optimisticIsMute: cameraMuted } = useCameraState();
  const { devices, selectedDevice, isDeviceSelectionSupported } = useSpeakerState();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const initiallyAudio = call.type === "family_audio" || custom.family_chat_mode === "audio";
  const ringing = state === CallingState.RINGING || (recovered && state === CallingState.IDLE);
  const incoming = ringing && !call.isCreatedByMe;
  const connected = state === CallingState.JOINED || state === CallingState.RECONNECTING;
  const liveMedia = connected && remoteParticipants.length > 0;
  const upgraded = connected && (cameraMuted === false || remoteParticipants.some((participant) => hasVideo(participant)));
  const video = !initiallyAudio || upgraded;
  const other = call.isCreatedByMe
    ? members.find((member) => member.user_id !== creator?.id)?.user
    : creator;
  const name = other?.name || "Family member";
  const speaker = devices.find((device) => /speaker/i.test(device.label) && !/earpiece/i.test(device.label));
  const earpiece = devices.find((device) => /earpiece|receiver/i.test(device.label));
  const speakerOn = Boolean(speaker && selectedDevice === speaker.deviceId);
  const tone = ringing && !pending ? incoming ? "incoming" : "outgoing" : null;
  useCallTone(tone);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const joinedAt = useRef<number | null>(null);
  useEffect(() => {
    if (!liveMedia) return;
    joinedAt.current ??= Date.now();
    const start = joinedAt.current;
    const timer = window.setInterval(() => setElapsed(Date.now() - start), 250);
    return () => window.clearInterval(timer);
  }, [liveMedia]);

  async function act(action: () => unknown, failure: string) {
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

  function accept() {
    void act(async () => {
      if (recovered && !call.ringing) await call.accept();
      await call.join();
    }, "Could not connect. The call may have ended or your browser may need media permissions.");
  }

  function hangUp() {
    void act(async () => {
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
    }, "Could not close the call. Please try again.");
  }

  return (
    <dialog ref={dialog} aria-labelledby="family-call-title" onCancel={(event) => event.preventDefault()}
      className="m-auto max-h-[96dvh] w-[calc(100%-1rem)] max-w-xl overflow-y-auto rounded-[2rem] border border-white/15 bg-night-sky p-0 text-white shadow-2xl backdrop:bg-night-sky/80">
      <div className="flex min-h-[min(36rem,90dvh)] flex-col items-center bg-linear-to-br from-night-sky via-[#162c42] to-[#26334c] px-5 py-7 text-center sm:px-8">
        <div className="mb-4 grid size-16 place-items-center rounded-2xl border border-sky/40 bg-sky/15 text-xl font-black text-sky">
          {name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}
        </div>
        <h2 id="family-call-title" className="max-w-full wrap-break-word text-2xl font-black sm:text-3xl">{name}</h2>
        <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-sky sm:text-base">
          Family Chat {video ? "Video" : "Audio"}
          {!incoming && <span className="tabular-nums text-white/85">{formatDuration(elapsed)}</span>}
        </p>
        <p role="status" className="mt-1 text-sm text-white/70">
          {incoming ? "Incoming call" : ringing ? "Calling…"
            : state === CallingState.RECONNECTING ? "Reconnecting…"
              : liveMedia ? "Connected" : "Connecting…"}
        </p>
        {connected && (
          <StreamTheme className="mt-4 w-full">
            {video ? <div className="aspect-video overflow-hidden rounded-2xl bg-night-sky"><SpeakerLayout /></div>
              : <ParticipantsAudio participants={remoteParticipants} />}
          </StreamTheme>
        )}
        {error && <p role="alert" className="mt-4 text-sm text-coral">{error}</p>}
        <div className="mt-auto pt-7">
          {incoming ? (
            <div className="flex gap-10 sm:gap-16">
              <CallControl label="Decline" icon="decline" style="coral" onClick={hangUp} disabled={pending} />
              <CallControl label="Accept" icon="accept" style="sky" onClick={accept} disabled={pending} />
            </div>
          ) : (
            <>
              <div className="mb-5 flex flex-wrap justify-center gap-2 sm:gap-5">
                <CallControl label={microphoneMuted ? "Unmute" : "Mute"} icon="microphone" pressed={microphoneMuted}
                  disabled={!connected || pending} onClick={() => void act(() => call.microphone.toggle(), "Could not change the microphone.")} />
                {isDeviceSelectionSupported && speaker && earpiece && (
                  <CallControl label={speakerOn ? "Earpiece" : "Speaker"} icon="speaker" pressed={speakerOn}
                    disabled={!connected || pending}
                    onClick={() => void act(() => call.speaker.select(speakerOn ? earpiece.deviceId : speaker.deviceId), "Could not change the audio output.")} />
                )}
                <CallControl label={cameraMuted === false ? "Stop video" : "Video"} icon="video" pressed={cameraMuted === false}
                  disabled={!connected || pending} onClick={() => void act(() => call.camera.toggle(), "Could not turn on video. Check camera permissions.")} />
              </div>
              <div className="flex justify-center">
                <CallControl label="Hang up" icon="hangup" style="coral" onClick={hangUp} disabled={pending} />
              </div>
            </>
          )}
          {connected && blockedAudio.length > 0 && (
            <button type="button" className="mt-4 rounded-full border border-sky/50 px-4 py-2 text-sm font-bold text-sky"
              onClick={() => void call.resumeAudio()}>Play call audio</button>
          )}
        </div>
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
    const unsubscribeEnded = client.on("call.ended", () => {
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
      unsubscribeEnded();
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
  useCallToneUnlock();
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
