"use client";

import {useRouter} from "next/navigation";
import MemorialCreateForm from "@/components/trailhead/MemorialCreateForm";

export default function NewMemorialPage(){
 const router=useRouter();
 return <main className="min-h-dvh bg-sand px-4 py-8 sm:px-6"><div className="mx-auto h-[calc(100dvh-4rem)] max-w-xl overflow-hidden rounded-[2rem] border border-night-sky/10 bg-white shadow-xl"><MemorialCreateForm onCancel={()=>router.push('/trailhead')} onCreated={()=>{router.push('/trailhead');router.refresh()}}/></div></main>
}