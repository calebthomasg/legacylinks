"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, PropsWithChildren } from "react";
import type { SharedFile } from "./chatFiles";
import type { ChatMessage } from "./useChatHistory";
import { chatReactions, type ReactionKey } from "./messageInteractions";

export function MessagePress({ children, onOpen }: PropsWithChildren<{ onOpen: () => void }>) {
  const press = useRef<{ timer: number; x: number; y: number } | null>(null);
  const lastOpened = useRef(0);

  function cancelPress() {
    if (press.current) window.clearTimeout(press.current.timer);
    press.current = null;
  }

  useEffect(() => () => { if (press.current) window.clearTimeout(press.current.timer); }, []);

  function open() {
    cancelPress();
    lastOpened.current = Date.now();
    onOpen();
  }

  return <div className="group relative touch-pan-y [-webkit-touch-callout:none] [@media(pointer:coarse)]:select-none"
    onPointerDown={(event) => {
      if (event.pointerType !== "touch" || !event.isPrimary) return;
      cancelPress();
      press.current = { timer: window.setTimeout(open, 450), x: event.clientX, y: event.clientY };
    }}
    onPointerMove={(event) => {
      if (press.current && Math.hypot(event.clientX - press.current.x, event.clientY - press.current.y) > 10) cancelPress();
    }}
    onPointerUp={cancelPress} onPointerCancel={cancelPress} onPointerLeave={cancelPress}
    onContextMenu={(event) => {
      event.preventDefault();
      if (Date.now() - lastOpened.current > 800) open();
    }}
    onClickCapture={(event) => {
      if (Date.now() - lastOpened.current < 650) {
        event.preventDefault();
        event.stopPropagation();
      }
    }}>
    {children}
    <button type="button" aria-label="Message actions" aria-haspopup="dialog" onClick={open}
      className="pointer-events-none absolute -top-5 right-0 z-10 grid size-9 place-items-center rounded-lg border border-night-sky/10 bg-white text-lg font-black text-night-sky opacity-0 shadow-sm focus-visible:pointer-events-auto focus-visible:opacity-100 [@media(hover:hover)]:group-hover:pointer-events-auto [@media(hover:hover)]:group-hover:opacity-100">
      <span aria-hidden="true">···</span>
    </button>
  </div>;
}

export function MessageQuote({ message, file, compact = false }: {
  message?: ChatMessage; file?: SharedFile; compact?: boolean;
}) {
  if (!message || message.removed_for_everyone) return <span className="block text-sm italic text-night-sky/70">{message ? "Message removed" : "Original message unavailable"}</span>;
  const thumbnail = file?.url && file.mime_type.startsWith("image/");
  const summary = file?.mime_type.startsWith("image/") ? mediaCaption(message, file) || "Photo"
    : file?.mime_type.startsWith("video/") ? mediaCaption(message, file) || "Video"
    : file?.file_name ?? message.body;
  return <span className="flex min-w-0 items-center gap-2">
    <span className={`min-w-0 flex-1 break-words text-sm ${compact ? "truncate" : "line-clamp-3"}`}>{summary}</span>
    {thumbnail && (
      // eslint-disable-next-line @next/next/no-img-element
      <img alt="" src={file.url} className={`shrink-0 rounded-lg object-cover ${compact ? "size-9" : "size-16"}`} />
    )}
    {file?.url && file.mime_type.startsWith("video/") && <video aria-hidden="true" src={file.url} muted playsInline preload="metadata" className={`shrink-0 rounded-lg bg-night-sky object-cover ${compact ? "size-9" : "size-16"}`} />}
  </span>;
}

function mediaCaption(message: ChatMessage, file: SharedFile) {
  return message.body === `Shared ${file.file_name}` ? "" : message.body;
}

export function MessageActionIcon({ name }: { name: "reply" | "pin" | "delete" }) {
  const paths = {
    reply: "m9 4-6 6 6 6m-6-6h10a6 6 0 0 1 6 6v3",
    pin: "m15 3 6 6-3 2-2 5-3 3-8-8 3-3 5-2 2-3ZM10 14l-7 7",
    delete: "M4 7h16m-14 0 1 13h10l1-13m-9 0V4h6v3m-5 4v5m4-5v5",
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={paths[name]} />
  </svg>;
}

function SelectedMessage({ message, file, style, ownMessage }: {
  message: ChatMessage; file?: SharedFile; style?: CSSProperties; ownMessage: boolean;
}) {
  const photo = file?.mime_type.startsWith("image/");
  const video = file?.mime_type.startsWith("video/");
  if (file && (photo || video)) {
    const caption = mediaCaption(message, file);
    return <div className={`flex w-fit max-w-full flex-col gap-1.5 ${ownMessage ? "self-end" : "self-start"}`}>
      {file.url && photo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={file.url} alt="Selected photo" className="block max-h-[min(35dvh,18rem)] max-w-full rounded-2xl object-contain shadow-lg sm:max-w-72" />
      )}
      {file.url && video && <video aria-label="Selected video" src={file.url} muted playsInline preload="metadata" className="block max-h-[min(35dvh,18rem)] max-w-full rounded-2xl bg-night-sky shadow-lg sm:max-w-72" />}
      {(!file.url || caption) && <p className="max-w-72 rounded-xl bg-white px-3 py-2 text-sm text-night-sky">{caption || (photo ? "Photo" : "Video")}</p>}
    </div>;
  }
  return <p style={style} className={`max-w-full whitespace-pre-wrap [overflow-wrap:anywhere] rounded-2xl px-4 py-2.5 text-base shadow-lg ${ownMessage ? "self-end bg-sky-depth text-white" : "self-start bg-white text-night-sky"}`}>
    <span className="line-clamp-5">{file?.file_name || message.body}</span>
  </p>;
}

