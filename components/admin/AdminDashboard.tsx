"use client";

import {FormEvent,useMemo,useState} from "react";
import {createClient} from "@/utils/supabase/client";

type AdminRow={user_id:string;email:string|null;role:"super_admin"|"admin"|"fulfillment";created_at:string};
type ProvisionedBox={physical_box_id:string;box_id:string;activation_pin:string;nfc_public_token:string;nfc_path:string};

type Props={initialAdmins:AdminRow[];isSuperAdmin:boolean};

export default function AdminDashboard({initialAdmins,isSuperAdmin}:Props){
 const supabase=useMemo(()=>createClient(),[]);
 const[admins,setAdmins]=useState(initialAdmins);
 const[email,setEmail]=useState("");
 const[role,setRole]=useState<"admin"|"fulfillment">("admin");
 const[adminBusy,setAdminBusy]=useState(false);
 const[adminError,setAdminError]=useState<string|null>(null);
 const[edition,setEdition]=useState("");
 const[provisioning,setProvisioning]=useState(false);
 const[provisionError,setProvisionError]=useState<string|null>(null);
 const[provisioned,setProvisioned]=useState<ProvisionedBox|null>(null);

 async function refreshAdmins(){const{data}=await supabase.rpc("list_legacy_link_admins");if(data)setAdmins(data as AdminRow[])}
 async function addAdmin(e:FormEvent){e.preventDefault();setAdminError(null);setAdminBusy(true);const{error}=await supabase.rpc("grant_legacy_link_admin",{p_email:email.trim(),p_role:role});setAdminBusy(false);if(error){setAdminError(error.message);return}setEmail("");await refreshAdmins()}
 async function removeAdmin(userId:string){if(!confirm("Remove this admin's access?"))return;setAdminError(null);const{error}=await supabase.rpc("revoke_legacy_link_admin",{p_user_id:userId});if(error){setAdminError(error.message);return}await refreshAdmins()}
 async function provisionBox(){setProvisionError(null);setProvisioned(null);setProvisioning(true);const{data,error}=await supabase.rpc("admin_provision_physical_treasure_box",{p_edition:edition.trim()||null});setProvisioning(false);if(error){setProvisionError(error.message);return}const row=Array.isArray(data)?data[0]:data;if(row)setProvisioned(row as ProvisionedBox)}
 const fullNfcUrl=provisioned?`${window.location.origin}${provisioned.nfc_path}`:"";
 return <div className="mx-auto w-full max-w-6xl px-5 py-8 lg:px-8 lg:py-10">
   <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-teal">LegacyLink Admin</p><h1 className="mt-2 text-3xl font-bold text-night-sky">Operations</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-night-sky/60">Internal tools for fulfillment, physical Treasure Box provisioning, and administrative access.</p></div><a href="/trailhead" className="text-sm font-bold text-teal">Back to Trailhead →</a></div>
   <div className="mt-8 grid gap-6 lg:grid-cols-[1.05fr_.95fr]">
     <section className="rounded-3xl border border-night-sky/10 bg-white p-5 shadow-sm lg:p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-teal">Treasure Box fulfillment</p><h2 className="mt-1 text-xl font-bold text-night-sky">Prepare a physical box</h2></div><span className="rounded-full bg-sand px-3 py-1 text-xs font-bold text-night-sky/55">Internal</span></div><p className="mt-3 text-sm leading-6 text-night-sky/60">Generate the permanent Box ID, one-time activation PIN, and NFC URL together. Keep this screen open until the labels and NFC chip are prepared—the full PIN is only returned at provisioning time.</p>
       <label className="mt-5 block text-xs font-bold uppercase tracking-[.12em] text-night-sky/55">Edition <span className="normal-case tracking-normal text-night-sky/35">optional</span><input value={edition} onChange={e=>setEdition(e.target.value)} placeholder="Standard / First Edition" className="mt-2 w-full rounded-2xl border border-night-sky/15 px-4 py-3 text-sm outline-none focus:border-teal"/></label>
       <button onClick={provisionBox} disabled={provisioning} className="mt-4 w-full rounded-2xl bg-night-sky px-5 py-4 text-sm font-bold text-white disabled:opacity-50">{provisioning?"Preparing box…":"Prepare New Treasure Box"}</button>
       {provisionError&&<p className="mt-3 rounded-2xl bg-coral/10 p-3 text-sm font-semibold text-night-sky">{provisionError}</p>}
       {provisioned&&<div className="mt-5 rounded-2xl border-2 border-teal/30 bg-teal/5 p-4"><p className="text-xs font-bold uppercase tracking-[.14em] text-teal">Provisioning complete</p><dl className="mt-4 space-y-4"><div><dt className="text-xs font-semibold text-night-sky/45">Box ID</dt><dd className="mt-1 font-mono text-lg font-bold text-night-sky">{provisioned.box_id}</dd></div><div><dt className="text-xs font-semibold text-night-sky/45">Activation PIN</dt><dd className="mt-1 font-mono text-2xl font-bold tracking-[.18em] text-night-sky">{provisioned.activation_pin}</dd></div><div><dt className="text-xs font-semibold text-night-sky/45">Permanent NFC URL</dt><dd className="mt-1 break-all font-mono text-sm font-semibold text-night-sky">{fullNfcUrl}</dd></div></dl><div className="mt-4 rounded-xl bg-white p-3 text-xs leading-5 text-night-sky/55"><strong>Fulfillment check:</strong> put the Box ID on the durable box label; put the Box ID + activation PIN on the instruction-card label; program the NFC chip with the permanent URL above.</div></div>}
     </section>
     <section className="rounded-3xl border border-night-sky/10 bg-white p-5 shadow-sm lg:p-6"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-teal">Access</p><h2 className="mt-1 text-xl font-bold text-night-sky">Admin management</h2><p className="mt-2 text-sm leading-6 text-night-sky/60">Super Admins can grant dashboard access to existing LegacyLink accounts.</p></div>
       {isSuperAdmin&&<form onSubmit={addAdmin} className="mt-5 rounded-2xl bg-sand p-4"><label className="block text-xs font-bold uppercase tracking-[.12em] text-night-sky/55">LegacyLink account email<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.com" className="mt-2 w-full rounded-2xl border border-night-sky/15 bg-white px-4 py-3 text-sm outline-none focus:border-teal"/></label><div className="mt-3 grid grid-cols-[1fr_auto] gap-2"><select value={role} onChange={e=>setRole(e.target.value as "admin"|"fulfillment")} className="rounded-2xl border border-night-sky/15 bg-white px-4 py-3 text-sm"><option value="admin">Admin</option><option value="fulfillment">Fulfillment</option></select><button disabled={adminBusy} className="rounded-2xl bg-teal px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{adminBusy?"Adding…":"Add Admin"}</button></div>{adminError&&<p className="mt-3 text-sm font-semibold text-coral">{adminError}</p>}</form>}
       <div className="mt-5 divide-y divide-night-sky/10 rounded-2xl border border-night-sky/10">{admins.map(admin=><div key={admin.user_id} className="flex items-center justify-between gap-3 px-4 py-3"><div className="min-w-0"><p className="truncate text-sm font-bold text-night-sky">{admin.email||"LegacyLink user"}</p><p className="mt-0.5 text-xs font-semibold uppercase tracking-[.1em] text-night-sky/40">{admin.role.replace("_"," ")}</p></div>{isSuperAdmin&&admin.role!=="super_admin"&&<button onClick={()=>removeAdmin(admin.user_id)} className="text-xs font-bold text-coral">Remove</button>}</div>)}</div>
     </section>
   </div>
   <section className="mt-6 rounded-3xl border border-night-sky/10 bg-white p-5 shadow-sm lg:p-6"><p className="text-xs font-bold uppercase tracking-[.14em] text-teal">Orders</p><h2 className="mt-1 text-xl font-bold text-night-sky">Fulfillment orders</h2><div className="mt-4 rounded-2xl border border-dashed border-night-sky/15 bg-sand/60 p-5"><p className="text-sm font-bold text-night-sky">Commerce connection comes next.</p><p className="mt-2 max-w-3xl text-sm leading-6 text-night-sky/55">The database is already prepared to receive orders from Shopify or a future LegacyLink checkout. Once we choose the commerce source, customer orders will flow into this section for fulfillment rather than requiring duplicate manual entry.</p></div></section>
 </div>
}