"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent, ReactNode } from "react";
import type { createClient } from "@/utils/supabase/client";
import type { ChatThreadSummary } from "./FamilyChatShell";
import type { ChatMessage } from "./useChatHistory";
import { ChatFile, chatFilesBucket, photoTypes, signChatFiles, uploadChatFile, videoTypes } from "./chatFiles";
import type { SharedFile } from "./chatFiles";

type Page = "details" | "edit" | "members" | "nicknames" | "search" | "gallery" | "notifications" | "pins" | "receipts" | "typing" | "report" | "context";
type Privacy = { show_typing: boolean; show_read_receipts: boolean };
type GalleryTab = "Media" | "Links" | "Files";
type LinkItem = { message_id: string; url: string };

const titles: Record<Page, string> = {
  details: "Group details", edit: "Group name and image", members: "Group members",
  nicknames: "Nicknames", search: "Search conversation", gallery: "Media, links, and files",
  notifications: "Notifications & sounds", pins: "Pinned messages", receipts: "Read receipts",
  typing: "Typing indicator", report: "Report a Family Chat issue", context: "Message in conversation",
};
const galleryPageSize = 30;
const mediaTypes = [...photoTypes, ...videoTypes];
const fieldClass = "w-full rounded-xl border border-night-sky/15 px-3 py-2 text-base";
const buttonClass = "rounded-xl bg-night-sky px-4 py-2 text-sm font-bold text-white disabled:opacity-50";
const cardClass = "overflow-hidden rounded-xl border border-night-sky/10 bg-white";
const sectionClass = "mb-2 text-sm font-bold text-night-sky/70";

function Row({ label, value, onClick, danger = false, disabled = false }: {
  label: string; value?: string; onClick?: () => void; danger?: boolean; disabled?: boolean;
}) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={`flex min-h-12 w-full items-center justify-between gap-4 border-b border-night-sky/10 px-4 py-2 text-left text-sm font-semibold last:border-0 hover:bg-sand/40 disabled:cursor-default disabled:opacity-60 ${danger ? "text-red-700" : ""}`}>
      <span>{label}</span>
      {value && <span className="shrink-0 text-xs font-medium text-night-sky/60">{value}</span>}
      {!value && !danger && <span aria-hidden="true" className="text-lg text-sky-depth">›</span>}
    </button>
  );
}

