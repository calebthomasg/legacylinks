"use client";

import { useEffect, useRef, useState } from "react";
import {
  CallingState, SpeakerLayout, StreamCall, StreamTheme, StreamVideo, StreamVideoClient,
  ToggleAudioPublishingButton, ToggleVideoPublishingButton, useCalls, useCallStateHooks,
  type Call,
} from "@stream-io/video-react-sdk";
import "@stream-io/video-react-sdk/dist/css/styles.css";

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

function CallPanel({ call }: { call: Call }) {
  const { useCallCallingState, useCallCreatedBy, useCallMembers } = useCallStateHooks();
  const state = useCallCallingState();
  const creator = useCallCreatedBy();
  const members = useCallMembers();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const audio = call.type === "family_audio";
  const ringing = state === CallingState.RINGING;
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
              : connected ? other?.name || "Call connected" : "Connecting…"}
      </p>
      {connected && (
        <StreamTheme>
          <div className={audio ? "sr-only" : "aspect-video overflow-hidden rounded-2xl bg-night-sky"}>
            <SpeakerLayout />
          </div>
          <div className="mt-4 flex items-center gap-3">
            <ToggleAudioPublishingButton />
            {!audio && <ToggleVideoPublishingButton />}
          </div>
        </StreamTheme>
      )}
      {error && <p role="alert" className="my-3 text-sm text-red-700">{error}</p>}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        {incoming && <button type="button" disabled={pending}
          className="rounded-full bg-night-sky px-4 py-2 font-bold text-white"
          onClick={() => void act(() => call.join(), "Could not connect. Check your browser’s microphone and camera permissions.")}>
          Accept
        </button>}
        <button type="button" disabled={pending}
          className="rounded-full bg-red-700 px-4 py-2 font-bold text-white"
          onClick={() => void act(async () => {
            if (ringing) {
              await call.leave({ reject: true, reason: incoming ? "decline" : "cancel" });
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

function CallSession({ client, request, onHandled, onBusy }: {
  client: StreamVideoClient;
  request: CallRequest | null;
  onHandled: () => void;
  onBusy: (busy: boolean) => void;
}) {
  const calls = useCalls();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [dialing, setDialing] = useState(false);
  const sending = useRef(false);
  const current = calls.find((call) => (
    (call.type === "family_audio" || call.type === "family_video") &&
    call.state.callingState !== CallingState.IDLE &&
    call.state.callingState !== CallingState.LEFT
  ));

  useEffect(() => {
    onBusy(Boolean(current) || dialing);
  }, [current, dialing, onBusy]);

  useEffect(() => {
    return client.on("call.missed", (event) => {
      if (event.call.type === "family_audio" || event.call.type === "family_video") {
        setNotice({ text: "Missed Family Chat call." });
      }
    });
  }, [client]);

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
        await post("/api/family-chat/calls", request);
      } catch (error) {
        setNotice({ error: true, text: (error as Error).message });
      } finally {
        sending.current = false;
        setDialing(false);
        onHandled();
      }
    });
  }, [request, current, onHandled]);

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
      {current && <StreamCall call={current}><CallPanel key={current.cid} call={current} /></StreamCall>}
    </>
  );
}

export default function FamilyChatCalls({ userId, request, onHandled, onReady, onBusy }: {
  userId: string;
  request: CallRequest | null;
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
      <CallSession client={client} request={request} onHandled={onHandled} onBusy={onBusy} />
    </StreamVideo>
  );
}
