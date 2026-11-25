"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import {
  CallingState, ParticipantsAudio, StreamCall, StreamVideo, StreamVideoClient,
  hasVideo, useCalls, useCallStateHooks,
  type Call,
} from "@stream-io/video-react-sdk";
import "@stream-io/video-react-sdk/dist/css/styles.css";

import FamilyChatGroupVideoStage from "./FamilyChatGroupVideoStage";
import FamilyChatVideoStage from "./FamilyChatVideoStage";
import { useCallTone, useCallToneUnlock } from "./useCallTone";
import { conversationCallActivity, groupCallType, isFamilyCall, type CallActivity, type ConversationCallActivity, type GroupCallDeparture, type MissedCall } from "@/lib/family-calls/activity";

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
  hangup: "M2.6 11.2a16 16 0 0 1 18.8 0c.5.4.7 1 .6 1.6l-.6 2.9c-.1.5-.7.9-1.2.7l-4.5-1.2c-.5-.1-.8-.6-.8-1v-2.5a13 13 0 0 0-5.8 0v2.5c0 .4-.3.9-.8 1l-4.5 1.2c-.5.2-1.1-.2-1.2-.7L2 12.8c-.1-.6.1-1.2.6-1.6Z",
  microphone: "M12 2a3.5 3.5 0 0 0-3.5 3.5V11a3.5 3.5 0 1 0 7 0V5.5A3.5 3.5 0 0 0 12 2Zm-7 9h2a5 5 0 1 0 10 0h2a7 7 0 0 1-6 6.9V21h3v2H8v-2h3v-3.1A7 7 0 0 1 5 11Z",
  microphoneOff: "M12 2a3.5 3.5 0 0 0-3.1 1.9l6.6 6.6v-5A3.5 3.5 0 0 0 12 2ZM3.7 2.3l18 18-1.4 1.4-4.6-4.6a7 7 0 0 1-2.7.8V21h3v2H8v-2h3v-3.1A7 7 0 0 1 5 11h2a5 5 0 0 0 7.2 4.5l-1.4-1.4A3.5 3.5 0 0 1 8.5 11V9.8L2.3 3.7Z",
  speaker: "M3 8.5h4L13 4v16l-6-4.5H3a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1Zm12 0v7a4 4 0 0 0 0-7Zm2-4.5v2.2a7 7 0 0 1 0 11.6V20a9 9 0 0 0 0-16Z",
  video: "M3.5 5h10A2.5 2.5 0 0 1 16 7.5v2l4.5-3a1 1 0 0 1 1.5.9v9.2a1 1 0 0 1-1.5.9l-4.5-3v2A2.5 2.5 0 0 1 13.5 19h-10A2.5 2.5 0 0 1 1 16.5v-9A2.5 2.5 0 0 1 3.5 5Z",
  videoOff: "m3.7 2.3 18 18-1.4 1.4-4.4-4.4a2.5 2.5 0 0 1-2.4 1.7h-10A2.5 2.5 0 0 1 1 16.5v-9A2.5 2.5 0 0 1 3.4 5l-1.1-1.3L3.7 2.3ZM8 5h5.5A2.5 2.5 0 0 1 16 7.5v2l4.5-3a1 1 0 0 1 1.5.9v9.2c0 .3-.1.6-.3.8L9.3 5H8Z",
  flip: "M3.5 5.5h2.7c.6 0 1-.2 1.4-.6l1-1.1c.5-.5 1-.8 1.7-.8h3.4c.7 0 1.2.3 1.7.8l1 1.1c.4.4.8.6 1.4.6h2.7A3.5 3.5 0 0 1 24 9v8.5a3.5 3.5 0 0 1-3.5 3.5h-17A3.5 3.5 0 0 1 0 17.5V9a3.5 3.5 0 0 1 3.5-3.5Zm6 3.7a.7.7 0 1 0 .8 1.2 3.8 3.8 0 0 1 5.5 2.6h-1.1a.45.45 0 0 0-.35.73l1.8 2.1c.2.23.55.23.74 0l1.8-2.1a.45.45 0 0 0-.35-.73h-1.1a5.2 5.2 0 0 0-7.7-3.8Zm5 8.6a.7.7 0 1 0-.8-1.2A3.8 3.8 0 0 1 8.2 14h1.1a.45.45 0 0 0 .35-.73l-1.8-2.1a.48.48 0 0 0-.74 0l-1.8 2.1a.45.45 0 0 0 .35.73h1.1a5.2 5.2 0 0 0 7.7 3.8Z",
};

