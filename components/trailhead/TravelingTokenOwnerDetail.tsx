"use client";

import Link from "next/link";

export type TravelingTokenTreasureItem = {
  experience_id: string;
  title: string;
  description: string | null;
  status: string;
  nfc_public_token?: string | null;
  token_code?: string | null;
  mission?: string | null;
  from_box_code?: string | null;
  current_box_code?: string | null;
  total_miles?: number | null;
  stop_count?: number | null;
};

export default function TravelingTokenOwnerDetail({ item, onBack }: { item: TravelingTokenTreasureItem; onBack: () => void }) {
  const href = item.nfc_public_token ? `/t/${item.nfc_public_token}` : null;
  const inTransit = item.status === "in_transit";
  return <>
    <div className="flex items-center gap-3 border-b border-night-sky/10 px-5 py-4">
      <button onClick={onBack} className="h-9 w-9 rounded-full border border-night-sky/10">←</button>
      <div><p className="text-xs font-bold uppercase tracking-[.18em] text-teal">My Treasure</p><p className="text-sm font-semibold text-night-sky/60">Traveling Token</p></div>
    </div>
    <div className="flex-1 overflow-y-auto px-5 py-5">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal"><img src="/images/token-marker.svg" alt="" className="h-8 w-8" /></div>
      {item.token_code && <p className="mt-5 font-mono text-xs font-bold text-night-sky/40">{item.token_code}</p>}
      <h2 className="mt-1 text-2xl font-bold text-night-sky">{item.title}</h2>
      {item.mission && <p className="mt-3 rounded-2xl bg-sand p-4 text-sm leading-6 text-night-sky/70">“{item.mission}”</p>}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-night-sky/10 p-4"><p className="text-[10px] font-bold uppercase text-night-sky/40">Stops</p><p className="mt-1 text-xl font-bold text-night-sky">{item.stop_count ?? 0}</p></div>
        <div className="rounded-2xl border border-night-sky/10 p-4"><p className="text-[10px] font-bold uppercase text-night-sky/40">Distance</p><p className="mt-1 text-xl font-bold text-night-sky">{Number(item.total_miles ?? 0).toFixed(1)} mi</p></div>
      </div>
      <div className="mt-4 rounded-2xl bg-teal/10 p-4">
        <p className="text-xs font-bold uppercase tracking-[.12em] text-teal">{inTransit ? "In Transit" : item.status.replaceAll("_", " ")}</p>
        <p className="mt-2 text-sm leading-6 text-night-sky/70">{inTransit ? `You’re carrying this traveler${item.from_box_code ? ` from ${item.from_box_code}` : ""}. Plant it in another Treasure Box to keep its journey moving.` : item.current_box_code ? `This traveler is currently recorded at ${item.current_box_code}.` : "This traveler is out in the LegacyLink world."}</p>
      </div>
      {href && <Link href={href} className="mt-5 flex w-full justify-center rounded-2xl bg-night-sky px-5 py-4 text-sm font-bold text-white">{inTransit ? "Replant This Token" : "View Token Journey"}</Link>}
    </div>
  </>;
}
