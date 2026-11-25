"use client";

import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useRouter } from "next/navigation";
import ChatGroupDetails from "./ChatGroupDetails";
import { ChatFile, chatFileAccept, uploadChatFile, useMessageFiles } from "./chatFiles";
import { useChatActivity } from "./useChatActivity";
import { type ChatMessage, useChatHistory } from "./useChatHistory";
import { createClient } from "@/utils/supabase/client";

export type ChatAvatar = {
  userId?: string | null;
  initials: string;
  color: string;
  photoUrl?: string | null;
};

export type ChatThreadMemberSummary = {
  userId: string;
  displayName: string;
  nickname?: string | null;
  avatar: ChatAvatar;
};

export type ChatRecipientOption = ChatThreadMemberSummary & {
  personId: string | null;
};

export type ChatThreadSummary = {
  id: string;
  threadType: "direct" | "group";
  name: string;
  lastActivityAt: string | null;
  preview: string | null;
  avatars: ChatAvatar[];
  members: ChatThreadMemberSummary[];
  pastMembers: ChatThreadMemberSummary[];
  memberCount: number;
  canAddMembers: boolean;
  createdByUserId: string;
  groupImagePath: string | null;
  groupImageUrl: string | null;
  muted: boolean;
  playSounds: boolean;
};

const subscribeToBrowserTime = () => () => {};
const readBrowserTime = () => true;
const readServerTime = () => false;

const fallbackAvatar: ChatAvatar = {
  initials: "LL",
  color: "bg-sky",
};

