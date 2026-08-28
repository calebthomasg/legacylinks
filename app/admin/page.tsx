import {redirect} from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import AdminDashboard from "@/components/admin/AdminDashboard";
import {createClient} from "@/utils/supabase/server";
import {getProfileNavHref} from "@/utils/people/getProfileNavHref";
type AdminRow={user_id:string;email:string|null;role:"super_admin"|"admin"|"fulfillment";created_at:string};
export default async function AdminPage(){const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login?next=/admin");const[{data:isAdmin},{data:isSuperAdmin},{data:admins},{data:profile},profileHref]=await Promise.all([supabase.rpc("is_legacy_link_admin"),supabase.rpc("is_legacy_link_super_admin"),supabase.rpc("list_legacy_link_admins"),supabase.from("profiles").select("first_name").eq("id",user.id).maybeSingle(),getProfileNavHref(user.id)]);if(!isAdmin)redirect("/dashboard");return <AppShell userName={profile?.first_name||"LegacyLink Admin"} userEmail={user.email} profileHref={profileHref} isAdmin={true} contentClassName="bg-sand"><AdminDashboard initialAdmins={(admins??[]) as AdminRow[]} isSuperAdmin={Boolean(isSuperAdmin)}/></AppShell>}
