"use client";

import { useState } from "react";

type Avatar = {
  initials: string;
  color: string;
};

type Thread = {
  id: string;
  name: string;
  time: string;
  preview: string;
  avatars: Avatar[];
};

type Message = {
  id: string;
  senderName: string;
  timestamp: string;
  body: string;
  avatar: Avatar;
  isCurrentUser?: boolean;
};

const onlineAvatars: Avatar[] = [
  { initials: "CG", color: "bg-sky" },
  { initials: "CK", color: "bg-coral" },
  { initials: "BR", color: "bg-leaf" },
  { initials: "MG", color: "bg-teal" },
  { initials: "JG", color: "bg-sunshine" },
];

const threads: Thread[] = [
  {
    id: "gentry-family",
    name: "Gentry Family",
    time: "4:42 PM",
    preview: "Caleb: Hey I hope you have a wonderful day today.",
    avatars: onlineAvatars.slice(0, 4),
  },
  {
    id: "celine-knapp",
    name: "Celine Knapp",
    time: "Tue",
    preview: "Check out this link",
    avatars: [{ initials: "CK", color: "bg-coral" }],
  },
  {
    id: "billy-ruggles",
    name: "Billy Ruggles",
    time: "Jun 18",
    preview: "Cool",
    avatars: [{ initials: "BR", color: "bg-leaf" }],
  },
];

const messages: Message[] = [
  {
    id: "1",
    senderName: "Caleb Gentry",
    timestamp: "4:38 PM",
    body: "Hey I hope you have a wonderful day today.",
    avatar: { initials: "CG", color: "bg-sky" },
    isCurrentUser: true,
  },
  {
    id: "2",
    senderName: "Celine Gentry",
    timestamp: "4:39 PM",
    body: "You too!",
    avatar: { initials: "CG", color: "bg-coral" },
  },
  {
    id: "3",
    senderName: "Celine Gentry",
    timestamp: "4:40 PM",
    body: "Check out this link",
    avatar: { initials: "CG", color: "bg-coral" },
  },
  {
    id: "4",
    senderName: "Caleb Gentry",
    timestamp: "4:42 PM",
    body: "Cool",
    avatar: { initials: "CG", color: "bg-sky" },
    isCurrentUser: true,
  },
];

function AvatarCircle({
  avatar,
  size = "md",
  showOnline = false,
  className = "",
}: {
  avatar: Avatar;
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
      className={`relative inline-flex shrink-0 items-center justify-center rounded-full ${avatar.color} font-black text-white ring-2 ring-white ${sizeClasses[size]} ${className}`}
    >
      {avatar.initials}
      {showOnline && (
        <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-sky" />
      )}
    </span>
  );
}

function AvatarStack({ avatars }: { avatars: Avatar[] }) {
  return (
    <div className="flex -space-x-3">
      {avatars.slice(0, 4).map((avatar, index) => (
        <AvatarCircle
          key={`${avatar.initials}-${index}`}
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
}: {
  label: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={label}
      title={disabled ? `${label} coming soon` : label}
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

export default function FamilyChatShell() {
  const [selectedThreadId, setSelectedThreadId] = useState("gentry-family");
  const [activePanel, setActivePanel] = useState<"messages" | "thread">(
    "messages"
  );
  const selectedThread =
    threads.find((thread) => thread.id === selectedThreadId) ?? threads[0];

  function selectThread(threadId: string) {
    setSelectedThreadId(threadId);
    setActivePanel("thread");
  }

  return (
    <section className="flex min-h-[calc(100svh-77px)] w-full flex-col overflow-x-hidden lg:mx-auto lg:min-h-screen lg:max-w-7xl lg:gap-5 lg:px-8 lg:py-8">
      <div className="grid min-h-[calc(100svh-77px)] w-full min-w-0 lg:min-h-[calc(100svh-64px)] lg:gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
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
              <IconButton label="Start a new message" disabled>
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

              <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
                {onlineAvatars.map((avatar, index) => (
                  <AvatarCircle
                    key={`${avatar.initials}-${index}`}
                    avatar={avatar}
                    size="lg"
                    showOnline
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="border-t border-night-sky/10 p-3">
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
                    <AvatarCircle avatar={thread.avatars[0]} size="md" />
                  )}

                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-3">
                      <span className="truncate font-semibold text-night-sky">
                        {thread.name}
                      </span>
                      <span className="shrink-0 text-xs font-medium text-night-sky/45">
                        {thread.time}
                      </span>
                    </span>
                    <span className="mt-1 block truncate text-sm text-night-sky/55">
                      {thread.preview}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <article
          className={`min-h-[calc(100svh-77px)] min-w-0 flex-col overflow-hidden bg-white ${
            activePanel === "thread" ? "flex" : "hidden"
          } lg:flex lg:min-h-[620px] lg:rounded-3xl lg:border lg:border-night-sky/10 lg:shadow-sm`}
        >
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
                  {selectedThread.time} · 8 members,{" "}
                  <span className="font-semibold text-teal">3 online</span>
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <IconButton label="Phone call" disabled>
                <PhoneIcon />
              </IconButton>
              <IconButton label="Video call" disabled>
                <VideoIcon />
              </IconButton>
              <IconButton label="Conversation options" disabled>
                <EllipsisIcon />
              </IconButton>
            </div>
          </header>

          <div className="flex-1 space-y-5 overflow-y-auto bg-sand/55 p-5">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${
                  message.isCurrentUser ? "sm:flex-row-reverse" : ""
                }`}
              >
                <AvatarCircle avatar={message.avatar} size="sm" />

                <div
                  className={`max-w-[min(100%,560px)] ${
                    message.isCurrentUser ? "sm:text-right" : ""
                  }`}
                >
                  <div
                    className={`flex items-center gap-2 text-xs text-night-sky/45 ${
                      message.isCurrentUser
                        ? "sm:flex-row-reverse"
                        : ""
                    }`}
                  >
                    <span className="font-semibold text-night-sky/65">
                      {message.senderName}
                    </span>
                    <span>{message.timestamp}</span>
                  </div>

                  <div
                    className={`mt-1 rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${
                      message.isCurrentUser
                        ? "bg-sky text-white"
                        : "border border-night-sky/10 bg-white text-night-sky/75"
                    }`}
                  >
                    {message.body}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-night-sky/10 bg-white p-4">
            <div className="flex items-center gap-3 rounded-2xl border border-night-sky/10 bg-sand px-4 py-3 text-sm text-night-sky/50">
              Message composer coming in a later phase.
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
