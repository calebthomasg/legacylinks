import { redirect } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import FamilyChatShell, {
  type ChatRecipientOption,
  type ChatThreadMemberSummary,
  type ChatThreadSummary,
} from "@/components/chat/FamilyChatShell";
import { createClient } from "@/utils/supabase/server";
import { getProfileNavHref } from "@/utils/people/getProfileNavHref";

type ChatThreadRow = {
  id: string;
  thread_type: "direct" | "group";
  title: string | null;
  created_by_user_id: string;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type CurrentUserMembershipRow = {
  thread_id: string;
  chat_threads: ChatThreadRow | ChatThreadRow[] | null;
};

type ChatMemberRow = {
  thread_id: string;
  user_id: string;
  person_id: string | null;
  role: "owner" | "member";
  left_at: string | null;
};

type ProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

type LinkedPersonRow = {
  id: string;
  linked_user_id: string | null;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  profile_photo_path: string | null;
};

type MessagePreviewRow = {
  id: string;
  thread_id: string;
  sender_user_id: string;
  body: string;
  created_at: string;
};

const avatarColors = [
  "bg-sky",
  "bg-coral",
  "bg-leaf",
  "bg-teal",
  "bg-sunshine",
];

function getSingleThread(
  value: ChatThreadRow | ChatThreadRow[] | null
): ChatThreadRow | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

function getInitials(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return "LL";
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function getAvatarColor(userId: string) {
  const total = Array.from(userId).reduce(
    (sum, character) => sum + character.charCodeAt(0),
    0
  );

  return avatarColors[total % avatarColors.length];
}

function getProfileName(profile: ProfileRow | undefined) {
  return [profile?.first_name, profile?.last_name].filter(Boolean).join(" ");
}

function getPersonName(person: LinkedPersonRow | undefined) {
  return (
    person?.display_name ||
    [person?.first_name, person?.last_name].filter(Boolean).join(" ")
  );
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

async function createPhotoUrlMap(
  supabase: Awaited<ReturnType<typeof createClient>>,
  photoPaths: string[]
) {
  const uniquePaths = Array.from(new Set(photoPaths.filter(Boolean)));
  const entries = await Promise.all(
    uniquePaths.map(async (path) => {
      const { data } = await supabase.storage
        .from("person-photos")
        .createSignedUrl(path, 60 * 60, {
          transform: {
            width: 96,
            height: 96,
            resize: "cover",
            quality: 70,
          },
        });

      return [path, data?.signedUrl ?? null] as const;
    })
  );

  return new Map(entries);
}

function buildAvatar({
  userId,
  displayName,
  photoUrl,
}: {
  userId: string;
  displayName: string;
  photoUrl: string | null;
}) {
  return {
    userId,
    initials: getInitials(displayName),
    color: getAvatarColor(userId),
    photoUrl,
  };
}

function buildMemberSummary({
  member,
  profile,
  person,
  photoUrl,
}: {
  member: ChatMemberRow;
  profile: ProfileRow | undefined;
  person: LinkedPersonRow | undefined;
  photoUrl: string | null;
}): ChatThreadMemberSummary {
  const displayName =
    getProfileName(profile) || getPersonName(person) || "Family member";

  return {
    userId: member.user_id,
    displayName,
    avatar: buildAvatar({
      userId: member.user_id,
      displayName,
      photoUrl,
    }),
  };
}

async function loadCurrentUserSummary({
  currentUserId,
  displayName,
  supabase,
}: {
  currentUserId: string;
  displayName: string;
  supabase: Awaited<ReturnType<typeof createClient>>;
}): Promise<ChatThreadMemberSummary> {
  const { data: person } = await supabase
    .from("people")
    .select("id, linked_user_id, first_name, last_name, display_name, profile_photo_path")
    .eq("linked_user_id", currentUserId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const typedPerson = person as LinkedPersonRow | null;
  const personName = getPersonName(typedPerson ?? undefined);
  const resolvedDisplayName = personName || displayName || "LegacyLinks";
  const photoUrlMap = await createPhotoUrlMap(
    supabase,
    typedPerson?.profile_photo_path ? [typedPerson.profile_photo_path] : []
  );

  return {
    userId: currentUserId,
    displayName: resolvedDisplayName,
    avatar: buildAvatar({
      userId: currentUserId,
      displayName: resolvedDisplayName,
      photoUrl: typedPerson?.profile_photo_path
        ? photoUrlMap.get(typedPerson.profile_photo_path) ?? null
        : null,
    }),
  };
}

async function loadMessageableRecipients({
  currentUserId,
  supabase,
}: {
  currentUserId: string;
  supabase: Awaited<ReturnType<typeof createClient>>;
}): Promise<ChatRecipientOption[]> {
  const { data: peopleData } = await supabase
    .from("people")
    .select("id, linked_user_id, first_name, last_name, display_name, profile_photo_path")
    .eq("created_by_user_id", currentUserId)
    .not("linked_user_id", "is", null)
    .neq("linked_user_id", currentUserId)
    .order("first_name", { ascending: true })
    .limit(100);

  const people = ((peopleData ?? []) as LinkedPersonRow[]).filter(
    (person) => person.linked_user_id
  );
  const photoUrlByPath = await createPhotoUrlMap(
    supabase,
    people
      .map((person) => person.profile_photo_path)
      .filter((path): path is string => Boolean(path))
  );

  return people.map((person) => {
    const displayName = getPersonName(person) || "Family member";
    const userId = person.linked_user_id as string;

    return {
      userId,
      personId: person.id,
      displayName,
      avatar: buildAvatar({
        userId,
        displayName,
        photoUrl: person.profile_photo_path
          ? photoUrlByPath.get(person.profile_photo_path) ?? null
          : null,
      }),
    };
  });
}

function buildThreadName({
  thread,
  currentUserId,
  members,
}: {
  thread: ChatThreadRow;
  currentUserId: string;
  members: ChatThreadMemberSummary[];
}) {
  if (thread.thread_type === "group") {
    return (
      thread.title ||
      members
        .slice(0, 3)
        .map((member) => member.displayName)
        .join(", ") ||
      "Family group"
    );
  }

  return (
    members.find((member) => member.userId !== currentUserId)?.displayName ||
    members[0]?.displayName ||
    "Family member"
  );
}

async function loadInitialThreads({
  currentUserId,
  supabase,
}: {
  currentUserId: string;
  supabase: Awaited<ReturnType<typeof createClient>>;
}): Promise<ChatThreadSummary[]> {
  const { data: membershipData } = await supabase
    .from("chat_thread_members")
    .select(
      `
        thread_id,
        chat_threads (
          id,
          thread_type,
          title,
          created_by_user_id,
          last_message_at,
          created_at,
          updated_at,
          deleted_at
        )
      `
    )
    .eq("user_id", currentUserId)
    .is("left_at", null)
    .limit(50);

  const currentUserMemberships = (membershipData ??
    []) as CurrentUserMembershipRow[];
  const threads = currentUserMemberships
    .map((membership) => getSingleThread(membership.chat_threads))
    .filter(
      (thread): thread is ChatThreadRow => Boolean(thread && !thread.deleted_at)
    );

  const threadIds = threads.map((thread) => thread.id);

  if (threadIds.length === 0) {
    return [];
  }

  const [{ data: memberData }, { data: previewData }] = await Promise.all([
    supabase
      .from("chat_thread_members")
      .select("thread_id, user_id, person_id, role, left_at")
      .in("thread_id", threadIds)
      .is("left_at", null)
      .limit(250),
    supabase
      .from("chat_messages")
      .select("id, thread_id, sender_user_id, body, created_at")
      .in("thread_id", threadIds)
      .order("created_at", { ascending: false })
      .limit(Math.max(threadIds.length * 3, 50)),
  ]);

  const members = (memberData ?? []) as ChatMemberRow[];
  const userIds = Array.from(new Set(members.map((member) => member.user_id)));

  const [{ data: profilesData }, { data: peopleData }] = await Promise.all([
    userIds.length > 0
      ? supabase
          .from("profiles")
          .select("id, first_name, last_name")
          .in("id", userIds)
      : Promise.resolve({ data: [] }),
    userIds.length > 0
      ? supabase
          .from("people")
          .select(
            "id, linked_user_id, first_name, last_name, display_name, profile_photo_path"
          )
          .in("linked_user_id", userIds)
      : Promise.resolve({ data: [] }),
  ]);

  const profilesByUserId = new Map(
    ((profilesData ?? []) as ProfileRow[]).map((profile) => [
      profile.id,
      profile,
    ])
  );
  const peopleByUserId = new Map(
    ((peopleData ?? []) as LinkedPersonRow[])
      .filter((person) => person.linked_user_id)
      .map((person) => [person.linked_user_id as string, person])
  );
  const photoUrlByPath = await createPhotoUrlMap(
    supabase,
    Array.from(peopleByUserId.values())
      .map((person) => person.profile_photo_path)
      .filter((path): path is string => Boolean(path))
  );
  const membersByThreadId = members.reduce((map, member) => {
    const group = map.get(member.thread_id) ?? [];
    const person = peopleByUserId.get(member.user_id);
    group.push(
      buildMemberSummary({
        member,
        profile: profilesByUserId.get(member.user_id),
        person,
        photoUrl: person?.profile_photo_path
          ? photoUrlByPath.get(person.profile_photo_path) ?? null
          : null,
      })
    );
    map.set(member.thread_id, group);
    return map;
  }, new Map<string, ChatThreadMemberSummary[]>());
  const previewByThreadId = new Map<string, MessagePreviewRow>();

  for (const preview of (previewData ?? []) as MessagePreviewRow[]) {
    if (!previewByThreadId.has(preview.thread_id)) {
      previewByThreadId.set(preview.thread_id, preview);
    }
  }

  return threads
    .map((thread) => {
      const threadMembers = membersByThreadId.get(thread.id) ?? [];
      const preview = previewByThreadId.get(thread.id);
      const lastActivityAt =
        thread.last_message_at || preview?.created_at || thread.updated_at || thread.created_at;
      const avatars =
        thread.thread_type === "direct"
          ? [
              threadMembers.find((member) => member.userId !== currentUserId)
                ?.avatar ??
                threadMembers[0]?.avatar ?? {
                  initials: "LL",
                  color: "bg-sky",
                },
            ]
          : threadMembers.slice(0, 4).map((member) => member.avatar);

      return {
        id: thread.id,
        threadType: thread.thread_type,
        name: buildThreadName({
          thread,
          currentUserId,
          members: threadMembers,
        }),
        lastActivityAt,
        lastActivityLabel: formatActivityLabel(lastActivityAt),
        preview: preview?.body ?? null,
        avatars,
        members: threadMembers,
        memberCount: threadMembers.length,
        onlineCount: threadMembers.some(
          (member) => member.userId === currentUserId
        )
          ? 1
          : 0,
      } satisfies ChatThreadSummary;
    })
    .sort((first, second) => {
      const firstTime = first.lastActivityAt
        ? new Date(first.lastActivityAt).getTime()
        : 0;
      const secondTime = second.lastActivityAt
        ? new Date(second.lastActivityAt).getTime()
        : 0;

      return secondTime - firstTime;
    });
}

export default async function FamilyChatPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const profileHref = await getProfileNavHref(user.id);

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", user.id)
    .single();

  const userName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    profile?.first_name ||
    "LegacyLinks";
  const [initialThreads, currentUser, recipients] = await Promise.all([
    loadInitialThreads({
      currentUserId: user.id,
      supabase,
    }),
    loadCurrentUserSummary({
      currentUserId: user.id,
      displayName: userName,
      supabase,
    }),
    loadMessageableRecipients({
      currentUserId: user.id,
      supabase,
    }),
  ]);

  return (
    <AppShell
      active="family-chat"
      userName={userName}
      userEmail={user.email}
      profileHref={profileHref}
      contentClassName="bg-sand"
    >
      <FamilyChatShell
        currentUserId={user.id}
        currentUser={currentUser}
        initialThreads={initialThreads}
        recipients={recipients}
      />
    </AppShell>
  );
}
