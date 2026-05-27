import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import FindFamilyClient from "@/components/family/FindFamilyClient";

export default async function ConnectFamilyPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { data: currentUserPerson } = await supabase
    .from("people")
    .select("id, first_name, last_name, display_name")
    .eq("linked_user_id", user.id)
    .maybeSingle();

  const { data: existingPeople } = await supabase
    .from("people")
    .select("id, first_name, last_name, display_name, linked_user_id")
    .eq("created_by_user_id", user.id)
    .order("display_name", { ascending: true });

  const { data: incomingRequests } = await supabase.rpc(
    "get_incoming_family_connection_requests"
  );

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8">
        <p className="text-sm font-medium text-night-sky/60">Family</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-night-sky">
          Find Family
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-night-sky/70">
          Search for relatives on LegacyLinks, send a family connection request,
          and link their account to someone in your family tree.
        </p>
      </div>

      <FindFamilyClient
        currentUserId={user.id}
        currentUserPersonId={currentUserPerson?.id ?? null}
        existingPeople={existingPeople ?? []}
        incomingRequests={incomingRequests ?? []}
      />
    </main>
  );
}