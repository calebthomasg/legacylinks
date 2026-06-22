import { redirect } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import FamilyChatShell from "@/components/chat/FamilyChatShell";
import { createClient } from "@/utils/supabase/server";
import { getProfileNavHref } from "@/utils/people/getProfileNavHref";

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

  return (
    <AppShell
      active="family-chat"
      userName={userName}
      userEmail={user.email}
      profileHref={profileHref}
      contentClassName="bg-sand"
    >
      <FamilyChatShell />
    </AppShell>
  );
}
