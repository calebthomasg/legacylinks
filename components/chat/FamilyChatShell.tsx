"use client";

import {
  FormEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  lastActivityLabel: string;
  preview: string | null;
  avatars: ChatAvatar[];
  members: ChatThreadMemberSummary[];
  memberCount: number;
  onlineCount: number;
};

type ChatMessage = {
  id: string;
  thread_id: string;
  sender_user_id: string;
  body: string;
  created_at: string;
};

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
        <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-sky" />
      )}
    </span>
  );
}

function AvatarStack({ avatars }: { avatars: ChatAvatar[] }) {
  const visibleAvatars = avatars.length > 0 ? avatars : [fallbackAvatar];

  return (
    <div className="flex -space-x-3">
      {visibleAvatars.slice(0, 4).map((avatar, index) => (
        <AvatarCircle
          key={`${avatar.userId ?? avatar.initials}-${index}`}
          avatar={avatar}
          size="md"
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
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [threads, setThreads] = useState(initialThreads);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(
    initialThreads[0]?.id ?? null
  );
  const [activePanel, setActivePanel] = useState<"messages" | "thread">(
    "messages"
  );
  const [messagesByThreadId, setMessagesByThreadId] = useState<
    Record<string, ChatMessage[]>
  >({});
  const [loadingThreadId, setLoadingThreadId] = useState<string | null>(null);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [messageDraft, setMessageDraft] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [recipientFilter, setRecipientFilter] = useState("");
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>([]);
  const [groupTitle, setGroupTitle] = useState("");
  const [isCreatingThread, setIsCreatingThread] = useState(false);
  const [createThreadError, setCreateThreadError] = useState<string | null>(null);

  const selectedThread =
    threads.find((thread) => thread.id === selectedThreadId) ?? null;
  const hasSelectedMessagesLoaded = selectedThreadId
    ? Object.prototype.hasOwnProperty.call(messagesByThreadId, selectedThreadId)
    : false;
  const selectedMessages = selectedThreadId
    ? messagesByThreadId[selectedThreadId] ?? []
    : [];
  const isLoadingSelectedThread =
    loadingThreadId === selectedThreadId && !hasSelectedMessagesLoaded;
  const activeThreadIds = useMemo(
    () => threads.map((thread) => thread.id).sort(),
    [threads]
  );
  const activeThreadIdsKey = activeThreadIds.join(",");

  const onlineAvatars = useMemo(() => {
    const seen = new Set<string>();
    const avatars: ChatAvatar[] = [];

    for (const thread of threads) {
      for (const member of thread.members) {
        if (member.userId === currentUserId) {
          continue;
        }

        if (seen.has(member.userId)) {
          continue;
        }

        seen.add(member.userId);
        avatars.push(member.avatar);
      }
    }

    if (avatars.length === 0) {
      for (const recipient of recipients) {
        if (recipient.userId === currentUserId || seen.has(recipient.userId)) {
          continue;
        }

        seen.add(recipient.userId);
        avatars.push(recipient.avatar);
      }
    }

    return avatars.slice(0, 8);
  }, [currentUserId, recipients, threads]);

  const appendMessageToThread = useCallback((message: ChatMessage) => {
    setMessagesByThreadId((currentMessages) => {
      const threadMessages = currentMessages[message.thread_id] ?? [];

      if (threadMessages.some((existingMessage) => existingMessage.id === message.id)) {
        return currentMessages;
      }

      return {
        ...currentMessages,
        [message.thread_id]: [...threadMessages, message].sort(
          (first, second) =>
            new Date(first.created_at).getTime() -
            new Date(second.created_at).getTime()
        ),
      };
    });
  }, []);

  useEffect(() => {
    if (
      !selectedThreadId ||
      hasSelectedMessagesLoaded ||
      loadingThreadId === selectedThreadId
    ) {
      return;
    }

    let isActive = true;

    async function loadMessages(threadId: string) {
      setLoadingThreadId(threadId);
      setMessageError(null);

      const { data, error } = await supabase
        .from("chat_messages")
        .select("id, thread_id, sender_user_id, body, created_at")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (!isActive) {
        return;
      }

      if (error) {
        setMessageError(
          "We could not load this conversation. Please try again in a moment."
        );
        setLoadingThreadId(null);
        return;
      }

      const rows = ((data ?? []) as ChatMessage[]).slice().reverse();

      setMessagesByThreadId((current) => ({
        ...current,
        [threadId]: rows,
      }));
      setLoadingThreadId(null);
    }

    void loadMessages(selectedThreadId);

    return () => {
      isActive = false;
    };
  }, [
    hasSelectedMessagesLoaded,
    loadingThreadId,
    selectedThreadId,
    supabase,
  ]);

  useEffect(() => {
    if (activeThreadIds.length === 0) {
      return;
    }

    const channel = supabase.channel(
      `family-chat-messages:${currentUserId}:${activeThreadIdsKey}`
    );

    for (const threadId of activeThreadIds) {
      channel.on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `thread_id=eq.${threadId}`,
        },
        (payload) => {
          const message = payload.new as ChatMessage;

          if (!message?.id || !message.thread_id) {
            return;
          }

          appendMessageToThread(message);
          updateThreadPreview(message);
          setMessageError(null);
          setLoadingThreadId((currentThreadId) =>
            currentThreadId === message.thread_id ? null : currentThreadId
          );
        }
      );
    }

    channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [
    activeThreadIds,
    activeThreadIdsKey,
    appendMessageToThread,
    currentUserId,
    supabase,
  ]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [selectedMessages.length, selectedThreadId]);

  function selectThread(threadId: string) {
    setSelectedThreadId(threadId);
    setActivePanel("thread");
    setSendError(null);
  }

  function getMemberForMessage(message: ChatMessage) {
    return selectedThread?.members.find(
      (member) => member.userId === message.sender_user_id
    );
  }

  const canSendMessage =
    Boolean(selectedThread) && messageDraft.trim().length > 0 && !isSendingMessage;
  const selectedRecipients = recipients.filter((recipient) =>
    selectedRecipientIds.includes(recipient.userId)
  );
  const filteredRecipients = recipients.filter((recipient) =>
    recipient.displayName
      .toLowerCase()
      .includes(recipientFilter.trim().toLowerCase())
  );

  function buildNewThreadSummary({
    threadId,
    selectedMembers,
  }: {
    threadId: string;
    selectedMembers: ChatRecipientOption[];
  }): ChatThreadSummary {
    const threadType = selectedMembers.length === 1 ? "direct" : "group";
    const members: ChatThreadMemberSummary[] = [
      currentUser,
      ...selectedMembers.map((member) => ({
        userId: member.userId,
        displayName: member.displayName,
        avatar: member.avatar,
      })),
    ];
    const now = new Date().toISOString();
    const title =
      threadType === "direct"
        ? selectedMembers[0]?.displayName ?? "Family member"
        : groupTitle.trim() ||
          selectedMembers
            .slice(0, 3)
            .map((recipient) => recipient.displayName)
            .join(", ") ||
          "Family group";

    return {
      id: threadId,
      threadType,
      name: title,
      lastActivityAt: now,
      lastActivityLabel: formatActivityLabel(now),
      preview: null,
      avatars:
        threadType === "direct"
          ? [selectedMembers[0]?.avatar ?? fallbackAvatar]
          : members.slice(0, 4).map((member) => member.avatar),
      members,
      memberCount: members.length,
      onlineCount: 1,
    };
  }

  function updateThreadPreview(message: ChatMessage) {
    setThreads((currentThreads) =>
      currentThreads
        .map((thread) => {
          if (thread.id !== message.thread_id) {
            return thread;
          }

          return {
            ...thread,
            lastActivityAt: message.created_at,
            lastActivityLabel: formatActivityLabel(message.created_at),
            preview: message.body,
          };
        })
        .sort((first, second) => {
          const firstTime = first.lastActivityAt
            ? new Date(first.lastActivityAt).getTime()
            : 0;
          const secondTime = second.lastActivityAt
            ? new Date(second.lastActivityAt).getTime()
            : 0;

          return secondTime - firstTime;
        })
    );
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
    if (selectedRecipients.length === 0) {
      setCreateThreadError("Choose at least one family member.");
      return;
    }

    setIsCreatingThread(true);
    setCreateThreadError(null);

    try {
      const { data, error } = await supabase.rpc("create_chat_thread", {
        recipient_user_ids: selectedRecipientIds,
        thread_title:
          selectedRecipients.length > 1 && groupTitle.trim()
            ? groupTitle.trim()
            : null,
      });

      if (error) {
        throw error;
      }

      const threadId = data as string;
      const existingThread = threads.find((thread) => thread.id === threadId);

      if (!existingThread) {
        const newThread = buildNewThreadSummary({
          threadId,
          selectedMembers: selectedRecipients,
        });

        setThreads((currentThreads) => [newThread, ...currentThreads]);
        setMessagesByThreadId((currentMessages) => ({
          ...currentMessages,
          [threadId]: currentMessages[threadId] ?? [],
        }));
      }

      setSelectedThreadId(threadId);
      setActivePanel("thread");
      setIsComposeOpen(false);
      resetComposeModal();
    } catch (error) {
      console.error("Could not create chat thread", error);
      setCreateThreadError(
        "We could not start that conversation. Please check the selected family members and try again."
      );
    } finally {
      setIsCreatingThread(false);
    }
  }

  async function insertMessageWithFallback({
    threadId,
    body,
  }: {
    threadId: string;
    body: string;
  }) {
    const rpcResponse = await supabase.rpc("send_chat_message", {
      thread_uuid: threadId,
      message_body: body,
    });

    if (!rpcResponse.error) {
      return rpcResponse.data as ChatMessage;
    }

    const missingRpc =
      rpcResponse.error.code === "PGRST202" ||
      rpcResponse.error.message.toLowerCase().includes("function");

    if (!missingRpc) {
      throw rpcResponse.error;
    }

    const { data, error } = await supabase
      .from("chat_messages")
      .insert({
        thread_id: threadId,
        sender_user_id: currentUserId,
        body,
      })
      .select("id, thread_id, sender_user_id, body, created_at")
      .single();

    if (error) {
      throw error;
    }

    const insertedMessage = data as ChatMessage;

    await supabase
      .from("chat_threads")
      .update({ last_message_at: insertedMessage.created_at })
      .eq("id", threadId);

    return insertedMessage;
  }

  async function sendMessage(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    if (!selectedThread) {
      setSendError("Choose a conversation before sending a message.");
      return;
    }

    const body = messageDraft.trim();

    if (!body) {
      setSendError("Write a message before sending.");
      return;
    }

    setIsSendingMessage(true);
    setSendError(null);

    try {
      const sentMessage = await insertMessageWithFallback({
        threadId: selectedThread.id,
        body,
      });

      appendMessageToThread(sentMessage);
      updateThreadPreview(sentMessage);
      setMessageDraft("");
    } catch (error) {
      console.error("Could not send chat message", error);
      setSendError(
        "We could not send that message. Please check the conversation and try again."
      );
    } finally {
      setIsSendingMessage(false);
    }
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  }

  return (
    <section className="flex min-h-[calc(100svh-77px)] w-full flex-col overflow-x-hidden lg:mx-auto lg:min-h-screen lg:max-w-7xl lg:gap-5 lg:px-8 lg:py-8">
      <div className="grid min-h-[calc(100svh-77px)] w-full min-w-0 lg:min-h-[calc(100svh-64px)] lg:grid-cols-[360px_minmax(0,1fr)] lg:gap-5">
        <aside
          className={`min-w-0 bg-white ${
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
                onClick={() => setIsComposeOpen(true)}
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
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-night-sky/45">
                  Online now
                </h2>
                <button
                  type="button"
                  disabled
                  className="text-xs font-bold uppercase tracking-[0.12em] text-sky-depth opacity-60"
                >
                  All
                </button>
              </div>

              {onlineAvatars.length > 0 ? (
                <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
                  {onlineAvatars.map((avatar, index) => (
                    <AvatarCircle
                      key={`${avatar.userId ?? avatar.initials}-${index}`}
                      avatar={avatar}
                      size="lg"
                      showOnline
                    />
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-night-sky/50">
                  Online presence will appear here soon.
                </p>
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
                      <AvatarStack avatars={thread.avatars} />
                    ) : (
                      <AvatarCircle
                        avatar={thread.avatars[0] ?? fallbackAvatar}
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
          className={`min-h-[calc(100svh-77px)] min-w-0 flex-col overflow-hidden bg-white ${
            activePanel === "thread" ? "flex" : "hidden"
          } lg:flex lg:min-h-[620px] lg:rounded-3xl lg:border lg:border-night-sky/10 lg:shadow-sm`}
        >
          {selectedThread ? (
            <>
              <header className="flex flex-col gap-4 border-b border-night-sky/10 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => setActivePanel("messages")}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-night-sky/10 bg-white text-night-sky/75 shadow-sm hover:bg-sand lg:hidden"
                    aria-label="Back to messages"
                  >
                    <BackIcon />
                  </button>

                  <AvatarStack avatars={selectedThread.avatars} />
                  <div>
                    <h2 className="text-2xl font-black text-night-sky">
                      {selectedThread.name}
                    </h2>
                    <p className="mt-1 text-sm text-night-sky/55">
                      {selectedThread.lastActivityLabel || "No recent activity"}{" "}
                      · {selectedThread.memberCount}{" "}
                      {selectedThread.memberCount === 1 ? "member" : "members"},
                      {" "}
                      <span className="font-semibold text-teal">
                        {selectedThread.onlineCount} online
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <IconButton label="Phone call" disabled comingSoon>
                    <PhoneIcon />
                  </IconButton>
                  <IconButton label="Video call" disabled comingSoon>
                    <VideoIcon />
                  </IconButton>
                  <IconButton label="Conversation options" disabled comingSoon>
                    <EllipsisIcon />
                  </IconButton>
                </div>
              </header>

              <div className="flex-1 space-y-5 overflow-y-auto bg-sand/55 p-5">
                {messageError ? (
                  <EmptyState title="Conversation unavailable" body={messageError} />
                ) : isLoadingSelectedThread ? (
                  <div className="rounded-3xl border border-night-sky/10 bg-white p-5 text-sm text-night-sky/55 shadow-sm">
                    Loading conversation...
                  </div>
                ) : selectedMessages.length === 0 ? (
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
                            className={`mt-1 rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${
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
                <div ref={messagesEndRef} />
              </div>

              <div className="border-t border-night-sky/10 bg-white p-4">
                <form onSubmit={sendMessage} className="space-y-2">
                  <div className="flex items-end gap-3 rounded-2xl border border-night-sky/10 bg-sand p-2 shadow-inner">
                    <textarea
                      value={messageDraft}
                      onChange={(event) => {
                        setMessageDraft(event.target.value);
                        setSendError(null);
                      }}
                      onKeyDown={handleComposerKeyDown}
                      placeholder="Write a message..."
                      aria-label="Write a message"
                      rows={1}
                      disabled={isSendingMessage}
                      className="max-h-32 min-h-11 flex-1 resize-none border-0 bg-transparent px-3 py-3 text-sm leading-5 text-night-sky shadow-none outline-none placeholder:text-night-sky/40 focus:ring-0 disabled:cursor-not-allowed disabled:opacity-60"
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
                title="Choose a conversation"
                body="Your family messages will open here once a conversation is selected."
              />
            </div>
          )}
        </article>
      </div>

      {isComposeOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-night-sky/35 p-0 sm:items-center sm:p-6">
          <div className="max-h-[90svh] w-full overflow-hidden rounded-t-3xl border border-night-sky/10 bg-white shadow-xl sm:max-w-xl sm:rounded-3xl">
            <div className="border-b border-night-sky/10 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black text-night-sky">
                    New message
                  </h2>
                  <p className="mt-1 text-sm text-night-sky/55">
                    Choose family members who already have LegacyLink accounts.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsComposeOpen(false);
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
              {recipients.length === 0 ? (
                <EmptyState
                  title="No messageable family yet"
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

            {selectedRecipients.length > 1 && (
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
                    setIsComposeOpen(false);
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
                    ? "Starting..."
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