export default function ChatGroupDetails({
  client, thread, currentUserId, privacy, online, filesRevision, onClose, onAdd, onLeave,
  leaving, leaveError, onRefresh, onPrivacyChange, onPin, avatar,
}: {
  client: ReturnType<typeof createClient>;
  thread: ChatThreadSummary;
  currentUserId: string;
  privacy: Privacy;
  online: Set<string>;
  filesRevision: number;
  onClose: () => void;
  onAdd: () => void;
  onLeave: () => void;
  leaving: boolean;
  leaveError: string | null;
  onRefresh: () => void;
  onPrivacyChange: (privacy: Privacy) => void;
  onPin: (id: string, pin: boolean) => Promise<boolean>;
  avatar: (member: ChatThreadSummary["members"][number], online: boolean) => ReactNode;
}) {
  const [page, setPage] = useState<Page>("details");
  const [previous, setPrevious] = useState<Page>("details");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [groupName, setGroupName] = useState(thread.name);
  const [groupImage, setGroupImage] = useState<File | null>(null);
  const [recent, setRecent] = useState<SharedFile[]>([]);
  const [gallery, setGallery] = useState<SharedFile[]>([]);
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [tab, setTab] = useState<GalleryTab>("Media");
  const [moreGallery, setMoreGallery] = useState(false);
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState("");
  const [matches, setMatches] = useState<ChatMessage[]>([]);
  const [linkedMessage, setLinkedMessage] = useState<string | null>(null);
  const [context, setContext] = useState<ChatMessage[]>([]);
  const [pins, setPins] = useState<ChatMessage[]>([]);
  const panel = useRef<HTMLDivElement>(null);
  const back = useRef<HTMLButtonElement>(null);
  const scrollArea = useRef<HTMLDivElement>(null);
  const threadId = thread.id;
  const latestFilesRevision = filesRevision;

  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    return () => trigger?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    back.current?.focus({ preventScroll: true });
    if (scrollArea.current) scrollArea.current.scrollTop = 0;
  }, [page]);

  useEffect(() => {
    let active = true;
    async function loadRecent() {
      const { data, error: problem } = await client.from("chat_shared_files")
        .select("message_id,object_path,file_name,mime_type,created_at")
        .eq("thread_id", threadId).in("mime_type", mediaTypes).order("created_at", { ascending: false }).limit(6);
      if (problem) { if (active) setError("We couldn’t load recent media."); return; }
      const rows = await signChatFiles(client, (data ?? []) as SharedFile[]);
      if (active) setRecent(rows);
    }
    void loadRecent();
    return () => { active = false; };
  }, [client, latestFilesRevision, threadId]);

  function go(next: Page) {
    setError("");
    setConfirmation("");
    setPage(next);
  }

  function goBack() {
    if (page === "details") onClose();
    else go(page === "context" ? previous : "details");
  }

  function handleKeys(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") { event.stopPropagation(); goBack(); return; }
    if (event.key !== "Tab") return;
    const elements = [...(panel.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled])'
    ) ?? [])].filter((element) => element.getClientRects().length);
    const first = elements[0];
    const last = elements.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }

  async function run(operation: () => Promise<void>, failure = "We couldn’t save that change. Try again.") {
    if (busy) return;
    setBusy(true);
    setError("");
    try { await operation(); }
    catch (problem) { setError(problem instanceof Error ? problem.message : failure); }
    finally { setBusy(false); }
  }

  function saveGroup(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const path = groupImage ? await uploadChatFile(client, threadId, currentUserId, "group", groupImage) : null;
      const { error: problem } = await client.rpc("save_chat_group", { thread_uuid: threadId, group_name: groupName.trim(), image_path: path });
      if (problem) {
        if (path) await client.storage.from(chatFilesBucket).remove([path]);
        throw problem;
      }
      if (path && thread.groupImagePath) await client.storage.from(chatFilesBucket).remove([thread.groupImagePath]);
      setGroupImage(null);
      onRefresh();
      go("details");
    });
  }

  function saveNickname(event: FormEvent<HTMLFormElement>, memberId: string) {
    event.preventDefault();
    const nickname = String(new FormData(event.currentTarget).get("nickname") ?? "");
    void run(async () => {
      const { error: problem } = await client.rpc("save_chat_nickname", { thread_uuid: threadId, member_uuid: memberId, new_nickname: nickname });
      if (problem) throw problem;
      setConfirmation("Nickname saved.");
      onRefresh();
    });
  }

  function savePrivacy(setting: "receipts" | "typing", enabled: boolean) {
    void run(async () => {
      const { error: problem } = await client.rpc("save_chat_privacy", { setting, enabled });
      if (problem) throw problem;
      onPrivacyChange({ ...privacy, [setting === "typing" ? "show_typing" : "show_read_receipts"]: enabled });
    });
  }

  function saveNotifications(mute: boolean, sounds: boolean) {
    void run(async () => {
      const { error: problem } = await client.rpc("save_chat_notification_settings", { thread_uuid: threadId, mute_chat: mute, sounds });
      if (problem) throw problem;
      onRefresh();
    });
  }

  async function loadGallery(next: GalleryTab, extend = false) {
    await run(async () => {
      if (next === "Links") {
        const offset = extend ? links.length : 0;
        const { data, error: problem } = await client.rpc("read_chat_links", { thread_uuid: threadId, page_offset: offset });
        if (problem) throw problem;
        const rows = (data ?? []) as LinkItem[];
        setLinks((old) => extend ? [...old, ...rows] : rows);
        setMoreGallery(rows.length === 60);
      } else {
        const offset = extend ? gallery.length : 0;
        const query = client.from("chat_shared_files").select("message_id,object_path,file_name,mime_type,created_at").eq("thread_id", threadId);
        const { data, error: problem } = await (next === "Media" ? query.in("mime_type", mediaTypes) : query.not("mime_type", "in", `(${mediaTypes.join(",")})`))
          .order("created_at", { ascending: false }).order("message_id", { ascending: false }).range(offset, offset + galleryPageSize - 1);
        if (problem) throw problem;
        const rows = await signChatFiles(client, (data ?? []) as SharedFile[]);
        setGallery((old) => extend ? [...old, ...rows] : rows);
        setMoreGallery(rows.length === galleryPageSize);
      }
    }, "We couldn’t load shared items.");
  }

  function showGallery(next: GalleryTab = "Media") {
    setTab(next);
    setGallery([]);
    setLinks([]);
    setMoreGallery(false);
    go("gallery");
    void loadGallery(next);
  }

  function search(extend = false) {
    const term = extend ? searched : query.trim();
    if (term.length < 2) return;
    void run(async () => {
      const { data, error: problem } = await client.rpc("search_chat_messages", {
        thread_uuid: threadId, search_text: term, page_offset: extend ? matches.length : 0,
      });
      if (problem) throw problem;
      setSearched(term);
      setMatches((old) => extend ? [...old, ...((data ?? []) as ChatMessage[])] : (data ?? []) as ChatMessage[]);
    }, "Search didn’t finish. Try again.");
  }

  function showContext(id: string) {
    setPrevious(page);
    setLinkedMessage(id);
    setContext([]);
    go("context");
    void run(async () => {
      const { data, error: problem } = await client.rpc("read_chat_message_context", { thread_uuid: threadId, message_uuid: id });
      if (problem) throw problem;
      setContext(((data ?? []) as ChatMessage[]).sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)));
    }, "We couldn’t load that message.");
  }

  function showPins() {
    go("pins");
    void run(async () => {
      const { data: result, error: problem } = await client.from("chat_pins").select("message_id").eq("thread_id", threadId).is("unpinned_at", null).order("pinned_at", { ascending: false }).limit(200);
      if (problem) throw problem;
      const ids = (result ?? []).map((row) => row.message_id);
      if (!ids.length) { setPins([]); return; }
      const { data, error } = await client.from("chat_messages").select("id,thread_id,sender_user_id,body,created_at").in("id", ids);
      if (error) throw error;
      const messages = new Map(((data ?? []) as ChatMessage[]).map((message) => [message.id, message]));
      setPins(ids.flatMap((id) => { const message = messages.get(id); return message ? [message] : []; }));
    }, "We couldn’t load pinned messages.");
  }

  function reportIssue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const issue = String(new FormData(form).get("issue") ?? "").trim();
    if (!issue) return;
    void run(async () => {
      const { error: problem } = await client.rpc("report_chat_issue", { thread_uuid: threadId, issue_description: issue });
      if (problem) throw problem;
      form.reset();
      setConfirmation("Your Family Chat report was submitted.");
    });
  }

  function messageRow(message: ChatMessage, contextMode = false) {
    const sender = [...thread.members, ...thread.pastMembers].find((member) => member.userId === message.sender_user_id);
    return (
      <div key={message.id} className={`border-b border-night-sky/10 px-3 py-2.5 last:border-0 ${message.id === linkedMessage && contextMode ? "bg-sky/15" : ""}`}>
        <button disabled={contextMode} type="button" className="block w-full text-left" onClick={() => showContext(message.id)}>
          <span className="block text-xs text-night-sky/60">{sender?.nickname || sender?.displayName || "Family member"} · {new Date(message.created_at).toLocaleDateString()}</span>
          <span className="block whitespace-pre-wrap break-words text-sm">{message.body}</span>
        </button>
        {page === "pins" && <button type="button" className="mt-1 text-xs font-semibold text-sky-depth underline" onClick={() => void run(async () => {
          if (!await onPin(message.id, false)) throw new Error("We couldn’t unpin that message.");
          setPins((old) => old.filter((item) => item.id !== message.id));
        })}>Unpin</button>}
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-50 lg:fixed">
      <button type="button" aria-label="Close group details" className="absolute inset-0 hidden bg-night-sky/25 lg:block" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby="chat-group-panel-title" ref={panel} onKeyDown={handleKeys} className="chat-details-slide absolute inset-y-0 right-0 flex w-full flex-col bg-sand/100 shadow-xl lg:w-[min(100%,27rem)]">
        <div className="flex min-h-14 shrink-0 items-center gap-2 border-b border-night-sky/10 bg-white px-3">
          <button ref={back} type="button" onClick={goBack} className="grid h-10 w-10 place-items-center rounded-lg text-2xl hover:bg-sand" aria-label={page === "details" ? "Back to conversation" : "Back to group details"}>‹</button>
          <h2 id="chat-group-panel-title" className="min-w-0 truncate text-base font-black">{page === "details" && thread.threadType === "direct" ? "Chat details" : titles[page]}</h2>
        </div>
        <div key={page} ref={scrollArea} className="chat-details-slide min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-4">
          {error && <p role="alert" className="rounded-lg bg-coral/10 p-2 text-sm text-red-800">{error}</p>}
          {confirmation && <p role="status" className="rounded-lg bg-sky/10 p-2 text-sm">{confirmation}</p>}
          {page === "details" && <>
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-2xl bg-sky/20 text-2xl font-black text-night-sky">
                {thread.groupImageUrl
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={thread.groupImageUrl} alt="" className="h-full w-full object-cover" />
                  : thread.name.trim().split(/\s+/).slice(0,2).map((word) => word[0]).join("").toUpperCase()}
              </div>
              <h3 className="max-w-full text-xl font-black [overflow-wrap:anywhere]">{thread.name}</h3>
              {thread.canAddMembers && <button type="button" className="text-sm font-bold text-sky-depth underline" onClick={() => { setGroupName(thread.name); go("edit"); }}>Change name or image</button>}
            </div>
            <div className="flex flex-wrap gap-2">
              {thread.canAddMembers && <button type="button" className={buttonClass} onClick={onAdd}>Add members</button>}
              <button type="button" className={buttonClass} onClick={() => go("nicknames")}>Nicknames</button>
              <button type="button" className={buttonClass} onClick={() => go("search")}>Search</button>
              <button type="button" className={buttonClass} disabled>Customize · Soon</button>
            </div>
            <section>
              <div className="flex items-center justify-between"><h3 className={sectionClass}>{thread.memberCount} members</h3>
                {thread.members.length > 4 && <button type="button" className="mb-2 text-sm font-bold text-sky-depth" onClick={() => go("members")}>See all</button>}
              </div>
              <div className="grid grid-cols-4 gap-2 rounded-xl bg-white px-2 py-3">
                {thread.members.slice(0,4).map((member) => <div key={member.userId} className="min-w-0 text-center">
                  {avatar(member, online.has(member.userId))}
                  <span className="mt-1 block truncate text-xs">{member.nickname || member.displayName}</span>
                </div>)}
              </div>
            </section>
            <section>
              <h3 className={sectionClass}>Shared in this chat</h3>
              <div className={cardClass}>
                {recent.length ? <div className="grid grid-cols-3 gap-1.5 p-2">{recent.map((file) => <ChatFile key={file.message_id} file={file} tile />)}</div>
                  : <p className="px-4 py-3 text-xs text-night-sky/65">Photos and videos will appear here after someone shares them.</p>}
                <Row label="Media, links, and files" onClick={() => showGallery()} />
              </div>
            </section>
            <section><h3 className={sectionClass}>Actions</h3><div className={cardClass}>
              <Row label={thread.muted ? "Unmute chat" : "Mute chat"} disabled={busy} onClick={() => saveNotifications(!thread.muted, thread.playSounds)} />
              <Row label="Notifications & sounds" onClick={() => go("notifications")} />
              <Row label="Pinned messages" onClick={showPins} />
            </div></section>
            <section><h3 className={sectionClass}>Privacy & support</h3><div className={cardClass}>
              <Row label="Read receipts" value={privacy.show_read_receipts ? "On" : "Off"} onClick={() => go("receipts")} />
              <Row label="Typing indicator" value={privacy.show_typing ? "On" : "Off"} onClick={() => go("typing")} />
              <Row label="Report a Family Chat issue" onClick={() => go("report")} />
              {thread.threadType === "group" && <Row label={leaving ? "Leaving…" : "Leave chat"} danger disabled={leaving} onClick={onLeave} />}
            </div>{leaveError && <p role="alert" className="mt-2 text-sm text-red-800">{leaveError}</p>}</section>
          </>}
          {page === "edit" && <form onSubmit={saveGroup} className="space-y-4">
            <label className="block text-sm font-semibold">Group name<input className={fieldClass} required maxLength={120} value={groupName} onChange={(event) => setGroupName(event.target.value)} /></label>
            <label className="block text-sm font-semibold">Group image<input className={fieldClass} type="file" accept={photoTypes.join(",")} onChange={(event) => setGroupImage(event.target.files?.[0] ?? null)} /></label>
            <button className={buttonClass} type="submit" disabled={busy || !groupName.trim()}>Save group details</button>
          </form>}
          {page === "members" && <section className="space-y-3">
            {thread.canAddMembers && <button type="button" className={buttonClass} onClick={onAdd}>Add members</button>}
            <ul className={cardClass}>{thread.members.map((member) => <li key={member.userId} className="flex items-center gap-3 border-b border-night-sky/10 p-3 last:border-0">
              {avatar(member, online.has(member.userId))}
              <span className="min-w-0"><span className="block truncate font-semibold">{member.nickname || member.displayName}</span>
                <span className="text-xs text-night-sky/65">{[member.userId === currentUserId ? "You" : online.has(member.userId) ? "Online" : "Offline", member.userId === thread.createdByUserId ? "Group creator" : ""].filter(Boolean).join(" · ")}</span></span>
            </li>)}</ul>
          </section>}
          {page === "nicknames" && <section className="space-y-3">
            <p className="text-sm text-night-sky/70">Nicknames are visible to everyone in this group.</p>
            {thread.members.map((member) => <form key={member.userId} onSubmit={(event) => saveNickname(event, member.userId)} className="flex items-end gap-2">
              <label className="min-w-0 flex-1 text-sm font-semibold">{member.displayName}<input name="nickname" className={fieldClass} defaultValue={member.nickname ?? ""} maxLength={40} placeholder="Nickname" /></label>
              <button type="submit" className={buttonClass} disabled={busy}>Save</button>
            </form>)}
          </section>}
          {page === "search" && <section className="space-y-3">
            <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); search(); }}>
              <input className={fieldClass} aria-label="Search messages" value={query} onChange={(event) => setQuery(event.target.value)} maxLength={120} placeholder="Search messages" />
              <button type="submit" className={buttonClass} disabled={busy || query.trim().length < 2}>Search</button>
            </form>
            {searched && !busy && !matches.length && <p className="text-sm">No matching messages.</p>}
            {matches.length > 0 && <div className={cardClass}>{matches.map((message) => messageRow(message))}</div>}
            {matches.length > 0 && matches.length % 40 === 0 && <button type="button" className={buttonClass} disabled={busy} onClick={() => search(true)}>More results</button>}
          </section>}
          {page === "context" && <div className={cardClass}>
            {!busy && !context.length && <p className="p-3 text-sm">This message is unavailable.</p>}
            {context.map((message) => messageRow(message, true))}
          </div>}
          {page === "gallery" && <section className="space-y-3">
            <div role="group" aria-label="Shared items" className="flex gap-2">
              {(["Media","Links","Files"] as const).map((item) => <button type="button" key={item} aria-pressed={tab === item} disabled={busy} onClick={() => showGallery(item)} className={`rounded-lg px-3 py-2 text-sm font-bold ${item === tab ? "bg-night-sky text-white" : "bg-white"}`}>{item}</button>)}
            </div>
            {tab === "Links" ? <div className="space-y-2">{links.map((item, index) => {
              let safe: URL;
              try { safe = new URL(item.url); } catch { return null; }
              if (safe.protocol !== "https:" && safe.protocol !== "http:") return null;
              return <a key={`${item.message_id}-${index}`} className="block break-all rounded-lg bg-white p-2 text-sm underline" href={safe.href} target="_blank" rel="noreferrer">{item.url}</a>;
            })}</div> : <div className={tab === "Media" ? "grid grid-cols-3 gap-2" : "space-y-3"}>
              {gallery.map((file) => <ChatFile key={file.message_id} file={file} tile={tab === "Media"} />)}
            </div>}
            {!busy && !(tab === "Links" ? links.length : gallery.length) && <p className="text-sm">Nothing has been shared here yet.</p>}
            {moreGallery && <button type="button" className={buttonClass} disabled={busy} onClick={() => void loadGallery(tab, true)}>Load more</button>}
          </section>}
          {page === "notifications" && <div className="space-y-3">
            <label className="flex gap-2 text-sm"><input type="checkbox" checked={thread.muted} disabled={busy} onChange={(event) => saveNotifications(event.target.checked, thread.playSounds)} />Mute chat alerts</label>
            <label className="flex gap-2 text-sm"><input type="checkbox" checked={thread.playSounds} disabled={busy || thread.muted} onChange={(event) => saveNotifications(thread.muted, event.target.checked)} />Play a sound for new messages</label>
            <p className="text-sm text-night-sky/65">Alerts and sounds work while Family Chat is open.</p>
          </div>}
          {page === "pins" && <div className={cardClass}>
            {!busy && !pins.length && <p className="p-3 text-sm">No pinned messages yet. Use the pin button next to a message to save it here.</p>}
            {pins.map((message) => messageRow(message))}
          </div>}
          {(page === "receipts" || page === "typing") && <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" role="switch" disabled={busy} checked={page === "receipts" ? privacy.show_read_receipts : privacy.show_typing} onChange={(event) => savePrivacy(page, event.target.checked)} />
              {page === "receipts" ? "Show read receipts" : "Show typing indicator"}
            </label>
            <p className="text-sm text-night-sky/65">{page === "receipts" ? "Chat members can see when you’ve read their messages." : "Chat members can see when you’re typing."} This applies to your Family Chats.</p>
          </div>}
          {page === "report" && <form className="space-y-3" onSubmit={reportIssue}>
            <label className="block text-sm font-semibold">What happened?<textarea className={fieldClass} name="issue" maxLength={2000} required rows={5} placeholder="Describe the problem you ran into." /></label>
            <p className="text-sm text-night-sky/65">Your report includes this chat’s ID. Message content is included only if you enter it yourself.</p>
            <button type="submit" className={buttonClass} disabled={busy}>Submit report</button>
          </form>}
          {busy && <p role="status" className="text-sm text-night-sky/60">Working…</p>}
        </div>
      </div>
    </div>
  );
}
