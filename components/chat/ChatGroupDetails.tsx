"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent, ReactNode } from "react";
import type { createClient } from "@/utils/supabase/client";
import type { ChatThreadSummary } from "./FamilyChatShell";
import type { ChatMessage } from "./useChatHistory";
import { ChatFile, chatFilesBucket, photoTypes, signChatFiles, uploadChatFile, videoTypes } from "./chatFiles";
import type { SharedFile } from "./chatFiles";
import { bubbleStyle, getChatTheme, isChatMuted, muteOptions, themes, tones, toneUrl, wallpaperStyle, wallpaperUrl } from "./chatAppearance";

import GroupPhotoCrop from "./GroupPhotoCrop";

type NotificationSetting = "mute" | "messages" | "tone";

type Page = "details" | "edit" | "members" | "nicknames" | "search" | "gallery" | "notifications" | "pins" | "receipts" | "typing" | "report" | "context" | "tones" | "themes" | "theme-preview" | "group-photo";
type Privacy = { show_typing: boolean; show_read_receipts: boolean };
type GalleryTab = "Media" | "Links" | "Files";
type LinkItem = { message_id: string; url: string };

const titles: Record<Page, string> = {
  details: "Group details", edit: "Group name", "group-photo": "Adjust group photo", members: "Group members",
  nicknames: "Nicknames", search: "Search conversation", gallery: "Media, links, and files",
  notifications: "Notifications & sounds", tones: "Text tone", themes: "Themes", "theme-preview": "Theme preview", pins: "Pinned messages", receipts: "Read receipts",
  typing: "Typing indicator", report: "Report a Family Chat issue", context: "Message in conversation",
};
const galleryPageSize = 30;
const mediaTypes = [...photoTypes, ...videoTypes];
const fieldClass = "w-full rounded-xl border border-night-sky/15 px-3 py-2 text-base";
const buttonClass = "rounded-xl bg-night-sky px-4 py-2 text-sm font-bold text-white disabled:opacity-50";
const cardClass = "overflow-hidden rounded-xl border border-night-sky/10 bg-white";
const sectionClass = "mb-2 text-sm font-bold text-night-sky/70";

function DetailIcon({ name, className = "size-6" }: {
  name: "add" | "nicknames" | "search" | "customize" | "chevron" | "check" | "play" | "stop" | "camera";
  className?: string;
}) {
  const paths = {
    add: "M14 19v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m18-11v6m-3-3h6M12 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
    nicknames: "m2.5 18 4.5-12 4.5 12M4 14h6m11 4v-6m0 3a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
    search: "m16 16 5 5m-3-10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z",
    customize: "M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1.5-3.3A1 1 0 0 1 15.3 16H17a4 4 0 0 0 4-4 9 9 0 0 0-9-9ZM7.5 12h.1m2-4h.1m4.5-.5h.1m3.3 3h.1",
    chevron: "m9 5 7 7-7 7",
    check: "m5 12 4 4L19 6",
    play: "M6 3v18l16-9Z",
    stop: "M6 6h12v12H6Z",
    camera: "M4 7h4l2-3h4l2 3h4v13H4ZM16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  };
  const filled = name === "play" || name === "stop";
  return <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill={filled ? "currentColor" : "none"} stroke={filled ? "none" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={paths[name]} />
  </svg>;
}

function QuickAction({ label, icon, onClick }: {
  label: string; icon: "add" | "nicknames" | "search" | "customize"; onClick: () => void;
}) {
  return <button type="button" onClick={onClick} className="group flex w-17 min-w-0 flex-col items-center gap-1.5 rounded-2xl py-1 text-xs font-bold focus-visible:outline-2 focus-visible:outline-sky-depth">
    <span className="grid size-12 place-items-center rounded-full bg-sky/15 text-night-sky transition-colors group-hover:bg-sky/30"><DetailIcon name={icon} /></span>
    {label}
  </button>;
}

function Row({ label, value, onClick, danger = false, disabled = false }: {
  label: string; value?: string; onClick?: () => void; danger?: boolean; disabled?: boolean;
}) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={`flex min-h-12 w-full items-center justify-between gap-4 border-b border-night-sky/10 px-4 py-2 text-left text-sm font-semibold last:border-0 hover:bg-sand/40 disabled:cursor-default disabled:opacity-60 ${danger ? "text-red-700" : ""}`}>
      <span>{label}</span>
      {!danger && <span className="flex shrink-0 items-center gap-2">
        {value && <span className="text-xs font-medium text-night-sky/65">{value}</span>}
        <DetailIcon name="chevron" className="size-5 text-sky-depth" />
      </span>}
    </button>
  );
}

