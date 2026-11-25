"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";

export type ChatMessage = {
  id: string;
  thread_id: string;
  sender_user_id: string;
  body: string;
  created_at: string;
  reply_to_id: string | null;
  removed_for_everyone: boolean;
};

type Cursor = Pick<ChatMessage, "id" | "created_at">;
type History = {
  threadId: string;
  rows: ChatMessage[];
  cursor: Cursor | null;
  loaded: boolean;
  latestSynced: Cursor | null;
  error: string | null;
};

const pageSize = 50;

function emptyHistory(threadId: string): History {
  return { threadId, rows: [], cursor: null, latestSynced: null, loaded: false, error: null };
}

function mergeMessages(first: ChatMessage[], second: ChatMessage[]) {
  const messages = new Map(first.map((message) => [message.id, message]));
  for (const message of second) {
    if (!messages.get(message.id)?.removed_for_everyone) messages.set(message.id, message);
  }
  return [...messages.values()].sort((a, b) =>
    a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)
  );
}

export function useChatHistory(client: ReturnType<typeof createClient>, threadId: string | null) {
  const [history, setHistory] = useState<History | null>(null);
  const [loadingOlderId, setLoadingOlderId] = useState<string | null>(null);
  const generation = useRef(0);
  const activeThread = useRef(threadId);
  const olderRequest = useRef<object | null>(null);
  const latestRequest = useRef(0);
  const current = history?.threadId === threadId ? history : null;

  const readPage = useCallback(async (id: string, cursor: Cursor | null = null) => {
    const response = await client.rpc("read_chat_timeline", {
      thread_uuid: id,
      before_created_at: cursor?.created_at ?? null,
      before_id: cursor?.id ?? null,
    });
    if (response.error) throw response.error;
    const result = (response.data ?? []) as ChatMessage[];
    const page = result.slice(0, pageSize);
    return {
      rows: page.reverse(),
      cursor: result.length > pageSize ? page[0] : null,
    };
  }, [client]);

  const refresh = useCallback(async () => {
    if (!threadId) return;
    const requestGeneration = generation.current;
    const request = ++latestRequest.current;
    try {
      const page = await readPage(threadId);
      if (requestGeneration !== generation.current || request !== latestRequest.current) return;
      setHistory((previous) => {
        const existing = previous?.threadId === threadId ? previous : emptyHistory(threadId);
        const serverIds = new Set(page.rows.map((row) => row.id));
        const overlap = existing.latestSynced !== null && serverIds.has(existing.latestSynced.id);
        // When reconnect missed more than one page, restart at the complete
        // latest page so a gap can never look like a continuous timeline.
        const oldest = page.rows[0];
        const newerEvents = oldest
          ? existing.rows.filter((row) => row.created_at >= oldest.created_at)
          : existing.loaded ? [] : existing.rows;
        const retained = overlap ? existing.rows : newerEvents;
        return {
          threadId,
          rows: mergeMessages(retained, page.rows),
          cursor: overlap && existing.loaded ? existing.cursor : page.cursor,
          latestSynced: page.rows.at(-1) ?? null,
          loaded: true,
          error: null,
        };
      });
    } catch {
      if (requestGeneration !== generation.current || request !== latestRequest.current) return;
      setHistory((previous) => ({
        ...(previous?.threadId === threadId ? previous : emptyHistory(threadId)),
        error: "We couldn’t refresh this conversation. Please try again.",
      }));
    }
  }, [readPage, threadId]);

  useLayoutEffect(() => { activeThread.current = threadId; }, [threadId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => {
      window.clearTimeout(timer);
      generation.current += 1;
      olderRequest.current = null;
    };
  }, [refresh]);

  const append = useCallback((message: ChatMessage) => {
    if (message.thread_id !== activeThread.current) return;
    setHistory((previous) => {
      const id = message.thread_id;
      const existing = previous?.threadId === id ? previous : emptyHistory(id);
      return { ...existing, rows: mergeMessages(existing.rows, [message]) };
    });
  }, []);

  const replace = useCallback((message: ChatMessage) => {
    if (message.thread_id !== activeThread.current) return;
    setHistory((previous) => previous?.threadId === message.thread_id && previous.rows.some((item) => item.id === message.id)
      ? { ...previous, rows: mergeMessages(previous.rows, [message]) }
      : previous);
  }, []);

  async function loadOlder() {
    if (!threadId || !current?.cursor || olderRequest.current) return false;
    const requestGeneration = generation.current;
    const request = {};
    olderRequest.current = request;
    setLoadingOlderId(threadId);
    try {
      const page = await readPage(threadId, current.cursor);
      if (requestGeneration !== generation.current) return false;
      setHistory((previous) => {
        if (previous?.threadId !== threadId || previous.cursor?.id !== current.cursor?.id) return previous;
        return { ...previous, rows: mergeMessages(previous.rows, page.rows), cursor: page.cursor, error: null };
      });
      return true;
    } catch {
      if (requestGeneration === generation.current) {
        setHistory((previous) => previous?.threadId === threadId
          ? { ...previous, error: "We couldn’t load older messages. Please try again." }
          : previous);
      }
      return false;
    } finally {
      if (olderRequest.current === request) {
        olderRequest.current = null;
        setLoadingOlderId(null);
      }
    }
  }

  return {
    messages: current?.rows ?? [],
    loading: Boolean(threadId && !current?.loaded && !current?.error),
    error: current?.error ?? null,
    hasOlder: Boolean(current?.cursor),
    loadingOlder: Boolean(threadId && loadingOlderId === threadId && current?.cursor),
    append,
    replace,
    refresh,
    loadOlder,
  };
}