function CallControl({ label, icon, style = "standard", onClick, disabled, pressed, compact = false }: {
  label: string;
  icon: keyof typeof glyphs;
  style?: "standard" | "coral" | "sky";
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
  compact?: boolean;
}) {
  const outlined = icon === "accept" || icon === "decline";
  const color = style === "coral" ? `bg-coral ${outlined ? "text-night-sky" : "text-white"}`
    : style === "sky" ? "bg-sky text-night-sky"
      : `border border-white/30 text-white ${pressed ? "bg-sky/25" : "bg-white/10"}`;
  return (
    <button type="button" disabled={disabled} aria-pressed={pressed} onClick={onClick}
      className={`group flex flex-col items-center gap-2 font-bold disabled:opacity-45 ${compact ? "min-w-0 flex-1 text-xs" : "min-w-20 text-sm"}`}>
      <span className={`grid place-items-center rounded-full transition group-hover:brightness-110 ${compact ? "size-11 sm:size-12" : "size-14 sm:size-16"} ${color}`}>
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-7">
          {outlined
            ? <path d={glyphs[icon]} fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round" />
            : <path d={glyphs[icon]} fill="currentColor" fillRule="evenodd" />}
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
  const { optimisticIsMute: cameraMuted, direction } = useCameraState();
  const { devices, selectedDevice, isDeviceSelectionSupported } = useSpeakerState();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [usedVideo, setUsedVideo] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const group = call.type === groupCallType;
  const initiallyAudio = call.type === "family_audio" || custom.family_chat_mode === "audio";
  const ringing = state === CallingState.RINGING || (recovered && state === CallingState.IDLE);
  const incoming = ringing && !call.isCreatedByMe;
  const connected = state === CallingState.JOINED || state === CallingState.RECONNECTING;
  const liveMedia = connected && remoteParticipants.length > 0;
  const upgraded = connected && (cameraMuted === false || remoteParticipants.some((participant) => hasVideo(participant)));
  if (upgraded && !usedVideo) setUsedVideo(true);
  const video = !initiallyAudio || usedVideo || upgraded;
  const videoStage = connected && video;
  const other = call.isCreatedByMe
    ? members.find((member) => member.user_id !== creator?.id)?.user
    : creator;
  const name = group ? custom.family_chat_group_name || "Family group" : other?.name || "Family member";
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
      if (group && !ringing) {
        await call.leave();
      } else if (ringing) {
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

  const status = incoming ? "Incoming call" : ringing ? "Calling…"
    : state === CallingState.RECONNECTING ? "Reconnecting…"
      : liveMedia ? "Connected" : group && connected ? "Waiting for family to join…" : "Connecting…";
  const cameraControl = call.type !== "family_audio" && (
    <CallControl label={cameraMuted === false ? "Stop video" : "Video"}
      icon={cameraMuted === false ? "video" : "videoOff"} pressed={cameraMuted === false}
      compact={videoStage} disabled={!connected || pending}
      onClick={() => void act(() => call.camera.toggle(), "Could not change your camera. Check camera permissions.")} />
  );
  const microphoneControl = (
    <CallControl label={microphoneMuted ? "Unmute" : "Mute"}
      icon={microphoneMuted ? "microphoneOff" : "microphone"} pressed={microphoneMuted}
      compact={videoStage} disabled={!connected || pending}
      onClick={() => void act(() => call.microphone.toggle(), "Could not change the microphone.")} />
  );
  const endControl = (
    <CallControl label={group ? "Leave call" : "Hang up"} icon="hangup" style="coral" compact={videoStage}
      onClick={hangUp} disabled={pending} />
  );
  const audioRecovery = connected && blockedAudio.length > 0 && (
    <button type="button" className="rounded-full border border-sky/50 bg-night-sky px-4 py-2 text-sm font-bold text-sky"
      onClick={() => void call.resumeAudio()}>Play call audio</button>
  );

  return (
    <dialog ref={dialog} aria-labelledby="family-call-title" onCancel={(event) => event.preventDefault()}
      className={`fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none overflow-hidden border-0 bg-night-sky p-0 text-white backdrop:bg-night-sky/80 ${videoStage || incoming
        ? "" : "sm:pointer-fine:m-auto sm:pointer-fine:h-[min(36rem,94dvh)] sm:pointer-fine:max-w-xl sm:pointer-fine:rounded-[2rem] sm:pointer-fine:border sm:pointer-fine:border-white/15 sm:pointer-fine:shadow-2xl"}`}>
      {connected && <ParticipantsAudio participants={remoteParticipants} />}
      {videoStage ? (
        <div className="relative isolate h-full overflow-hidden">
          {group
            ? <FamilyChatGroupVideoStage name={name} mirrorSelf={direction !== "back"} />
            : <FamilyChatVideoStage name={name} mirrorSelf={direction !== "back"} />}
          <header className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-linear-to-b from-night-sky/90 to-transparent px-5 pb-4 pt-[max(1rem,env(safe-area-inset-top))]">
            <h2 id="family-call-title" className="truncate text-lg font-black text-white">{name}</h2>
            <p className="mt-0.5 text-xs font-semibold text-sky">
              Family Chat Video <span className="ml-2 tabular-nums text-white/85">{formatDuration(elapsed)}</span>
            </p>
            {state === CallingState.RECONNECTING && <p role="status" className="mt-1 text-xs">{status}</p>}
          </header>
          <footer className="absolute inset-x-2 bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-10 mx-auto flex max-w-md flex-col items-center gap-2">
            {error && <p role="alert" className="rounded-xl bg-night-sky px-3 py-2 text-center text-sm text-coral">{error}</p>}
            {audioRecovery}
            <div className="flex w-full items-start gap-1 rounded-3xl border border-sky/25 bg-night-sky/90 px-2 py-2.5 shadow-xl backdrop-blur-md sm:px-3">
              {cameraControl}
              {direction && (
                <CallControl label="Flip camera" icon="flip" compact disabled={cameraMuted !== false || pending}
                  onClick={() => void act(() => call.camera.flip(), "Could not switch cameras.")} />
              )}
              {microphoneControl}
              {endControl}
            </div>
          </footer>
        </div>
      ) : (
        <div className="flex h-full flex-col items-center overflow-y-auto bg-linear-to-br from-night-sky via-[#162c42] to-[#26334c] px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))] text-center sm:px-8">
          <div className="mb-4 mt-[min(8dvh,3rem)] grid size-16 shrink-0 place-items-center rounded-2xl border border-sky/40 bg-sky/15 text-xl font-black text-sky">
            {name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}
          </div>
          <h2 id="family-call-title" className="max-w-full wrap-break-word text-2xl font-black sm:text-3xl">{name}</h2>
          <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-sky sm:text-base">
            Family Chat {video ? "Video" : "Audio"}
            {!incoming && <span className="tabular-nums text-white/85">{formatDuration(elapsed)}</span>}
          </p>
          <p role="status" className="mt-1 text-sm text-white/70">{status}</p>
          {error && <p role="alert" className="mt-4 text-sm text-coral">{error}</p>}
          <div className="mt-auto flex flex-col items-center gap-4 pt-6">
            {incoming ? (
              <div className="flex gap-10 sm:gap-16">
                <CallControl label="Decline" icon="decline" style="coral" onClick={hangUp} disabled={pending} />
                <CallControl label="Accept" icon="accept" style="sky" onClick={accept} disabled={pending} />
              </div>
            ) : (
              <>
                <div className="flex flex-wrap justify-center gap-2 sm:gap-5">
                  {microphoneControl}
                  {isDeviceSelectionSupported && speaker && earpiece && (
                    <CallControl label={speakerOn ? "Earpiece" : "Speaker"} icon="speaker" pressed={speakerOn}
                      disabled={!connected || pending}
                      onClick={() => void act(() => call.speaker.select(speakerOn ? earpiece.deviceId : speaker.deviceId), "Could not change the audio output.")} />
                  )}
                  {cameraControl}
                </div>
                {endControl}
              </>
            )}
            {audioRecovery}
          </div>
        </div>
      )}
    </dialog>
  );
}

type Notice = { text: string; error?: boolean };

function CallSession({ client, request, threadId, groupThread, onMissed, onActivity, onDeparted, onGroupStatus, onHandled, onBusy }: {
  client: StreamVideoClient;
  request: CallRequest | null;
  threadId: string | null;
  onMissed: (items: MissedCall[]) => void;
  onActivity: (items: ConversationCallActivity[]) => void;
  groupThread: boolean;
  onDeparted: (entry: GroupCallDeparture) => void;
  onGroupStatus: (status: { threadId: string; mode: "audio" | "video" | null }) => void;
  onHandled: () => void;
  onBusy: (busy: boolean) => void;
}) {
  const calls = useCalls();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [dialing, setDialing] = useState(false);
  const sending = useRef(false);
  const [recovered, setRecovered] = useState<{ call: Call; expiresAt: number } | null>(null);
  const live = calls.find((call) => (
    isFamilyCall(call.type) &&
    call.state.callingState !== CallingState.IDLE &&
    call.state.callingState !== CallingState.LEFT
  ));

  const current = live ?? recovered?.call;

  useEffect(() => {
    if (!groupThread || !threadId) return;
    let alive = true;
    const capture = () => {
      if (document.hidden) return;
      void post<{ mode: "audio" | "video" | null }>("/api/family-chat/calls", { threadId, mode: "status" })
        .then(({ mode }) => { if (alive) onGroupStatus({ threadId, mode }); }).catch(() => undefined);
    };
    capture();
    const timer = window.setInterval(capture, 6000);
    document.addEventListener("visibilitychange", capture);
    return () => {
      alive = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", capture);
    };
  }, [groupThread, threadId, onGroupStatus]);

  useEffect(() => {
    if (current?.type !== groupCallType) return;
    const key = current.state.custom.family_chat_thread_id;
    if (typeof key !== "string") return;
    const leaving = new Map<string, number>();
    const offJoin = current.on("call.session_participant_joined", (event) => {
      const timer = leaving.get(event.participant.user.id);
      if (timer !== undefined) window.clearTimeout(timer);
      leaving.delete(event.participant.user.id);
    });
    const offLeave = current.on("call.session_participant_left", (event) => {
      const { user } = event.participant;
      if (user.id === current.currentUserId) return;
      const timer = window.setTimeout(() => {
        leaving.delete(user.id);
        onDeparted({ id: `${current.id}:${user.id}:${event.created_at}`, threadId: key,
          name: user.name || "A family member", createdAt: event.created_at });
      }, 3500);
      const previous = leaving.get(user.id);
      if (previous !== undefined) window.clearTimeout(previous);
      leaving.set(user.id, timer);
    });
    return () => {
      offJoin();
      offLeave();
      leaving.forEach((timer) => window.clearTimeout(timer));
    };
  }, [current, onDeparted]);

  const recoverCall = useEffectEvent(async (active: () => boolean) => {
    if (document.hidden) return;
    const { incoming, missed, latestCalls } = await post<CallActivity>("/api/family-chat/calls/activity", { threadId });
    if (!active()) return;
    onMissed(missed);
    onActivity(latestCalls);
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
    const noteCall = (call: Parameters<typeof conversationCallActivity>[0], at: string) => {
      const activity = conversationCallActivity(call, at);
      if (activity) onActivity([activity]);
    };
    const unsubscribeRinging = client.on("call.ring", (event) => noteCall(event.call, event.created_at));
    const unsubscribeMissed = client.on("call.missed", (event) => {
      const key = event.call.custom.family_chat_thread_id;
      if (typeof key === "string" && isFamilyCall(event.call.type)) {
        onMissed([{
          id: event.call.id, threadId: key, callerId: event.call.created_by.id,
          callerName: event.call.created_by.name || "a family member", createdAt: event.created_at,
        }]);
      }
      sync();
      retryAfterEnd();
    });
    const unsubscribeEnded = client.on("call.ended", (event) => {
      noteCall(event.call, event.created_at);
      sync();
      retryAfterEnd();
    });
    return () => {
      active = false;
      timers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener("focus", sync);
      window.removeEventListener("pageshow", sync);
      document.removeEventListener("visibilitychange", sync);
      unsubscribeRinging();
      unsubscribeMissed();
      unsubscribeEnded();
    };
  }, [client, threadId, onMissed, onActivity]);

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
        const { id, type, mode, ring } = await post<{ id: string; type: string; mode?: "audio" | "video"; ring?: boolean }>("/api/family-chat/calls", request);
        const outgoing = client.call(type, id, { reuseInstance: true });
        const group = type === groupCallType;
        const { call } = await outgoing.get({ ring: !group || ring === true, video: (mode ?? request.mode) === "video" });
        if (group) {
          if (request.mode === "audio") await outgoing.camera.disable();
          if (!ring && !outgoing.ringing) await outgoing.accept().catch(() => undefined);
          await outgoing.join();
        }
        const activity = conversationCallActivity(call, call.session?.started_at ?? call.created_at);
        if (activity) onActivity([activity]);
      } catch (error) {
        setNotice({ error: true, text: error instanceof Error ? error.message : "Could not start the call." });
      } finally {
        sending.current = false;
        setDialing(false);
        onHandled();
      }
    });
  }, [request, client, current, onHandled, onActivity]);

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

export default function FamilyChatCalls({ userId, request, threadId, groupThread, onMissed, onActivity, onDeparted, onGroupStatus, onHandled, onReady, onBusy }: {
  userId: string;
  request: CallRequest | null;
  threadId: string | null;
  onMissed: (items: MissedCall[]) => void;
  onActivity: (items: ConversationCallActivity[]) => void;
  groupThread: boolean;
  onDeparted: (entry: GroupCallDeparture) => void;
  onGroupStatus: (status: { threadId: string; mode: "audio" | "video" | null }) => void;
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
      <CallSession client={client} request={request} threadId={threadId} groupThread={groupThread} onMissed={onMissed} onActivity={onActivity}
        onDeparted={onDeparted} onGroupStatus={onGroupStatus} onHandled={onHandled} onBusy={onBusy} />
    </StreamVideo>
  );
}