export default function MessageActions({ message, file, ownMessage, style, pinned, reaction, onClose, onReply, onReact, onPin, onDelete }: {
  message: ChatMessage; file?: SharedFile; ownMessage: boolean; style?: CSSProperties; pinned: boolean; reaction?: ReactionKey;
  onClose: () => void; onReply: () => void; onReact: (key: ReactionKey | null) => Promise<boolean>;
  onPin: () => Promise<boolean>; onDelete: () => Promise<boolean>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const modal = dialog.current;
    modal?.showModal();
    return () => modal?.close();
  }, []);

  async function perform(action: () => Promise<boolean>) {
    setError("");
    setBusy(true);
    try {
      if (await action()) dialog.current?.close();
      else setError("We couldn’t update this message. Try again.");
    } catch {
      setError("We couldn’t update this message. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const close = () => dialog.current?.close();
  const rowClass = "flex min-h-12 w-full items-center justify-between gap-3 px-4 text-left text-sm font-bold hover:bg-sky/10 focus-visible:z-10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-sky-depth disabled:opacity-50";

  return <dialog ref={dialog} aria-label={confirmDelete ? "Delete your message?" : "Message actions"} onClose={onClose}
    className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none overflow-y-auto bg-transparent p-0 text-night-sky backdrop:bg-night-sky/70 backdrop:backdrop-blur-sm">
    <div className="flex min-h-full flex-col px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]"
      onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
      {confirmDelete ? <section className="m-auto w-full max-w-xs space-y-4 rounded-2xl bg-white p-5 shadow-xl">
        <h2 className="text-lg font-black">Delete your message?</h2>
        <p className="text-sm">Everyone in the chat will see “Message removed” in its place.</p>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex gap-2">
          <button type="button" disabled={busy} onClick={() => setConfirmDelete(false)} className="min-h-11 flex-1 rounded-xl bg-sand px-3 text-sm font-bold">Cancel</button>
          <button type="button" disabled={busy} onClick={() => void perform(onDelete)} className="min-h-11 flex-1 rounded-xl bg-red-700 px-3 text-sm font-bold text-white disabled:opacity-50">Delete message</button>
        </div>
      </section> : <section className={`relative m-auto flex w-fit max-w-full flex-col gap-2.5 ${ownMessage ? "items-end" : "items-start"}`}>
        <button type="button" aria-label="Close message actions" autoFocus onClick={close} className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:-top-11 focus-visible:right-0 focus-visible:grid focus-visible:size-10 focus-visible:place-items-center focus-visible:rounded-full focus-visible:bg-white focus-visible:text-xl">×</button>
        <div className="flex max-w-full rounded-full bg-sand px-1.5 py-1 shadow-lg" role="group" aria-label="Reactions">
          {chatReactions.map(({ key, emoji, label }) => <button key={key} type="button" aria-label={label} aria-pressed={reaction === key}
            disabled={busy} onClick={() => void perform(() => onReact(reaction === key ? null : key))}
            className={`grid h-11 w-11 min-w-0 shrink place-items-center rounded-full text-2xl leading-none hover:bg-white focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-sky-depth sm:size-12 ${reaction === key ? "bg-white ring-1 ring-inset ring-sky-depth" : ""}`}>{emoji}</button>)}
        </div>
        <SelectedMessage message={message} file={file} style={style} ownMessage={ownMessage} />
        <div className="relative w-48 max-w-full divide-y divide-night-sky/10 overflow-hidden rounded-2xl bg-white shadow-lg">
          <button type="button" disabled={busy} onClick={() => { close(); onReply(); }} className={rowClass}>Reply<MessageActionIcon name="reply" /></button>
          <button type="button" disabled={busy} onClick={() => void perform(onPin)} className={rowClass}>{pinned ? "Unpin" : "Pin"}<MessageActionIcon name="pin" /></button>
          {ownMessage && <button type="button" disabled={busy} onClick={() => { setError(""); setConfirmDelete(true); }} className={`${rowClass} text-red-700`}>Delete<MessageActionIcon name="delete" /></button>}
        </div>
        {error && <p role="alert" className="max-w-60 rounded-xl bg-white px-3 py-2 text-sm text-red-700">{error}</p>}
      </section>}
    </div>
  </dialog>;
}
