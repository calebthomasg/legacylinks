import { getFamilyCallConfig } from "@/lib/family-calls/config";
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
  group_image_path: string | null;
  theme_id: string | null;
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
  nickname: string | null;
  muted_at: string | null;
  muted_until: string | null;
  message_alerts: boolean;
  notification_tone: string;
  play_sounds: boolean;
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
  thread_id: string;
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
  const { data, error } = await supabase.rpc("chat_connected_user_ids");
  if (error) throw new Error("Could not load connected family members", { cause: error });
  const userIds = (data ?? []) as string[];
  if (!userIds.length) return [];

  const [{ data: peopleData }, { data: profilesData }] = await Promise.all([
    supabase.from("people")
      .select("id, linked_user_id, first_name, last_name, display_name, profile_photo_path")
      .eq("created_by_user_id", currentUserId)
      .in("linked_user_id", userIds)
      .order("created_at", { ascending: true }),
    supabase.rpc("read_chat_names", { user_ids: userIds }),
  ]);
  const people = new Map(((peopleData ?? []) as LinkedPersonRow[])
    .map((person) => [person.linked_user_id, person]));
  const profiles = new Map(((profilesData ?? []) as ProfileRow[])
    .map((profile) => [profile.id, profile]));
  const photoUrlByPath = await createPhotoUrlMap(supabase, [...people.values()]
    .flatMap((person) => person.profile_photo_path ? [person.profile_photo_path] : []));

  return userIds.map((userId) => {
    const person = people.get(userId);
    const displayName = getPersonName(person) || getProfileName(profiles.get(userId)) || "Family member";
    return {
      userId,
      personId: person?.id ?? null,
      displayName,
      avatar: buildAvatar({
        userId,
        displayName,
        photoUrl: person?.profile_photo_path
          ? photoUrlByPath.get(person.profile_photo_path) ?? null
          : null,
      }),
    };
  }).sort((first, second) => first.displayName.localeCompare(second.displayName));
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
  const { data: membershipData, error: membershipError } = await supabase
    .from("chat_thread_members")
    .select(
      `
        thread_id,
        chat_threads (
          id,
          thread_type,
          title,
          group_image_path,
          theme_id,
          created_by_user_id,
          last_message_at,
          created_at,
          updated_at,
          deleted_at
        )
      `
    )
    .eq("user_id", currentUserId)
    .is("left_at", null);
  if (membershipError) throw new Error("Could not load family conversations", { cause: membershipError });

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

  const groupImages = threads.flatMap((thread) => thread.group_image_path ? [thread.group_image_path] : []);
  const [membersResult, previewsResult, groupImagesResult] = await Promise.all([
    supabase
      .from("chat_thread_members")
      .select("thread_id, user_id, person_id, role, left_at, nickname, muted_at, muted_until, message_alerts, notification_tone, play_sounds")
      .in("thread_id", threadIds),
    supabase.rpc("read_chat_previews", { thread_ids: threadIds }),
    groupImages.length
      ? supabase.storage.from("family-chat-private").createSignedUrls(groupImages, 600)
      : Promise.resolve({ data: [] }),
  ]);
  const groupImageUrls = new Map((groupImagesResult.data ?? []).map((entry) => [entry.path, entry.signedUrl]));

  if (membersResult.error || previewsResult.error) {
    throw new Error("Could not load conversation details", { cause: membersResult.error ?? previewsResult.error });
  }
  const members = (membersResult.data ?? []) as ChatMemberRow[];
  const userIds = Array.from(new Set(members.map((member) => member.user_id)));

  const [{ data: profilesData }, { data: peopleData }] = await Promise.all([
    userIds.length > 0
      ? supabase.rpc("read_chat_names", { user_ids: userIds })
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
    group.push({
      ...buildMemberSummary({
        member,
        profile: profilesByUserId.get(member.user_id),
        person,
        photoUrl: person?.profile_photo_path
          ? photoUrlByPath.get(person.profile_photo_path) ?? null
          : null,
      }),
      active: !member.left_at,
      nickname: member.nickname,
      mutedAt: member.muted_at,
      mutedUntil: member.muted_until,
      messageAlerts: member.message_alerts,
      notificationTone: member.play_sounds && member.notification_tone !== "default" ? member.notification_tone : "silent",
    });
    map.set(member.thread_id, group);
    return map;
  }, new Map<string, (ChatThreadMemberSummary & { active: boolean; mutedAt: string | null; mutedUntil: string | null; messageAlerts: boolean; notificationTone: string })[]>());
  const previewByThreadId = new Map<string, MessagePreviewRow>();

  for (const preview of (previewsResult.data ?? []) as MessagePreviewRow[]) {
    if (!previewByThreadId.has(preview.thread_id)) {
      previewByThreadId.set(preview.thread_id, preview);
    }
  }

  return threads
    .map((thread) => {
      const allMembers = membersByThreadId.get(thread.id) ?? [];
      const threadMembers = allMembers.filter((member) => member.active);
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

      const ownMembership = threadMembers.find((member) => member.userId === currentUserId);
      return {
        id: thread.id,
        createdByUserId: thread.created_by_user_id,
        groupImagePath: thread.group_image_path,
        groupImageUrl: groupImageUrls.get(thread.group_image_path ?? "") ?? null,
        themeId: thread.theme_id,
        mutedAt: ownMembership?.mutedAt ?? null,
        mutedUntil: ownMembership?.mutedUntil ?? null,
        messageAlerts: ownMembership?.messageAlerts ?? true,
        notificationTone: ownMembership?.notificationTone ?? "silent",
        threadType: thread.thread_type,
        name: buildThreadName({
          thread,
          currentUserId,
          members: threadMembers,
        }),
        lastActivityAt,
        preview: preview?.body ?? null,
        avatars,
        members: threadMembers,
        pastMembers: allMembers.filter((member) => !member.active),
        memberCount: threadMembers.length,
        canAddMembers: thread.thread_type === "group",
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
    redirect("/login?next=/family-chat");
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
        callsEnabled={Boolean(getFamilyCallConfig())}
      />
    </AppShell>
  );
}
