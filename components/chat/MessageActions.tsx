"use client";

import { useEffect, useRef, useState } from "react";
import type { PropsWithChildren } from "react";
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
  const summary = file ? file.file_name : message.body;
  return <span className="flex min-w-0 items-center gap-2">
    <span className={`min-w-0 flex-1 break-words text-sm ${compact ? "truncate" : "line-clamp-3"}`}>{summary}</span>
    {thumbnail && (
      // eslint-disable-next-line @next/next/no-img-element
      <img alt="" src={file.url} className={`shrink-0 rounded-lg object-cover ${compact ? "size-9" : "size-16"}`} />
    )}
    {file?.url && file.mime_type.startsWith("video/") && <video aria-hidden="true" src={file.url} muted playsInline preload="metadata" className={`shrink-0 rounded-lg bg-night-sky object-cover ${compact ? "size-9" : "size-16"}`} />}
  </span>;
}

export default function MessageActions({ message, file, ownMessage, sender, pinned, reaction, onClose, onReply, onReact, onPin, onDelete }: {
  message: ChatMessage; file?: SharedFile; ownMessage: boolean; sender: string; pinned: boolean; reaction?: ReactionKey;
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

  return <dialog ref={dialog} aria-labelledby="message-actions-title" onClose={onClose}
    onClick={(event) => { if (event.target === event.currentTarget) event.currentTarget.close(); }}
    className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[90dvh] w-full max-w-none overflow-y-auto rounded-t-3xl bg-white p-0 text-night-sky shadow-xl backdrop:bg-night-sky/50 sm:inset-0 sm:m-auto sm:max-w-sm sm:rounded-3xl">
    <section className="space-y-3 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <header className="flex items-center justify-between">
        <h2 id="message-actions-title" className="text-base font-black">{confirmDelete ? "Delete your message?" : "Message actions"}</h2>
        <button type="button" aria-label="Close message actions" onClick={() => dialog.current?.close()} className="grid size-10 place-items-center rounded-full bg-sand text-xl">×</button>
      </header>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {confirmDelete ? <>
        <p className="text-sm">Everyone in the chat will see “Message removed” in its place.</p>
        <div className="flex gap-3">
          <button type="button" disabled={busy} onClick={() => setConfirmDelete(false)} className="min-h-12 flex-1 rounded-xl bg-sand px-3 font-bold">Cancel</button>
          <button type="button" disabled={busy} onClick={() => void perform(onDelete)} className="min-h-12 flex-1 rounded-xl bg-red-700 px-3 font-bold text-white disabled:opacity-50">Delete message</button>
        </div>
      </> : <>
        <div className="grid grid-cols-6 gap-0.5 rounded-2xl bg-sand p-1" role="group" aria-label="Reactions">
          {chatReactions.map(({ key, emoji, label }) => <button key={key} type="button" aria-label={label} aria-pressed={reaction === key}
            disabled={busy} onClick={() => void perform(() => onReact(reaction === key ? null : key))}
            className={`min-h-11 rounded-xl text-2xl hover:bg-white ${reaction === key ? "bg-white ring-1 ring-sky-depth" : ""}`}>{emoji}</button>)}
        </div>
        <div className="rounded-xl border border-night-sky/10 bg-sand/50 px-3 py-2">
          <p className="mb-1 text-xs font-bold text-night-sky/70">{sender}</p><MessageQuote message={message} file={file} />
        </div>
        <div className="divide-y divide-night-sky/10 overflow-hidden rounded-xl border border-night-sky/10">
          <button type="button" disabled={busy} onClick={() => { dialog.current?.close(); onReply(); }} className="flex min-h-12 w-full items-center px-4 font-bold hover:bg-sand">Reply</button>
          <button type="button" disabled={busy} onClick={() => void perform(onPin)} className="flex min-h-12 w-full items-center px-4 font-bold hover:bg-sand">{pinned ? "Unpin message" : "Pin message"}</button>
          {ownMessage && <button type="button" disabled={busy} onClick={() => setConfirmDelete(true)} className="flex min-h-12 w-full items-center px-4 font-bold text-red-700 hover:bg-sand">Delete</button>}
        </div>
      </>}
    </section>
  </dialog>;
}
