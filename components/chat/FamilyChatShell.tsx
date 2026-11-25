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
      {avatar.photoUrl ? (
        <span
          aria-hidden="true"
          className="h-full w-full rounded-full bg-cover bg-center"
          style={{ backgroundImage: `url("${avatar.photoUrl}")` }}
        />
      ) : (
        avatar.initials
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
    <div className="flex -space-x-3">
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
}: {
  label: string;
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  comingSoon?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      title={comingSoon ? `${label} coming soon` : label}
      className="flex h-10 w-10 items-center justify-center rounded-full border border-night-sky/10 bg-white text-night-sky/70 shadow-sm transition hover:bg-sand disabled:cursor-not-allowed disabled:opacity-60"
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

function EllipsisIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  );
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
  const pendingSend = useRef(new Map<string, { id: string; body: string }>());
  const sending = useRef(false);
  const rosterRefresh = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const onlineMembers = new Map(threads.flatMap((thread) => thread.members)
    .filter((member) => activity.online.has(member.userId))
    .map((member) => [member.userId, member]));
  const typingNames = selectedThread?.members
    .filter((member) => activity.typing.has(member.userId))
    .map((member) => member.displayName) ?? [];
  const groupOnline = selectedThread?.members.filter((member) => activity.online.has(member.userId)).length ?? 0;
  const eligibleRecipients = compose === "add"
    ? recipients.filter((recipient) => !selectedThread?.members.some((member) => member.userId === recipient.userId))
    : recipients;
  const selectedRecipients = eligibleRecipients.filter((recipient) => selectedRecipientIds.includes(recipient.userId));
  const filteredRecipients = eligibleRecipients.filter((recipient) =>
    recipient.displayName.toLowerCase().includes(recipientFilter.trim().toLowerCase())
  );
  const canSendMessage = Boolean(threadId && messageDraft.trim() && !isSendingMessage);

  function noteMessage(message: ChatMessage) {
    history.append(message);
    setLatestByThread((previous) => {
      const latest = previous[message.thread_id];
      if (latest && (latest.created_at > message.created_at
        || (latest.created_at === message.created_at && latest.id >= message.id))) return previous;
      return { ...previous, [message.thread_id]: message };
    });
  }

  const onNewMessage = useEffectEvent((message: ChatMessage) => noteMessage(message));
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
    if (message.sender_user_id === currentUserId) return currentUser;
    return selectedThread?.members.find((member) => member.userId === message.sender_user_id)
      ?? selectedThread?.pastMembers.find((member) => member.userId === message.sender_user_id);
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
    if (!threadId || !body || sending.current) return;
    const existing = pendingSend.current.get(threadId);
    const id = existing?.body === body ? existing.id : crypto.randomUUID();
    pendingSend.current.set(threadId, { id, body });
    sending.current = true;
    setIsSendingMessage(true);
    setSendError(null);
    activity.signal("stop");
    try {
      const { data, error } = await supabase.rpc("send_chat_message", {
        thread_uuid: threadId, message_body: body, client_message_id: id,
      });
      if (error || !data) throw error ?? new Error("Missing message");
      noteMessage(data as ChatMessage);
      pendingSend.current.delete(threadId);
      setDrafts((previous) => previous[threadId] === messageDraft
        ? { ...previous, [threadId]: "" }
        : previous);
    } catch {
      setSendError("We couldn’t confirm this message was sent. Try sending again.");
    } finally {
      sending.current = false;
      setIsSendingMessage(false);
    }
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void sendMessage();
    }
  }

  return (
    <section className="flex min-h-0 w-full flex-col overflow-hidden max-lg:flex-1 lg:mx-auto lg:h-dvh lg:max-w-7xl lg:gap-5 lg:px-8 lg:py-8">
      <div className="grid min-h-0 flex-1 w-full min-w-0 lg:grid-cols-[360px_minmax(0,1fr)] lg:gap-5">
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
              <header className="flex flex-col gap-4 border-b border-night-sky/10 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => { activity.signal("stop"); setActivePanel("messages"); }}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-night-sky/10 bg-white text-night-sky/75 shadow-sm hover:bg-sand lg:hidden"
                    aria-label="Back to messages"
                  >
                    <BackIcon />
                  </button>

                  <AvatarStack avatars={selectedThread.avatars} online={activity.online} />
                  <div>
                    <h2 className="text-2xl font-black text-night-sky">
                      {selectedThread.name}
                    </h2>
                    {selectedThread.threadType === "group" ? (
                      <details key={selectedThread.id} className="relative mt-1">
                        <summary className="cursor-pointer text-sm text-night-sky/65">
                          {selectedThread.memberCount} members · <span className="font-semibold text-sky-depth">{groupOnline} online</span>
                        </summary>
                        <ul aria-label="Group members" className="absolute z-20 mt-2 max-h-64 w-56 overflow-y-auto rounded-xl border border-night-sky/10 bg-white p-2 shadow-lg">
                          {selectedThread.members.map((member) => {
                            const online = member.userId === currentUserId || activity.online.has(member.userId);
                            return (
                              <li key={member.userId} className="flex items-center gap-3 p-2">
                                <AvatarCircle avatar={member.avatar} size="sm" showOnline={online} />
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold">{member.displayName}</p>
                                  <p className="text-xs text-night-sky/55">
                                    {member.userId === currentUserId ? "You" : online ? "Online" : "Offline"}
                                  </p>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </details>
                    ) : (
                      <p className="mt-1 text-sm text-night-sky/55">
                        {groupOnline > 0 ? "Online" : selectedThread.lastActivityLabel || "No recent activity"}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <IconButton label="Phone call" disabled comingSoon>
                    <PhoneIcon />
                  </IconButton>
                  <IconButton label="Video call" disabled comingSoon>
                    <VideoIcon />
                  </IconButton>
                  {selectedThread.threadType === "group" && (
                    <details key={selectedThread.id} className="relative">
                      <summary aria-label="Group options" className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full border border-night-sky/10">
                        <EllipsisIcon />
                      </summary>
                      <div className="absolute right-0 z-10 mt-2 w-40 rounded-xl border border-night-sky/10 bg-white p-2 shadow-lg">
                        {selectedThread.canAddMembers && (
                          <button type="button" onClick={() => setCompose("add")} className="block w-full rounded-lg p-2 text-left text-sm hover:bg-sand">
                            Add members
                          </button>
                        )}
                        <button type="button" disabled={leaving} onClick={leaveGroup} className="block w-full rounded-lg p-2 text-left text-sm hover:bg-sand">
                          Leave group
                        </button>
                      </div>
                    </details>
                  )}
                </div>
              </header>

              <div ref={scrollPanelRef} onScroll={(event) => {
                const panel = event.currentTarget;
                if (scrollAnchor.current) return;
                pinnedToBottom.current = panel.scrollHeight - panel.clientHeight - panel.scrollTop < 80;
                if (panel.scrollTop < 48 && history.hasOlder && !history.loadingOlder && !history.error) void loadOlder();
              }} className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain bg-sand/55 p-5">
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

                    return (
                      <div
                        key={message.id}
                        className={`flex gap-3 ${
                          isCurrentUser ? "sm:flex-row-reverse" : ""
                        }`}
                      >
                        <AvatarCircle
                          avatar={member?.avatar ?? fallbackAvatar}
                          size="sm"
                          showOnline={activity.online.has(message.sender_user_id)}
                        />

                        <div
                          className={`max-w-[min(100%,560px)] ${
                            isCurrentUser ? "sm:text-right" : ""
                          }`}
                        >
                          <div
                            className={`flex items-center gap-2 text-xs text-night-sky/45 ${
                              isCurrentUser ? "sm:flex-row-reverse" : ""
                            }`}
                          >
                            <span className="font-semibold text-night-sky/65">
                              {member?.displayName ?? "Family member"}
                            </span>
                            <span>{formatMessageTime(message.created_at)}</span>
                          </div>

                          <div
                            className={`mt-1 whitespace-pre-wrap wrap-anywhere rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${
                              isCurrentUser
                                ? "bg-sky text-white"
                                : "border border-night-sky/10 bg-white text-night-sky/75"
                            }`}
                          >
                            {message.body}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="shrink-0 border-t border-night-sky/10 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <div role="status" className="min-h-5 text-xs text-night-sky/60">
                  {typingNames.length === 1 && `${typingNames[0]} is typing…`}
                  {typingNames.length === 2 && `${typingNames.join(" and ")} are typing…`}
                  {typingNames.length > 2 && "Several family members are typing…"}
                </div>
                {groupError && <p role="alert" className="text-sm text-red-700">{groupError}</p>}
                <form onSubmit={sendMessage} className="space-y-2">
                  <div className="flex items-end gap-3 rounded-2xl border border-night-sky/10 bg-sand p-2 shadow-inner">
                    <textarea
                      value={messageDraft}
                      onChange={(event) => {
                        const value = event.target.value;
                        setDrafts((previous) => ({ ...previous, [selectedThread.id]: value }));
                        activity.signal(value.trim() ? "typing" : "stop");
                        setSendError(null);
                      }}
                      onBlur={() => activity.signal("stop")}
                      onKeyDown={handleComposerKeyDown}
                      maxLength={4000}
                      placeholder="Write a message..."
                      aria-label="Write a message"
                      rows={1}
                      className="max-h-32 min-h-11 flex-1 resize-none border-0 bg-transparent px-3 py-3 text-base leading-5 text-night-sky shadow-none outline-none placeholder:text-night-sky/40 focus:ring-0 lg:text-sm"
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
