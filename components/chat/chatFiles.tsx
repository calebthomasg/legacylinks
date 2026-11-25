"use client";

import { useEffect, useState } from "react";
import type { createClient } from "@/utils/supabase/client";

type Client = ReturnType<typeof createClient>;
export const chatFilesBucket = "family-chat-private";
export const photoTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const videoTypes = ["video/mp4", "video/quicktime", "video/webm"];
export const documentTypes = [
  "application/pdf", "text/plain", "application/zip",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
export const chatFileAccept = [...photoTypes, ...videoTypes, ...documentTypes].join(",");

export type SharedFile = {
  message_id: string;
  object_path: string;
  file_name: string;
  mime_type: string;
  created_at: string;
  url?: string;
};

export async function uploadChatFile(client: Client, thread: string, user: string, kind: "group" | "file", file: File, objectId = crypto.randomUUID()) {
  const types = kind === "group" ? photoTypes : [...photoTypes, ...videoTypes, ...documentTypes];
  if (!types.includes(file.type) || !file.size || file.size > 20 * 1024 * 1024) {
    throw new Error(kind === "group"
      ? "Choose a JPEG, PNG, WebP, or GIF under 20 MB."
      : "Choose a supported photo, video, or document under 20 MB.");
  }
  const path = `${thread}/${kind}/${user}/${objectId}`;
  const { error } = await client.storage.from(chatFilesBucket).upload(path, file, { contentType: file.type });
  if (error) throw new Error("We couldn’t upload that file. Please try again.");
  return path;
}

export async function signChatFiles(client: Client, rows: SharedFile[]) {
  if (!rows.length) return rows;
  const { data } = await client.storage.from(chatFilesBucket).createSignedUrls(rows.map((row) => row.object_path), 600);
  const links = new Map((data ?? []).map((row) => [row.path, row.signedUrl]));
  return rows.map((row) => ({ ...row, url: links.get(row.object_path) || undefined }));
}

export function useMessageFiles(client: Client, threadId: string | null, messageKey: string, revision: number) {
  const [files, setFiles] = useState<Record<string, SharedFile>>({});
  useEffect(() => {
    if (!threadId || !messageKey) return;
    let active = true;
    async function refresh() {
      const ids = messageKey.split(",");
      for (let i = 0; i < ids.length && active; i += 50) {
        const { data } = await client.from("chat_shared_files")
          .select("message_id,object_path,file_name,mime_type,created_at")
          .eq("thread_id", threadId).in("message_id", ids.slice(i, i + 50));
        const rows = await signChatFiles(client, (data ?? []) as SharedFile[]);
        if (active && rows.length) {
          setFiles((previous) => ({ ...previous, ...Object.fromEntries(rows.map((row) => [row.message_id, row])) }));
        }
      }
    }
    void refresh();
    const interval = window.setInterval(() => void refresh(), 480_000);
    return () => { active = false; window.clearInterval(interval); };
  }, [client, messageKey, revision, threadId]);
  return files;
}

export function ChatFile({ file, tile = false }: { file: SharedFile; tile?: boolean }) {
  if (!file.url) return <span className="break-all text-sm">{file.file_name}</span>;
  if (file.mime_type.startsWith("image/")) {
    return (
      <a href={file.url} target="_blank" rel="noreferrer" className="block">
        {/* Signed member-only image URLs are served directly from private storage. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={file.url} alt={file.file_name} loading="lazy" className={tile ? "aspect-square w-full rounded-lg object-cover" : "max-h-64 max-w-full rounded-xl object-contain"} />
      </a>
    );
  }
  if (file.mime_type.startsWith("video/")) {
    return <video src={file.url} aria-label={file.file_name} controls playsInline preload="metadata" className={tile ? "aspect-square w-full rounded-lg bg-night-sky object-cover" : "max-h-64 max-w-full rounded-xl"} />;
  }
  return <a className="block break-words text-sm font-semibold underline" href={file.url} target="_blank" rel="noreferrer">{file.file_name}</a>;
}