function SettingsSwitch({ label, checked, disabled, onChange }: {
  label: string; checked: boolean; disabled: boolean; onChange: (enabled: boolean) => void;
}) {
  return (
    <button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)}
      className="flex min-h-14 w-full items-center justify-between gap-4 px-4 py-2 text-left text-base font-bold hover:bg-sand/30 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-sky-depth disabled:opacity-60">
      {label}
      <span aria-hidden="true" className={`relative h-8 w-[3.75rem] shrink-0 rounded-full transition-colors motion-reduce:transition-none ${checked ? "bg-sky-depth" : "bg-night-sky/35"}`}>
        <span className={`absolute left-0.5 top-0.5 h-7 w-7 rounded-full bg-white shadow-sm transition-transform motion-reduce:transition-none ${checked ? "translate-x-7" : ""}`} />
      </span>
    </button>
  );
}

export default function ChatGroupDetails({
  client, thread, currentUserId, privacy, online, filesRevision, removedIds, onClose, onAdd, onLeave,
  leaving, leaveError, onRefresh, onToneChange, onPrivacyChange, onPin, avatar,
}: {
  client: ReturnType<typeof createClient>;
  thread: ChatThreadSummary;
  currentUserId: string;
  privacy: Privacy;
  online: Set<string>;
  filesRevision: number;
  removedIds: Set<string>;
  onClose: () => void;
  onAdd: () => void;
  onLeave: () => void;
  leaving: boolean;
  leaveError: string | null;
  onRefresh: () => void;
  onToneChange: (tone: string) => void;
  onPrivacyChange: (privacy: Privacy) => void;
  onPin: (id: string, pin: boolean) => Promise<boolean>;
  avatar: (member: ChatThreadSummary["members"][number], online: boolean) => ReactNode;
}) {
  const [page, setPage] = useState<Page>("details");
  const [previous, setPrevious] = useState<Page>("details");
  const [busy, setBusy] = useState(false);
  const [muteDialog, setMuteDialog] = useState(false);
  const [expiredMute, setExpiredMute] = useState<string | null>(null);
  const [previewTheme, setPreviewTheme] = useState("default");
  const [previewingTone, setPreviewingTone] = useState<string | null>(null);
  const soundPreview = useRef<HTMLAudioElement | null>(null);

  const muteCancel = useRef<HTMLButtonElement>(null);
  const muteTrigger = useRef<HTMLElement | null>(null);
  const themeGalleryScroll = useRef(0);
  const themeGalleryTrigger = useRef<string | null>(null);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [groupName, setGroupName] = useState(thread.name);
  const [groupImage, setGroupImage] = useState<File | null>(null);
  const groupPhotoInput = useRef<HTMLInputElement>(null);
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
  const muted = Boolean(thread.mutedAt && (!thread.mutedUntil || thread.mutedUntil !== expiredMute));
  const activeTone = tones.find((tone) => tone.id === thread.notificationTone) ?? tones[0];
  const themePreview = page === "theme-preview" ? getChatTheme(previewTheme) : null;
  const previewWallpaper = themePreview && wallpaperStyle(themePreview);

  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    return () => trigger?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const area = scrollArea.current;
    if (page === "themes" && area && themeGalleryTrigger.current) {
      area.scrollTop = themeGalleryScroll.current;
      area.querySelector<HTMLButtonElement>(`[data-theme-id="${themeGalleryTrigger.current}"]`)?.focus({ preventScroll: true });
      themeGalleryTrigger.current = null;
      return;
    }
    back.current?.focus({ preventScroll: true });
    if (area) area.scrollTop = 0;
  }, [page]);

  useEffect(() => {
    const until = thread.mutedUntil;
    if (!until) return;
    const timer = window.setTimeout(() => setExpiredMute(until), Math.max(0, Date.parse(until) - Date.now()));
    return () => window.clearTimeout(timer);
  }, [thread.mutedUntil]);

  useEffect(() => {
    if (muteDialog) muteCancel.current?.focus({ preventScroll: true });
    else if (muteTrigger.current) {
      muteTrigger.current.focus({ preventScroll: true });
      muteTrigger.current = null;
    }
  }, [muteDialog]);

  useEffect(() => () => {
    soundPreview.current?.pause();
  }, []);

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
    soundPreview.current?.pause();
    setPreviewingTone(null);
    setPage(next);
  }

  function goBack() {
    if (muteDialog) setMuteDialog(false);
    else if (page === "details") onClose();
    else if (page === "group-photo") { setGroupImage(null); go("details"); }
    else if (page === "tones") go("notifications");
    else if (page === "theme-preview") go("themes");
    else go(page === "context" ? previous : "details");
  }

  function handleKeys(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") { event.stopPropagation(); goBack(); return; }
    if (event.key !== "Tab") return;
    const elements = [...(panel.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled])'
    ) ?? [])].filter((element) => element.getClientRects().length && !element.closest("[inert]"));
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
      const { error: problem } = await client.rpc("save_chat_group", { thread_uuid: threadId, group_name: groupName.trim() });
      if (problem) throw problem;
      onRefresh();
      go("details");
    });
  }

  function saveGroupPhoto(photo: File) {
    void run(async () => {
      const path = await uploadChatFile(client, threadId, currentUserId, "group", photo);
      const { data: previousPath, error: problem } = await client.rpc("save_chat_group_photo", { thread_uuid: threadId, image_path: path });
      if (problem) {
        await client.storage.from(chatFilesBucket).remove([path]);
        throw problem;
      }
      if (typeof previousPath === "string" && previousPath.startsWith(`${threadId}/group/${currentUserId}/`)) {
        await client.storage.from(chatFilesBucket).remove([previousPath]);
      }
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

  function saveNotifications(setting: NotificationSetting, preference: string) {
    void run(async () => {
      const { error: problem } = await client.rpc("set_chat_notification_preference", { thread_uuid: threadId, setting, preference });
      if (problem) throw problem;
      if (setting === "mute") setMuteDialog(false);
      if (setting === "tone") onToneChange(preference);
      onRefresh();
    });
  }

  function openThemePreview(id: string) {
    themeGalleryScroll.current = scrollArea.current?.scrollTop ?? 0;
    themeGalleryTrigger.current = id;
    setPreviewTheme(id);
    go("theme-preview");
  }

  function toggleMute() {
    if (isChatMuted(thread.mutedAt, thread.mutedUntil)) saveNotifications("mute", "0");
    else {
      muteTrigger.current = document.activeElement as HTMLElement | null;
      setError("");
      setMuteDialog(true);
    }
  }

  function playTone(id: string) {
    soundPreview.current?.pause();
    setPreviewingTone(null);
    setError("");
    if (previewingTone === id) return;
    const url = toneUrl(id);
    if (!url) return;
    const sample = new Audio(url);
    soundPreview.current = sample;
    sample.onended = () => { if (soundPreview.current === sample) setPreviewingTone(null); };
    setPreviewingTone(id);
    void sample.play().catch(() => {
      if (soundPreview.current !== sample) return;
      setPreviewingTone(null);
      setError("We couldn’t play this sound.");
    });
  }

  function applyTheme() {
    void run(async () => {
      const { error: problem } = await client.rpc("save_chat_appearance", { thread_uuid: threadId, theme: previewTheme });
      if (problem) throw problem;
      onRefresh();
      onClose();
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
      const { data, error } = await client.from("chat_messages").select("id,thread_id,sender_user_id,body,created_at,removed_for_everyone").in("id", ids).is("deleted_at", null);
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
    if (removedIds.has(message.id) || message.removed_for_everyone) return null;
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
      <div role="dialog" aria-modal="true" aria-labelledby="chat-group-panel-title" ref={panel} onKeyDown={handleKeys}
        style={previewWallpaper || undefined}
        className={`chat-details-slide absolute inset-y-0 right-0 flex w-full flex-col bg-cover bg-center shadow-xl lg:w-[min(100%,27rem)] ${previewWallpaper ? "bg-night-sky" : "bg-sand"}`}>
        <div inert={muteDialog} className={`flex min-h-14 shrink-0 items-center gap-2 px-3 ${previewWallpaper ? "bg-linear-to-b from-night-sky/95 to-night-sky/75 pb-3 pt-2 text-white" : "border-b border-night-sky/10 bg-white"}`}>
          <button ref={back} type="button" onClick={goBack} className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg text-2xl ${previewWallpaper ? "hover:bg-white/15" : "hover:bg-sand"}`} aria-label={page === "details" ? "Back to conversation" : page === "tones" ? "Back to notifications" : page === "theme-preview" ? "Back to themes" : "Back to chat details"}>‹</button>
          <h2 id="chat-group-panel-title" className="min-w-0 truncate text-base font-black">{themePreview ? `Previewing ${themePreview.name}` : page === "details" && thread.threadType === "direct" ? "Chat details" : titles[page]}</h2>
        </div>
        <div key={page} inert={muteDialog} ref={scrollArea} className="chat-details-slide min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-4">
          {error && !muteDialog && <p role="alert" className={`rounded-lg p-2 text-sm text-red-800 ${themePreview ? "bg-white" : "bg-coral/10"}`}>{error}</p>}
          {confirmation && <p role="status" className="rounded-lg bg-sky/10 p-2 text-sm">{confirmation}</p>}
          {page === "details" && <>
            <div className="flex flex-col items-center gap-2 text-center">
              {thread.canAddMembers && <>
                <input ref={groupPhotoInput} type="file" hidden accept="image/*" onChange={(event) => {
                  const photo = event.currentTarget.files?.[0];
                  event.currentTarget.value = "";
                  if (!photo) return;
                  if (photo.size > 20 * 1024 * 1024) { setError("Choose a photo under 20 MB."); return; }
                  setGroupImage(photo);
                  go("group-photo");
                }} />
                <button type="button" aria-label="Change group photo" className="relative grid size-20 place-items-center rounded-full bg-sky/20 text-2xl font-black focus-visible:outline-2 focus-visible:outline-sky-depth" onClick={() => groupPhotoInput.current?.click()}>
                  {thread.groupImageUrl
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={thread.groupImageUrl} alt="" className="size-full rounded-full object-cover" />
                    : thread.name.trim().split(/\s+/).slice(0,2).map((word) => word[0]).join("").toUpperCase()}
                  <span className="absolute -bottom-1 -right-1 grid size-7 place-items-center rounded-full bg-white text-night-sky shadow-sm ring-1 ring-night-sky/10"><DetailIcon name="camera" className="size-4" /></span>
                </button>
              </>}
              <h3 className="max-w-full text-xl font-black [overflow-wrap:anywhere]">{thread.name}</h3>
              {thread.threadType === "group" && thread.createdByUserId === currentUserId && <button type="button" className="text-sm font-bold text-sky-depth underline" onClick={() => { setGroupName(thread.name); go("edit"); }}>Change group name</button>}
            </div>
            <div className="flex flex-wrap justify-center gap-x-2 gap-y-1">
              {thread.canAddMembers && <QuickAction label="Add" icon="add" onClick={onAdd} />}
              <QuickAction label="Nicknames" icon="nicknames" onClick={() => go("nicknames")} />
              <QuickAction label="Search" icon="search" onClick={() => go("search")} />
              <QuickAction label="Customize" icon="customize" onClick={() => go("themes")} />
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
                {recent.length ? <div className="grid grid-cols-3 gap-1.5 p-2">{recent.filter((file) => !removedIds.has(file.message_id)).map((file) => <ChatFile key={file.message_id} file={file} tile />)}</div>
                  : <p className="px-4 py-3 text-xs text-night-sky/65">Photos and videos will appear here after someone shares them.</p>}
                <Row label="Media, links, and files" onClick={() => showGallery()} />
              </div>
            </section>
            <section><h3 className={sectionClass}>Actions</h3><div className={cardClass}>
              <Row label={muted ? "Unmute chat" : "Mute chat"} disabled={busy} onClick={toggleMute} />
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
            <button className={buttonClass} type="submit" disabled={busy || !groupName.trim()}>Save group details</button>
          </form>}
          {page === "group-photo" && groupImage && <GroupPhotoCrop photo={groupImage} busy={busy} onSave={saveGroupPhoto} onCancel={() => { setGroupImage(null); go("details"); }} />}
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
            {tab === "Links" ? <div className="space-y-2">{links.filter((item) => !removedIds.has(item.message_id)).map((item, index) => {
              let safe: URL;
              try { safe = new URL(item.url); } catch { return null; }
              if (safe.protocol !== "https:" && safe.protocol !== "http:") return null;
              return <a key={`${item.message_id}-${index}`} className="block break-all rounded-lg bg-white p-2 text-sm underline" href={safe.href} target="_blank" rel="noreferrer">{item.url}</a>;
            })}</div> : <div className={tab === "Media" ? "grid grid-cols-3 gap-2" : "space-y-3"}>
              {gallery.filter((file) => !removedIds.has(file.message_id)).map((file) => <ChatFile key={file.message_id} file={file} tile={tab === "Media"} />)}
            </div>}
            {!busy && !(tab === "Links" ? links.length : gallery.length) && <p className="text-sm">Nothing has been shared here yet.</p>}
            {moreGallery && <button type="button" className={buttonClass} disabled={busy} onClick={() => void loadGallery(tab, true)}>Load more</button>}
          </section>}
          {page === "notifications" && <>
            <section>
              <div className={cardClass}><SettingsSwitch label="Mute notifications" checked={muted} disabled={busy} onChange={toggleMute} /></div>
              <p className="mt-2 px-2 text-sm text-night-sky/70">{muted && thread.mutedUntil
                ? `Muted until ${new Date(thread.mutedUntil).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}.`
                : "Mute alerts and sounds for this chat."}</p>
            </section>
            <section>
              <h3 className={sectionClass}>Message notifications</h3>
              <div role="group" aria-label="Message notifications" className={cardClass}>
                {[{ label: "All", enabled: true }, { label: "None", enabled: false }].map((option) =>
                  <button type="button" key={option.label} aria-pressed={thread.messageAlerts === option.enabled} disabled={busy}
                    className="flex min-h-12 w-full items-center justify-between border-b border-night-sky/10 px-4 py-2 text-left font-semibold last:border-0 hover:bg-sand/40 disabled:opacity-60"
                    onClick={() => saveNotifications("messages", option.enabled ? "all" : "none")}>
                    {option.label}{thread.messageAlerts === option.enabled && <DetailIcon name="check" className="size-5 text-sky-depth" />}
                  </button>)}
              </div>
            </section>
            <section>
              <h3 className={sectionClass}>Notification sounds</h3>
              <div className={cardClass}><Row label="Text tone" value={activeTone.name} onClick={() => go("tones")} /></div>
              <p className="mt-2 px-2 text-sm text-night-sky/70">Alerts and sounds work while Family Chat is open.</p>
            </section>
          </>}
          {page === "tones" && <div className={cardClass} role="group" aria-label="Text tone">
            {tones.map((tone) => <div key={tone.id} className="flex items-center gap-2 border-b border-night-sky/10 px-2 last:border-0">
              <button type="button" aria-pressed={activeTone.id === tone.id} disabled={busy} onClick={() => saveNotifications("tone", tone.id)}
                className="flex min-h-12 flex-1 items-center justify-between gap-2 rounded-lg px-2 py-2 text-left text-sm font-bold hover:bg-sand/40 disabled:opacity-60">
                {tone.name}{activeTone.id === tone.id && <DetailIcon name="check" className="size-5 text-sky-depth" />}
              </button>
              {tone.id !== "silent" && <button type="button" onClick={() => playTone(tone.id)} aria-label={`${previewingTone === tone.id ? "Stop" : "Play"} ${tone.name}`}
                className="grid size-11 shrink-0 place-items-center rounded-xl text-sky-depth hover:bg-sand">
                <DetailIcon name={previewingTone === tone.id ? "stop" : "play"} className="size-5 text-sky" />
              </button>}
            </div>)}
          </div>}
          {page === "themes" && <section>
            <p className="mb-4 text-sm text-night-sky/70">Everyone in this conversation sees the selected theme.</p>
            <div className="grid grid-cols-3 gap-x-2.5 gap-y-4">
              {themes.map((theme) => {
                const active = getChatTheme(thread.themeId).id === theme.id;
                const thumbnail = wallpaperUrl(theme, true);
                return <button type="button" key={theme.id} data-theme-id={theme.id} onClick={() => openThemePreview(theme.id)}
                  aria-label={active ? `${theme.name}, current theme` : theme.name}
                  className="group min-w-0 rounded-2xl text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-depth">
                  <span className={`relative block aspect-[2/3] overflow-hidden rounded-2xl bg-white shadow-sm ring-offset-2 transition group-hover:ring-2 group-hover:ring-sky-depth/50 ${active ? "ring-2 ring-sky-depth" : ""}`}>
                    {thumbnail ?
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumbnail} loading="lazy" decoding="async" alt="" width={200} height={290} className="size-full object-cover" />
                      : <span aria-hidden="true" className="flex size-full flex-col justify-center gap-2 bg-sand px-2"><span className="mr-4 h-5 rounded-full bg-white" /><span className="ml-4 h-5 rounded-full bg-sky" /></span>}
                    {active && <span aria-hidden="true" className="absolute end-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-white text-sky-depth"><DetailIcon name="check" className="size-4" /></span>}
                  </span>
                  <span className="mt-2 block text-xs leading-tight font-bold">{theme.name}</span>
                </button>;
              })}
            </div>
          </section>}
          {themePreview && <div className="mx-auto flex max-w-sm flex-col gap-3 py-2 sm:py-5" aria-label="Example messages">
            <p style={bubbleStyle(themePreview, false)} className="max-w-[85%] self-start rounded-2xl rounded-bl-md bg-white px-4 py-2.5 text-base leading-snug shadow-md">Anyone up for a family picnic?</p>
            <p style={bubbleStyle(themePreview, true)} className="max-w-[85%] self-end rounded-2xl rounded-br-md bg-sky-depth px-4 py-2.5 text-base leading-snug text-white shadow-md">Count me in! I’ll bring lemonade.</p>
            <p style={bubbleStyle(themePreview, false)} className="max-w-[85%] self-start rounded-2xl rounded-bl-md bg-white px-4 py-2.5 text-base leading-snug shadow-md">See you there!</p>
          </div>}
          {page === "pins" && <div className={cardClass}>
            {!busy && !pins.length && <p className="p-3 text-sm">No pinned messages yet. Use the pin button next to a message to save it here.</p>}
            {pins.map((message) => messageRow(message))}
          </div>}
          {(page === "receipts" || page === "typing") && <div className="space-y-3">
            <div className={cardClass}><SettingsSwitch label={page === "receipts" ? "Show read receipts" : "Show typing indicator"}
              checked={page === "receipts" ? privacy.show_read_receipts : privacy.show_typing}
              disabled={busy} onChange={(enabled) => savePrivacy(page, enabled)} /></div>
            <p className="text-sm text-night-sky/65">{page === "receipts" ? "Chat members can see when you’ve read their messages." : "Chat members can see when you’re typing."} This applies to your Family Chats.</p>
          </div>}
          {page === "report" && <form className="space-y-3" onSubmit={reportIssue}>
            <label className="block text-sm font-semibold">What happened?<textarea className={fieldClass} name="issue" maxLength={2000} required rows={5} placeholder="Describe the problem you ran into." /></label>
            <p className="text-sm text-night-sky/65">Your report includes this chat’s ID. Message content is included only if you enter it yourself.</p>
            <button type="submit" className={buttonClass} disabled={busy}>Submit report</button>
          </form>}
          {busy && !themePreview && <p role="status" className="text-sm text-night-sky/60">Working…</p>}
        </div>
        {themePreview && <footer className={`shrink-0 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] ${previewWallpaper ? "bg-linear-to-t from-night-sky/95 to-night-sky/65" : "border-t border-night-sky/10"}`}>
          <div className="mx-auto flex max-w-sm gap-3">
            <button type="button" disabled={busy} style={bubbleStyle(themePreview, false)} className="min-h-12 flex-1 rounded-xl bg-white px-3 text-sm font-bold shadow-md disabled:opacity-60" onClick={() => go("themes")}>Cancel</button>
            <button type="button" disabled={busy} style={bubbleStyle(themePreview, true)} className={`${buttonClass} min-h-12 flex-1 shadow-md`} onClick={applyTheme}>{busy ? "Applying…" : "Apply theme"}</button>
          </div>
        </footer>}
        {muteDialog && <div className="absolute inset-0 z-10 grid place-items-center overflow-y-auto bg-night-sky/45 p-5">
          <section role="dialog" aria-modal="true" aria-labelledby="chat-mute-title"
            className="w-full max-w-sm space-y-2.5 rounded-3xl border border-white/60 bg-white p-4 text-center shadow-xl">
            <h3 id="chat-mute-title" className="mb-3 text-lg font-black">Mute this chat?</h3>
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            {muteOptions.map((option) => <button key={option.minutes} type="button" disabled={busy} onClick={() => saveNotifications("mute", String(option.minutes))}
              className="block min-h-12 w-full rounded-full bg-sky/15 px-4 py-2 text-base font-bold hover:bg-sky/25 focus-visible:outline-2 focus-visible:outline-sky-depth disabled:opacity-60">{option.label}</button>)}
            <button type="button" ref={muteCancel} disabled={busy} onClick={() => setMuteDialog(false)}
              className="block min-h-12 w-full rounded-full bg-sand px-4 py-2 text-base font-bold hover:bg-night-sky/10 focus-visible:outline-2 focus-visible:outline-sky-depth disabled:opacity-60">Cancel</button>
          </section>
        </div>}
      </div>
    </div>
  );
}
