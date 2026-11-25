"use client";

import { useEffect, useState } from "react";
import type { createClient } from "@/utils/supabase/client";
import type { ChatMessage } from "./useChatHistory";

type Client = ReturnType<typeof createClient>;

export const chatReactions = [
  { key: "heart", emoji: "❤️", label: "Heart" },
  { key: "laugh", emoji: "😆", label: "Laugh" },
  { key: "wow", emoji: "😮", label: "Surprised" },
  { key: "sad", emoji: "😢", label: "Crying" },
  { key: "angry", emoji: "😠", label: "Angry" },
  { key: "like", emoji: "👍", label: "Thumbs up" },
] as const;

export type ReactionKey = (typeof chatReactions)[number]["key"];
type Reaction = { message_id: string; user_id: string; reaction: ReactionKey };

export function useMessageInteractions(client: Client, threadId: string | null, messageIds: string, replyIds: string, revision: number) {
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [targets, setTargets] = useState<Record<string, ChatMessage>>({});

  useEffect(() => {
    if (!threadId || !messageIds) return;
    let active = true;
    const ids = messageIds.split(",");
    async function load() {
      const next: Reaction[] = [];
      for (let i = 0; active && i < ids.length; i += 30) {
        let offset = 0;
        while (active) {
          const { data, error } = await client.from("chat_message_reactions").select("message_id,user_id,reaction")
            .eq("thread_id", threadId).in("message_id", ids.slice(i, i + 30)).not("reaction", "is", null)
            .order("message_id").order("user_id").range(offset, offset + 499);
          if (error) return;
          next.push(...(data as Reaction[]));
          if (data.length < 500) break;
          offset += 500;
        }
      }
      if (active) setReactions(next);
    }
    void load();
    return () => { active = false; };
  }, [client, messageIds, revision, threadId]);

  useEffect(() => {
    if (!threadId || !replyIds) return;
    let active = true;
    const ids = replyIds.split(",");
    async function load() {
      const next: Record<string, ChatMessage> = {};
      for (let i = 0; active && i < ids.length; i += 50) {
        const { data, error } = await client.from("chat_messages")
          .select("id,thread_id,sender_user_id,body,created_at,reply_to_id,removed_for_everyone")
          .eq("thread_id", threadId).in("id", ids.slice(i, i + 50));
        if (error) return;
        for (const row of data as ChatMessage[]) next[row.id] = row;
      }
      if (active) setTargets(next);
    }
    void load();
    return () => { active = false; };
  }, [client, replyIds, revision, threadId]);

  const byMessage = new Map<string, Reaction[]>();
  for (const reaction of reactions) {
    const group = byMessage.get(reaction.message_id) ?? [];
    group.push(reaction);
    byMessage.set(reaction.message_id, group);
  }
  return { reactions: byMessage, targets };
}
