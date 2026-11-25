"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";

type ActivityClient = ReturnType<typeof createClient>;
type Activity = { user_id: string; typing: boolean };

let activitySession: string | undefined;

function updateActivity(client: ActivityClient, action: string, threadId?: string) {
  activitySession ??= crypto.randomUUID();
  return client.rpc("set_chat_activity", {
    activity_session: activitySession,
    action,
    typing_thread: threadId ?? null,
  });
}

export function ChatPresenceHeartbeat() {
  useEffect(() => {
    const client = createClient();
    const pulse = () => {
      if (!document.hidden && navigator.onLine) {
        void updateActivity(client, "heartbeat").then(() => undefined);
      }
    };
    const leave = () => {
      void updateActivity(client, "leave").then(() => undefined);
    };
    const onVisibility = () => {
      if (document.hidden) leave();
      else pulse();
    };

    pulse();
    const timer = window.setInterval(pulse, 15_000);
    window.addEventListener("online", pulse);
    window.addEventListener("pagehide", leave);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("online", pulse);
      window.removeEventListener("pagehide", leave);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return null;
}

export function useChatActivity(client: ActivityClient, threadId: string | null) {
  const [snapshot, setSnapshot] = useState<{
    threadId: string | null;
    rows: Activity[];
  } | null>(null);
  const lastTyping = useRef(0);
  const typingSignal = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let active = true;
    let reading = false;
    async function read() {
      if (reading || document.hidden || !navigator.onLine) return;
      reading = true;
      try {
        const { data, error } = await client.rpc("read_chat_activity", {
          selected_thread: threadId,
        });
        if (active) setSnapshot({ threadId, rows: error ? [] : (data as Activity[]) ?? [] });
      } finally {
        reading = false;
      }
    }
    const onOffline = () => setSnapshot(null);
    const timer = window.setInterval(() => void read(), 2_000);
    window.addEventListener("online", read);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", read);
    void read();
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("online", read);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", read);
    };
  }, [client, threadId]);

  const signal = useCallback((action: "typing" | "stop") => {
    if (!threadId || !navigator.onLine || (action === "typing" && document.hidden)) return;
    const now = Date.now();
    if (action === "typing" && now - lastTyping.current < 1_500) return;
    lastTyping.current = action === "typing" ? now : 0;
    typingSignal.current = typingSignal.current.then(async () => {
      await updateActivity(client, action, threadId);
    }).catch(() => undefined);
  }, [client, threadId]);

  useEffect(() => () => signal("stop"), [signal]);

  const online = new Set(snapshot?.rows.map((row) => row.user_id));
  const typing = new Set(snapshot?.threadId === threadId
    ? snapshot?.rows.filter((row) => row.typing).map((row) => row.user_id)
    : []);

  return { online, typing, signal };
}
