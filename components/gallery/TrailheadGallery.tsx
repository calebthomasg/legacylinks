"use client";

import { useState } from "react";

type TrailheadGalleryImage = {
  id: string;
  signedUrl: string | null;
  thumbnailUrl: string | null;
  fileName: string | null;
  dateAdded: string;
  treasureBoxId: string | null;
  treasureBoxTitle: string;
};

export default function TrailheadGallery({ images }: { images: TrailheadGalleryImage[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = images.find((image) => image.id === selectedId) ?? null;

  function formatDate(value: string) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Unknown date" : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  if (!images.length) return null;

  return <section className="mb-10">
    <div className="mb-4">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal">Trailhead finds</p>
      <h2 className="mt-1 text-2xl font-semibold text-night-sky">Photos from your adventures</h2>
      <p className="mt-1 text-sm leading-6 text-night-sky/65">Pictures you add to a Trail Log are saved here too, along with the treasure box where you found them.</p>
    </div>
    <div className="grid grid-cols-2 gap-3 min-[575px]:gap-4 min-[745px]:grid-cols-3 min-[910px]:grid-cols-5 min-[1075px]:grid-cols-6">
      {images.map((image) => <button key={image.id} type="button" onClick={() => setSelectedId(image.id)} className="overflow-hidden rounded-xl border border-night-sky/10 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
        <div className="aspect-square bg-sand">{image.thumbnailUrl ? <img src={image.thumbnailUrl} alt={image.fileName ?? `Photo from ${image.treasureBoxTitle}`} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xs text-night-sky/50">Image unavailable</div>}</div>
        <div className="p-3"><p className="line-clamp-2 text-xs font-semibold text-night-sky">Found at {image.treasureBoxTitle}</p><p className="mt-1 text-[0.7rem] text-night-sky/55">Trailhead · {formatDate(image.dateAdded)}</p></div>
      </button>)}
    </div>

    {selected && <div className="fixed inset-0 z-50 overflow-y-auto bg-night-sky/80 px-4 py-8" onClick={() => setSelectedId(null)}>
      <div className="relative mx-auto w-full max-w-5xl rounded-2xl bg-white p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <button type="button" onClick={() => setSelectedId(null)} className="button-secondary mb-3">Close</button>
        <div className="overflow-hidden rounded-xl bg-sand">{selected.signedUrl ? <img src={selected.signedUrl} alt={selected.fileName ?? `Photo from ${selected.treasureBoxTitle}`} className="max-h-[75vh] w-full object-contain" /> : <div className="flex h-96 items-center justify-center text-sm text-night-sky/60">Image unavailable</div>}</div>
        <div className="mt-4"><p className="text-xs font-bold uppercase tracking-[0.16em] text-teal">Trailhead find</p><h2 className="mt-1 text-xl font-semibold text-night-sky">Found at {selected.treasureBoxTitle}</h2><p className="mt-1 text-sm text-night-sky/65">Added {formatDate(selected.dateAdded)}</p></div>
      </div>
    </div>}
  </section>;
}
