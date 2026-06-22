import { createClient } from "@/utils/supabase/server";

export async function getProfileNavHref(userId: string) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("people")
    .select("id")
    .eq("linked_user_id", userId)
    .maybeSingle();

  // TODO: replace this fallback with a formal ensureSelfPerson/onboarding flow.
  return data?.id ? `/people/${data.id}` : "/family";
}