function AvatarCircle({
  avatar,
  size = "md",
  showOnline = false,
  className = "",
}: {
  avatar: ChatAvatar;
  size?: "sm" | "md" | "lg";
  showOnline?: boolean;
  className?: string;
}) {
  const sizeClasses = {
    sm: "h-9 w-9 text-xs",
    md: "h-11 w-11 text-sm",
    lg: "h-14 w-14 text-base",
  };

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-visible rounded-full ${avatar.color} font-black text-white ring-2 ring-white ${sizeClasses[size]} ${className}`}
    >
      {avatar.initials}
      {avatar.photoUrl && (
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full bg-cover bg-center"
          style={{ backgroundImage: `url("${avatar.photoUrl}")` }}
        />
      )}
      {showOnline && (
        <span role="img" aria-label="Online" className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-sky" />
      )}
    </span>
  );
}

function AvatarStack({ avatars, online }: { avatars: ChatAvatar[]; online: Set<string> }) {
  const visibleAvatars = avatars.length > 0 ? avatars : [fallbackAvatar];

  return (
    <div className="isolate flex shrink-0 -space-x-3">
      {visibleAvatars.slice(0, 4).map((avatar, index) => (
        <AvatarCircle
          key={`${avatar.userId ?? avatar.initials}-${index}`}
          avatar={avatar}
          size="md"
          showOnline={Boolean(avatar.userId && online.has(avatar.userId))}
        />
      ))}
    </div>
  );
}

function IconButton({
  label,
  children,
  disabled = false,
  onClick,
  comingSoon = false,
  callControl = false,
}: {
  label: string;
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  comingSoon?: boolean;
  callControl?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      title={comingSoon ? `${label} coming soon` : label}
      className={`flex shrink-0 items-center justify-center text-night-sky/75 transition hover:bg-sand disabled:cursor-not-allowed disabled:opacity-60 ${callControl ? "h-11 w-11 rounded-xl [&>svg]:h-6 [&>svg]:w-6" : "h-10 w-10 rounded-full border border-night-sky/10 bg-white shadow-sm"}`}
    >
      {children}
    </button>
  );
}

function ComposeIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none">
      <path
        d="M8.3 5.5 10 9.2 8.7 11c1 2 2.6 3.6 4.6 4.6l1.8-1.3 3.7 1.7-.8 3.1c-.2.7-.8 1.1-1.5 1A14.2 14.2 0 0 1 4 7.6c-.1-.7.4-1.3 1-1.5l3.3-.6Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function VideoIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 7.5h10.5v9H4v-9ZM14.5 10.5 20 8v8l-5.5-2.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PinIcon() {
  return <svg aria-hidden="true" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 3 6 6-3 2-2 5-3 3-8-8 3-3 5-2 2-3ZM10 14l-7 7" /></svg>;
}

function AttachmentIcon() {
  return <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 11.5l-8.5 8.5a5 5 0 0 1-7-7l9-9a3.5 3.5 0 0 1 5 5l-9 9a2 2 0 0 1-3-3l8.5-8.5" /></svg>;
}

function BackIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none">
      <path
        d="M15 6 9 12l6 6"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none">
      <path
        d="m5 12 14-7-4.5 14-2.6-5.9L5 12Zm6.9 1.1L19 5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function formatMessageTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatActivityLabel(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (sameDay) {
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  }

  const ageInDays = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (ageInDays >= 0 && ageInDays < 7) {
    return new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date);
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function EmptyState({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center rounded-3xl border border-dashed border-night-sky/15 bg-sand/50 p-6 text-center">
      <h3 className="text-lg font-black text-night-sky">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-night-sky/60">{body}</p>
    </div>
  );
}

export default function FamilyChatShell({
  currentUserId,
  currentUser,
  initialThreads,
  recipients,
}: {
  currentUserId: string;
  currentUser: ChatThreadMemberSummary;
  initialThreads: ChatThreadSummary[];
  recipients: ChatRecipientOption[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const canFormatLocalTime = useSyncExternalStore(subscribeToBrowserTime, readBrowserTime, readServerTime);
  const scrollPanelRef = useRef<HTMLDivElement | null>(null);
  const scrollAnchor = useRef<{ threadId: string; height: number; top: number } | null>(null);
  const pinnedToBottom = useRef(true);
  const pendingSend = useRef(new Map<string, { id: string; body: string; file?: File; path?: string }>());
  const sending = useRef(false);
  const audio = useRef<AudioContext | null>(null);
  const notified = useRef(new Set<string>());
  const fileInput = useRef<HTMLInputElement>(null);
  const rosterRefresh = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [detailsFor, setDetailsFor] = useState<string | null>(null);
  const [draftFiles, setDraftFiles] = useState<Record<string, File>>({});
  const [filesRevision, setFilesRevision] = useState(0);
  const [pinsRevision, setPinsRevision] = useState(0);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [pinError, setPinError] = useState("");
  const [inAppAlert, setInAppAlert] = useState<{ id: string; name: string } | null>(null);
  const [privacy, setPrivacy] = useState({ show_typing: true, show_read_receipts: false });
  const [readPositions, setReadPositions] = useState<{ threadId: string; rows: {user_id: string; read_through: string}[] } | null>(null);
  const [latestByThread, setLatestByThread] = useState<Record<string, ChatMessage>>({});
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(initialThreads[0]?.id ?? null);
  const [awaitingThreadId, setAwaitingThreadId] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<"messages" | "thread">("messages");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [compose, setCompose] = useState<"new" | "add" | null>(null);
  const [recipientFilter, setRecipientFilter] = useState("");
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>([]);
  const [groupTitle, setGroupTitle] = useState("");
  const [isCreatingThread, setIsCreatingThread] = useState(false);
  const [createThreadError, setCreateThreadError] = useState<string | null>(null);
  const [groupError, setGroupError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [leftThreadIds, setLeftThreadIds] = useState<string[]>([]);

  const threads = initialThreads.filter((thread) => !leftThreadIds.includes(thread.id))
    .map((thread) => {
      const latest = latestByThread[thread.id];
      const updated = latest && new Date(latest.created_at).getTime() >= new Date(thread.lastActivityAt ?? 0).getTime()
        ? { ...thread, lastActivityAt: latest.created_at, preview: latest.body }
        : thread;
      return {
        ...updated,
        lastActivityLabel: canFormatLocalTime ? formatActivityLabel(updated.lastActivityAt) : "",
      };
    })
    .sort((a, b) => new Date(b.lastActivityAt ?? 0).getTime() - new Date(a.lastActivityAt ?? 0).getTime());
  const selectedThread = threads.find((thread) => thread.id === selectedThreadId) ?? null;
  const threadId = selectedThread?.id ?? null;
  const messageDraft = threadId ? drafts[threadId] ?? "" : "";
  const history = useChatHistory(supabase, threadId);
  const activity = useChatActivity(supabase, threadId);
  const selectedMessages = history.messages;
  const draftFile = threadId ? draftFiles[threadId] : undefined;
  const showingDetails = Boolean(threadId && detailsFor === threadId);
  const openThread = activePanel === "thread" && Boolean(selectedThread);
  const fileRows = useMessageFiles(supabase, threadId, selectedMessages.map((message) => message.id).join(","), filesRevision);
  const newestMessageId = selectedMessages.at(-1)?.id;
  const lastOwnMessage = selectedMessages.findLast((message) => message.sender_user_id === currentUserId);
  const readers = readPositions?.threadId === threadId && lastOwnMessage
    ? (selectedThread?.members ?? []).filter((member) => readPositions.rows.some((row) =>
      row.user_id === member.userId && Date.parse(row.read_through) >= Date.parse(lastOwnMessage.created_at)))
    : [];
  const onlineMembers = new Map(threads.flatMap((thread) => thread.members)
    .filter((member) => activity.online.has(member.userId))
    .map((member) => [member.userId, member]));
  const typingNames = selectedThread?.members
    .filter((member) => activity.typing.has(member.userId))
    .map((member) => member.nickname || member.displayName) ?? [];
  const groupOnline = selectedThread?.members.filter((member) => activity.online.has(member.userId)).length ?? 0;
  const eligibleRecipients = compose === "add"
    ? recipients.filter((recipient) => !selectedThread?.members.some((member) => member.userId === recipient.userId))
    : recipients;
  const selectedRecipients = eligibleRecipients.filter((recipient) => selectedRecipientIds.includes(recipient.userId));
  const filteredRecipients = eligibleRecipients.filter((recipient) =>
    recipient.displayName.toLowerCase().includes(recipientFilter.trim().toLowerCase())
  );
  const canSendMessage = Boolean(threadId && (messageDraft.trim() || draftFile) && !isSendingMessage);

  function noteMessage(message: ChatMessage) {
    history.append(message);
    setLatestByThread((previous) => {
      const latest = previous[message.thread_id];
      if (latest && (latest.created_at > message.created_at
        || (latest.created_at === message.created_at && latest.id >= message.id))) return previous;
      return { ...previous, [message.thread_id]: message };
    });
  }

  function unlockSound() {
    if (!threads.some((thread) => thread.playSounds) && !showingDetails) return;
    try {
      const context = audio.current ?? new AudioContext();
      audio.current = context;
      if (context.state === "suspended") void context.resume().catch(() => undefined);
    } catch { /* Audio is optional on this device. */ }
  }

  useEffect(() => () => { if (audio.current) void audio.current.close().catch(() => undefined); }, []);

  useEffect(() => {
    if (!inAppAlert) return;
    const timer = window.setTimeout(() => setInAppAlert(null), 5000);
    return () => window.clearTimeout(timer);
  }, [inAppAlert]);

  const onNewMessage = useEffectEvent((message: ChatMessage) => {
    noteMessage(message);
    const thread = threads.find((item) => item.id === message.thread_id);
    if (!thread || thread.muted || document.hidden || message.sender_user_id === currentUserId || notified.current.has(message.id)) return;
    notified.current.add(message.id);
    if (notified.current.size > 100) notified.current.delete(notified.current.values().next().value!);
    if (thread.id !== threadId || (!openThread && window.matchMedia("(width < 64rem)").matches)) {
      setInAppAlert({ id: thread.id, name: thread.name });
    }
    const context = audio.current;
    if (thread.playSounds && context?.state === "running") {
      const oscillator = context.createOscillator();
      const volume = context.createGain();
      oscillator.frequency.value = 660;
      volume.gain.setValueAtTime(0.08, context.currentTime);
      volume.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.15);
      oscillator.connect(volume).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.16);
    }
  });
  const onThreadUpdate = useEffectEvent((row: Record<string, unknown>, refreshRoster: () => void) => {
    const thread = threads.find((item) => item.id === row.id);
    if (thread?.threadType === "group" && ((row.title && row.title !== thread.name) || row.group_image_path !== thread.groupImagePath)) {
      refreshRoster();
    }
  });

  useEffect(() => {
    let active = true;
    async function loadPrivacy() {
      const { data } = await supabase.from("chat_privacy").select("show_typing,show_read_receipts").eq("user_id", currentUserId).maybeSingle();
      if (active && data) setPrivacy(data);
    }
    const onFocus = () => { if (!document.hidden) void loadPrivacy(); };
    void loadPrivacy();
    document.addEventListener("visibilitychange", onFocus);
    return () => { active = false; document.removeEventListener("visibilitychange", onFocus); };
  }, [currentUserId, supabase]);

  useEffect(() => {
    if (!threadId) return;
    let active = true;
    async function refreshPins() {
      const { data } = await supabase.from("chat_pins").select("message_id").eq("thread_id", threadId).is("unpinned_at", null).limit(500);
      if (active && data) setPinnedIds(data.map((row) => row.message_id));
    }
    void refreshPins();
    return () => { active = false; };
  }, [pinsRevision, supabase, threadId]);

  useEffect(() => {
    if (!threadId || showingDetails || compose) return;
    let active = true;
    async function updateReceipts() {
      if (document.hidden || (!openThread && window.matchMedia("(width < 64rem)").matches)) return;
      if (newestMessageId && privacy.show_read_receipts && pinnedToBottom.current) {
        await supabase.rpc("mark_chat_read", { thread_uuid: threadId, message_uuid: newestMessageId });
      }
      const { data } = await supabase.rpc("read_chat_receipts", { thread_uuid: threadId });
      if (active && data && threadId) setReadPositions({ threadId, rows: data });
    }
    void updateReceipts();
    const timer = window.setInterval(() => void updateReceipts(), 5000);
    document.addEventListener("visibilitychange", updateReceipts);
    return () => { active = false; window.clearInterval(timer); document.removeEventListener("visibilitychange", updateReceipts); };
  }, [compose, newestMessageId, openThread, privacy.show_read_receipts, showingDetails, supabase, threadId]);
  const catchUp = useEffectEvent(() => {
    if (document.hidden || !navigator.onLine) return;
    router.refresh();
    void history.refresh();
  });

  useEffect(() => {
    const scheduleRosterRefresh = () => {
      if (document.hidden || rosterRefresh.current) return;
      rosterRefresh.current = setTimeout(() => {
        rosterRefresh.current = null;
        router.refresh();
      }, 150);
    };
    // Postgres Changes checks chat row-level policies on each event, including
    // when someone leaves while a subscription is already open.
    const channel = supabase.channel("family-chat:" + currentUserId)
      .on("postgres_changes", { schema: "public", table: "chat_messages", event: "INSERT" },
        ({ new: row }) => onNewMessage(row as ChatMessage))
      .on("postgres_changes", { schema: "public", table: "chat_shared_files", event: "INSERT" },
        () => setFilesRevision((revision) => revision + 1))
      .on("postgres_changes", { schema: "public", table: "chat_pins", event: "INSERT" },
        () => setPinsRevision((revision) => revision + 1))
      .on("postgres_changes", { schema: "public", table: "chat_pins", event: "UPDATE" },
        () => setPinsRevision((revision) => revision + 1))
      .on("postgres_changes", { schema: "public", table: "chat_threads", event: "UPDATE" },
        ({ new: row }) => onThreadUpdate(row, scheduleRosterRefresh))
      .on("postgres_changes", { schema: "public", table: "chat_thread_members", event: "INSERT" },
        scheduleRosterRefresh)
      .on("postgres_changes", { schema: "public", table: "chat_thread_members", event: "UPDATE" },
        ({ new: row }) => {
          if (row.user_id === currentUserId && row.left_at === null) {
            setLeftThreadIds((ids) => ids.filter((id) => id !== row.thread_id));
          }
          scheduleRosterRefresh();
        })
      .subscribe((status) => { if (status === "SUBSCRIBED") catchUp(); });

    const reconnect = () => catchUp();
    window.addEventListener("online", reconnect);
    document.addEventListener("visibilitychange", reconnect);
    return () => {
      if (rosterRefresh.current) clearTimeout(rosterRefresh.current);
      rosterRefresh.current = null;
      window.removeEventListener("online", reconnect);
      document.removeEventListener("visibilitychange", reconnect);
      void supabase.removeChannel(channel);
    };
  }, [currentUserId, router, supabase]);

  useLayoutEffect(() => {
    const panel = scrollPanelRef.current;
    if (!panel || history.loading) return;
    const anchor = scrollAnchor.current;
    if (anchor?.threadId === threadId && !history.loadingOlder) {
      panel.scrollTop = anchor.top + panel.scrollHeight - anchor.height;
      scrollAnchor.current = null;
    } else if (pinnedToBottom.current) {
      panel.scrollTop = panel.scrollHeight;
    }
  }, [activePanel, history.loading, history.loadingOlder, selectedMessages.length, threadId]);

  useEffect(() => {
    const panel = scrollPanelRef.current;
    if (!panel) return;
    const observer = new ResizeObserver(() => {
      if (pinnedToBottom.current && !scrollAnchor.current) {
        panel.scrollTop = panel.scrollHeight;
      }
    });
    observer.observe(panel);
    return () => observer.disconnect();
  }, [threadId]);

  function selectThread(id: string) {
    activity.signal("stop");
    setDetailsFor(null);
    setInAppAlert(null);
    setPinError("");
    pinnedToBottom.current = true;
    scrollAnchor.current = null;
    setAwaitingThreadId(null);
    setSelectedThreadId(id);
    setActivePanel("thread");
    setSendError(null);
    setGroupError(null);
  }

  async function loadOlder() {
    const panel = scrollPanelRef.current;
    if (!panel || !threadId || history.loadingOlder) return;
    pinnedToBottom.current = false;
    scrollAnchor.current = { threadId, height: panel.scrollHeight, top: panel.scrollTop };
    if (!await history.loadOlder()) scrollAnchor.current = null;
  }

  function getMemberForMessage(message: ChatMessage) {
    return selectedThread?.members.find((member) => member.userId === message.sender_user_id)
      ?? selectedThread?.pastMembers.find((member) => member.userId === message.sender_user_id)
      ?? (message.sender_user_id === currentUserId ? currentUser : undefined);
  }

  function toggleRecipient(userId: string) {
    setCreateThreadError(null);
    setSelectedRecipientIds((currentIds) =>
      currentIds.includes(userId)
        ? currentIds.filter((id) => id !== userId)
        : [...currentIds, userId]
    );
  }

  function resetComposeModal() {
    setRecipientFilter("");
    setSelectedRecipientIds([]);
    setGroupTitle("");
    setCreateThreadError(null);
  }

  async function createThread() {
    if (!selectedRecipients.length || isCreatingThread) return;
    setIsCreatingThread(true);
    setCreateThreadError(null);

    try {
      const recipientIds = selectedRecipients.map((recipient) => recipient.userId);
      if (compose === "add" && threadId) {
        const { error } = await supabase.rpc("add_chat_group_members", {
          thread_uuid: threadId,
          recipient_user_ids: recipientIds,
        });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.rpc("create_chat_thread", {
          recipient_user_ids: recipientIds,
          thread_title: groupTitle.trim() || null,
        });
        if (error || !data) throw error ?? new Error("Missing conversation");
        const id = data as string;
        selectThread(id);
        setAwaitingThreadId(id);
      }
      router.refresh();
      setCompose(null);
      resetComposeModal();
    } catch {
      setCreateThreadError(compose === "add"
        ? "We couldn’t add those family members. Please try again."
        : "We couldn’t start that conversation. Please try again.");
    } finally {
      setIsCreatingThread(false);
    }
  }

  async function leaveGroup() {
    if (!threadId || leaving || !window.confirm("Leave this group? You’ll lose access to its messages.")) return;
    setLeaving(true);
    setGroupError(null);
    try {
      const { error } = await supabase.rpc("leave_chat_group", { thread_uuid: threadId });
      if (error) throw error;
      activity.signal("stop");
      setDetailsFor(null);
      setLeftThreadIds((ids) => [...ids, threadId]);
      setSelectedThreadId(null);
      setAwaitingThreadId(null);
      setActivePanel("messages");
      router.refresh();
    } catch {
      setGroupError("We couldn’t leave the group. Please try again.");
    } finally {
      setLeaving(false);
    }
  }

  async function sendMessage(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const body = messageDraft.trim();
    if (!threadId || (!body && !draftFile) || sending.current) return;
    const existing = pendingSend.current.get(threadId);
    const pending = existing && existing.body === body && existing.file === draftFile
      ? existing : { id: crypto.randomUUID(), body, file: draftFile };
    pendingSend.current.set(threadId, pending);
    sending.current = true;
    setIsSendingMessage(true);
    setSendError(null);
    activity.signal("stop");
    try {
      if (draftFile && !pending.path) {
        pending.path = await uploadChatFile(supabase, threadId, currentUserId, "file", draftFile, pending.id);
      }
      const { data, error } = draftFile ? await supabase.rpc("send_chat_file", {
        thread_uuid: threadId, client_message_id: pending.id, file_path: pending.path,
        display_name: draftFile.name.slice(0,240), caption: body || null,
      }) : await supabase.rpc("send_chat_message", {
        thread_uuid: threadId, message_body: body, client_message_id: pending.id,
      });
      if (error || !data) throw error ?? new Error("Missing message");
      noteMessage(data as ChatMessage);
      pendingSend.current.delete(threadId);
      if (draftFile) {
        setDraftFiles((previous) => {
          const next = { ...previous };
          delete next[threadId];
          return next;
        });
        setFilesRevision((revision) => revision + 1);
      }
      setDrafts((previous) => previous[threadId] === messageDraft
        ? { ...previous, [threadId]: "" }
        : previous);
    } catch (problem) {
      setSendError(problem instanceof Error && /^Choose |^We couldn’t upload/.test(problem.message)
        ? problem.message : "We couldn’t confirm this message was sent. Try sending again.");
    } finally {
      sending.current = false;
      setIsSendingMessage(false);
    }
  }

  async function pinMessage(id: string, pin: boolean) {
    if (!threadId) return false;
    const { error } = await supabase.rpc("save_chat_pin", { thread_uuid: threadId, message_uuid: id, pinned: pin });
    if (error) { setPinError("We couldn’t change that pin. Try again."); return false; }
    setPinError("");
    setPinnedIds((previous) => pin ? [...new Set([...previous, id])] : previous.filter((item) => item !== id));
    return true;
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void sendMessage();
    }
  }

  return (
    <section onPointerDown={unlockSound} data-open-mobile-thread={openThread ? true : undefined} className="flex min-h-0 w-full flex-col overflow-hidden max-lg:flex-1 lg:mx-auto lg:h-dvh lg:max-w-7xl lg:gap-5 lg:px-8 lg:py-8">
      {inAppAlert && !showingDetails && <div className="absolute inset-x-0 top-14 z-40 mx-auto flex max-w-sm items-center gap-4 rounded-xl bg-night-sky px-3 py-2 text-sm text-white shadow-lg">
        <button type="button" className="min-w-0 flex-1 truncate text-left" onClick={() => selectThread(inAppAlert.id)}>New message in {inAppAlert.name}</button>
        <button type="button" aria-label="Dismiss message alert" onClick={() => setInAppAlert(null)}>×</button>
      </div>}
      <div inert={showingDetails || Boolean(compose)} className="grid min-h-0 flex-1 w-full min-w-0 lg:grid-cols-[360px_minmax(0,1fr)] lg:gap-5">
        <aside
          className={`min-h-0 min-w-0 overflow-y-auto bg-white ${
            activePanel === "messages" ? "block" : "hidden"
          } lg:block lg:rounded-3xl lg:border lg:border-night-sky/10 lg:shadow-sm`}
        >
          <div className="border-b border-night-sky/10 p-5">
            <div className="flex items-center justify-between gap-4">
              <h1 className="text-3xl font-black tracking-tight text-night-sky">
                Messages
              </h1>
              <IconButton
                label="Start a new message"
                onClick={() => setCompose("new")}
              >
                <ComposeIcon />
              </IconButton>
            </div>

            <input
              type="search"
              placeholder="Search conversations..."
              aria-label="Search conversations"
              disabled
              className="mt-4"
            />

            <div className="mt-5">
              <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-night-sky/45">
                Online now
              </h2>
              {onlineMembers.size > 0 ? (
                <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
                  {[...onlineMembers.values()].slice(0, 8).map((member) => (
                    <div key={member.userId} title={member.displayName} aria-label={member.displayName}>
                      <AvatarCircle avatar={member.avatar} size="lg" showOnline />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-night-sky/50">No other chat members online.</p>
              )}
            </div>
          </div>

          <div className="border-t border-night-sky/10 p-3">
            {threads.length === 0 ? (
              <EmptyState
                title="No conversations yet"
                body="Start a message when you’re ready to gather the family around."
              />
            ) : (
              <div className="space-y-2">
                {threads.map((thread) => (
                  <button
                    key={thread.id}
                    type="button"
                    onClick={() => selectThread(thread.id)}
                    className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left transition ${
                      thread.id === selectedThreadId
                        ? "bg-sand shadow-sm"
                        : "hover:bg-sand/65"
                    }`}
                  >
                    {thread.avatars.length > 1 ? (
                      <AvatarStack avatars={thread.avatars} online={activity.online} />
                    ) : (
                      <AvatarCircle
                        avatar={thread.avatars[0] ?? fallbackAvatar}
                        showOnline={activity.online.has(thread.avatars[0]?.userId ?? "")}
                        size="md"
                      />
                    )}

                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-3">
                        <span className="truncate font-semibold text-night-sky">
                          {thread.name}
                        </span>
                        <span className="shrink-0 text-xs font-medium text-night-sky/45">
                          {thread.lastActivityLabel}
                        </span>
                      </span>
                      <span className="mt-1 block truncate text-sm text-night-sky/55">
                        {thread.preview ?? "No messages yet."}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>

        <article
          className={`min-h-0 min-w-0 flex-col overflow-hidden bg-white ${
            activePanel === "thread" ? "flex" : "hidden"
          } lg:flex lg:rounded-3xl lg:border lg:border-night-sky/10 lg:shadow-sm`}
        >
          {selectedThread ? (
            <>
              <header className="relative z-30 flex min-h-14 shrink-0 items-center justify-between gap-1 border-b border-night-sky/10 bg-white px-2 py-1.5 lg:gap-4 lg:p-5">
                <div className="flex min-w-0 flex-1 items-center gap-1.5 lg:gap-4">
                  <button
                    type="button"
                    onClick={() => { activity.signal("stop"); setActivePanel("messages"); }}
                    className="flex h-10 w-9 shrink-0 items-center justify-center rounded-lg text-night-sky/75 hover:bg-sand lg:hidden"
                    aria-label="Back to messages"
                  >
                    <BackIcon />
                  </button>

                  <div className="hidden shrink-0 lg:block">
                    <AvatarStack avatars={selectedThread.avatars} online={activity.online} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-black leading-tight text-night-sky lg:text-2xl">
                      <button type="button" className="block max-w-full truncate rounded-sm text-left hover:underline focus-visible:outline-sky-depth" onClick={() => setDetailsFor(selectedThread.id)} aria-haspopup="dialog">
                        {selectedThread.name}
                      </button>
                    </h2>
                    <p className="mt-1 hidden truncate text-sm leading-tight text-night-sky/65 lg:block">
                      {selectedThread.threadType === "group" ? (
                        <button type="button" onClick={() => setDetailsFor(selectedThread.id)} className="hover:underline">
                          {selectedThread.memberCount} members · <span className="font-semibold text-sky-depth">{groupOnline} online</span>
                        </button>
                      ) : (groupOnline > 0 ? "Online" : selectedThread.lastActivityLabel || "No recent activity")}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center lg:gap-2">
                  <IconButton label="Phone call" callControl disabled comingSoon>
                    <PhoneIcon />
                  </IconButton>
                  <IconButton label="Video call" callControl disabled comingSoon>
                    <VideoIcon />
                  </IconButton>
                </div>
              </header>

              <div ref={scrollPanelRef} onScroll={(event) => {
                const panel = event.currentTarget;
                if (scrollAnchor.current) return;
                pinnedToBottom.current = panel.scrollHeight - panel.clientHeight - panel.scrollTop < 80;
                if (panel.scrollTop < 48 && history.hasOlder && !history.loadingOlder && !history.error) void loadOlder();
              }} className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain bg-sand/55 px-3 py-2.5 lg:space-y-5 lg:p-5">
                {history.error && (
                  <p role="alert" className="text-sm text-red-700">
                    {history.error}{" "}
                    <button type="button" className="underline" onClick={() => void (history.error === "We couldn’t load older messages. Please try again." ? loadOlder() : history.refresh())}>Retry</button>
                  </p>
                )}
                {history.hasOlder && (
                  <button type="button" disabled={history.loadingOlder} onClick={() => void loadOlder()} className="mx-auto block rounded-lg px-3 py-2 text-sm font-semibold text-sky-depth">
                    {history.loadingOlder ? "Loading older messages…" : "Load older messages"}
                  </button>
                )}
                {history.loading ? (
                  <div className="rounded-3xl border border-night-sky/10 bg-white p-5 text-sm text-night-sky/55 shadow-sm">
                    Loading conversation...
                  </div>
                ) : selectedMessages.length === 0 && !history.error ? (
                  <EmptyState
                    title="No messages yet"
                    body="This conversation is ready for its first breadcrumb."
                  />
                ) : (
                  selectedMessages.map((message) => {
                    const member = getMemberForMessage(message);
                    const isCurrentUser = message.sender_user_id === currentUserId;
                    const attachedFile = fileRows[message.id];
                    const pinned = pinnedIds.includes(message.id);

                    return (
                      <div
                        key={message.id}
                        className={`flex gap-2 lg:gap-3 ${
                          isCurrentUser ? "flex-row-reverse" : ""
                        }`}
                      >
                        <AvatarCircle
                          avatar={member?.avatar ?? fallbackAvatar}
                          size="sm"
                          showOnline={activity.online.has(message.sender_user_id)}
                        />

                        <div
                          className={`min-w-0 max-w-[min(calc(100%_-_3.25rem),560px)] ${
                            isCurrentUser ? "text-right" : ""
                          }`}
                        >
                          <div
                            className={`flex items-center gap-2 text-xs text-night-sky/45 ${
                              isCurrentUser ? "flex-row-reverse" : ""
                            }`}
                          >
                            <span className="font-semibold text-night-sky/65">
                              {member?.nickname || member?.displayName || "Family member"}
                            </span>
                            <span>{formatMessageTime(message.created_at)}</span>
                            <button type="button" aria-label={pinned ? "Unpin message" : "Pin message"} title={pinned ? "Unpin message" : "Pin message"} aria-pressed={pinned} className={`grid h-6 w-6 shrink-0 place-items-center rounded-md hover:bg-white ${pinned ? "text-sky-depth" : "text-night-sky/45"}`} onClick={() => void pinMessage(message.id,!pinned)}>
                              <PinIcon />
                            </button>
                          </div>

                          <div
                            className={`mt-0.5 whitespace-pre-wrap wrap-anywhere rounded-2xl px-3 py-2 text-sm leading-5 shadow-sm lg:mt-1 lg:px-4 lg:py-3 lg:leading-6 ${
                              isCurrentUser
                                ? "bg-sky text-white"
                                : "border border-night-sky/10 bg-white text-night-sky/75"
                            }`}
                          >
                            {attachedFile && <ChatFile file={attachedFile} />}
                            {(!attachedFile || message.body !== `Shared ${attachedFile.file_name}`) && message.body}
                          </div>
                          {message.id === lastOwnMessage?.id && readers.length > 0 && (
                            <p className="mt-1 text-xs text-night-sky/65">Seen by {readers.slice(0,3).map((member) => member.nickname || member.displayName).join(", ")}{readers.length > 3 ? ` and ${readers.length - 3} others` : ""}</p>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="shrink-0 border-t border-night-sky/10 bg-white px-2.5 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:px-4 lg:pt-4 lg:pb-4">
                <div role="status" className="text-xs leading-4 text-night-sky/60 lg:min-h-5">
                  {typingNames.length === 1 && `${typingNames[0]} is typing…`}
                  {typingNames.length === 2 && `${typingNames.join(" and ")} are typing…`}
                  {typingNames.length > 2 && "Several family members are typing…"}
                </div>
                {pinError && <p role="alert" className="text-sm text-red-700">{pinError}</p>}
                <form onSubmit={sendMessage} className="space-y-2">
                  {draftFile && <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate">{draftFile.name}</span>
                    <button type="button" disabled={isSendingMessage} onClick={() => setDraftFiles((previous) => {
                      const next = { ...previous }; delete next[selectedThread.id]; return next;
                    })}>Remove attachment</button>
                  </div>}
                  <input ref={fileInput} type="file" accept={chatFileAccept} className="hidden" onChange={(event) => {
                    const file = event.currentTarget.files?.[0];
                    if (file) { setDraftFiles((previous) => ({ ...previous, [selectedThread.id]: file })); setSendError(null); }
                    event.currentTarget.value = "";
                  }} />
                  <div className="flex items-end gap-1.5 rounded-2xl border border-night-sky/10 bg-sand p-1 shadow-inner lg:gap-3 lg:p-2">
                    <button type="button" aria-label="Attach a file" disabled={isSendingMessage} className="grid h-11 w-9 shrink-0 place-items-center rounded-xl text-sky-depth hover:bg-white" onClick={() => fileInput.current?.click()}><AttachmentIcon /></button>
                    <textarea
                      value={messageDraft}
                      onChange={(event) => {
                        const value = event.target.value;
                        setDrafts((previous) => ({ ...previous, [selectedThread.id]: value }));
                        if (privacy.show_typing) activity.signal(value.trim() ? "typing" : "stop");
                        setSendError(null);
                      }}
                      onBlur={() => activity.signal("stop")}
                      onKeyDown={handleComposerKeyDown}
                      maxLength={4000}
                      placeholder="Write a message..."
                      aria-label="Write a message"
                      rows={1}
                      className="max-h-32 min-h-11 flex-1 resize-none border-0 bg-transparent px-3 py-2 text-base leading-5 lg:py-3 text-night-sky shadow-none outline-none placeholder:text-night-sky/40 focus:ring-0 lg:text-sm"
                    />
                    <button
                      type="submit"
                      disabled={!canSendMessage}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-b-[4px] border-sky-depth bg-sky font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:border-b-[6px] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:border-b-[4px]"
                      aria-label="Send message"
                    >
                      {isSendingMessage ? (
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                      ) : (
                        <SendIcon />
                      )}
                    </button>
                  </div>
                  {sendError && (
                    <p className="text-sm font-semibold text-red-600">
                      {sendError}
                    </p>
                  )}
                </form>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center bg-sand/55 p-5">
              <EmptyState
                title={awaitingThreadId === selectedThreadId && awaitingThreadId ? "Opening conversation" : "Choose a conversation"}
                body={awaitingThreadId === selectedThreadId && awaitingThreadId
                  ? "The conversation will appear as soon as it’s ready."
                  : "Your family messages will open here once a conversation is selected."}
              />
            </div>
          )}
        </article>
      </div>

      {showingDetails && selectedThread && (
        <div inert={Boolean(compose)} className="contents">
          <ChatGroupDetails key={selectedThread.id} client={supabase} thread={selectedThread}
            currentUserId={currentUserId} privacy={privacy} online={activity.online} filesRevision={filesRevision}
            onClose={() => setDetailsFor(null)} onAdd={() => setCompose("add")}
            onLeave={() => void leaveGroup()} leaving={leaving} leaveError={groupError}
            onRefresh={() => router.refresh()} onPrivacyChange={(next) => {
              if (!next.show_typing) activity.signal("stop");
              setPrivacy(next);
            }} onPin={pinMessage}
            avatar={(member, online) => <AvatarCircle avatar={member.avatar} showOnline={online} />}
          />
        </div>
      )}
      {compose && (
        <div className="absolute inset-0 z-[65] flex items-end lg:fixed justify-center bg-night-sky/35 p-0 sm:items-center sm:p-6">
          <div className="max-h-full w-full overflow-y-auto lg:max-h-[90svh] rounded-t-3xl border border-night-sky/10 bg-white shadow-xl sm:max-w-xl sm:rounded-3xl">
            <div className="border-b border-night-sky/10 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black text-night-sky">
                    {compose === "add" ? "Add family members" : "New message"}
                  </h2>
                  <p className="mt-1 text-sm text-night-sky/55">
                    {compose === "add"
                      ? "New members can read this group’s full conversation history."
                      : "Choose family members with an accepted LegacyLink connection."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCompose(null);
                    resetComposeModal();
                  }}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-night-sky/10 bg-white text-night-sky/60 shadow-sm hover:bg-sand"
                  aria-label="Close new message"
                >
                  ×
                </button>
              </div>

              <input
                type="search"
                value={recipientFilter}
                onChange={(event) => setRecipientFilter(event.target.value)}
                placeholder="Search family members..."
                aria-label="Search family members"
                className="mt-4"
              />
            </div>

            <div className="max-h-[42svh] overflow-y-auto p-3">
              {eligibleRecipients.length === 0 ? (
                <EmptyState
                  title={compose === "add" ? "No additional family members" : "No messageable family yet"}
                  body="Connect family members to LegacyLink accounts before starting a family chat."
                />
              ) : filteredRecipients.length === 0 ? (
                <p className="rounded-2xl bg-sand p-4 text-sm text-night-sky/55">
                  No matching family members found.
                </p>
              ) : (
                <div className="space-y-2">
                  {filteredRecipients.map((recipient) => {
                    const isSelected = selectedRecipientIds.includes(
                      recipient.userId
                    );

                    return (
                      <button
                        key={recipient.userId}
                        type="button"
                        onClick={() => toggleRecipient(recipient.userId)}
                        className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${
                          isSelected
                            ? "border-sky bg-sky/10"
                            : "border-night-sky/10 hover:bg-sand"
                        }`}
                      >
                        <AvatarCircle avatar={recipient.avatar} size="md" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold text-night-sky">
                            {recipient.displayName}
                          </span>
                          <span className="text-sm text-night-sky/45">
                            Family member
                          </span>
                        </span>
                        <span
                          className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs font-black ${
                            isSelected
                              ? "border-sky bg-sky text-white"
                              : "border-night-sky/20 text-transparent"
                          }`}
                          aria-hidden="true"
                        >
                          ✓
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {compose === "new" && selectedRecipients.length > 1 && (
              <div className="border-t border-night-sky/10 px-5 py-4">
                <label
                  htmlFor="family-chat-group-title"
                  className="text-sm font-semibold text-night-sky"
                >
                  Group title
                </label>
                <input
                  id="family-chat-group-title"
                  type="text"
                  value={groupTitle}
                  maxLength={120}
                  onChange={(event) => setGroupTitle(event.target.value)}
                  placeholder="Optional group name"
                  className="mt-2"
                />
                <p className="mt-2 text-xs text-night-sky/45">
                  If left blank, we’ll name it from the selected family members.
                </p>
              </div>
            )}

            <div className="border-t border-night-sky/10 bg-sand/60 p-5">
              {createThreadError && (
                <p className="mb-3 text-sm font-semibold text-red-600">
                  {createThreadError}
                </p>
              )}
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setCompose(null);
                    resetComposeModal();
                  }}
                  className="rounded-2xl border border-night-sky/10 bg-white px-5 py-3 text-sm font-black uppercase tracking-[0.16em] text-sky-depth shadow-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={createThread}
                  disabled={isCreatingThread || selectedRecipients.length === 0}
                  className="rounded-2xl border-b-[4px] border-sky-depth bg-sky px-5 py-3 text-sm font-black uppercase tracking-[0.16em] text-white shadow-sm transition hover:-translate-y-0.5 hover:border-b-[6px] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:border-b-[4px]"
                >
                  {isCreatingThread
                    ? "Saving…"
                    : compose === "add"
                      ? "Add members"
                      : selectedRecipients.length > 1
                      ? "Start group"
                      : "Start chat"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
