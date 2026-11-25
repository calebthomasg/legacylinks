"use client";

import { useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";

type Position = { x: number; y: number };
const center = { x: 50, y: 50 };
const clamp = (value: number) => Math.max(0, Math.min(100, value));

export default function GroupPhotoCrop({ photo, busy, onSave, onCancel }: {
  photo: File;
  busy: boolean;
  onSave: (photo: File) => void;
  onCancel: () => void;
}) {
  const [url, setUrl] = useState("");
  const [position, setPosition] = useState(center);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [error, setError] = useState("");
  const image = useRef<HTMLImageElement>(null);
  const drag = useRef<{ x: number; y: number; position: Position } | null>(null);
  const saving = useRef(false);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(photo);
    // Keep the source alive until this editor closes.
    const timer = window.setTimeout(() => setUrl(objectUrl), 0);
    return () => {
      window.clearTimeout(timer);
      URL.revokeObjectURL(objectUrl);
    };
  }, [photo]);

  function moveCrop(event: PointerEvent<HTMLDivElement>) {
    const origin = drag.current;
    if (!origin || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const overflow = event.currentTarget.clientWidth * (Math.max(size.width, size.height) / Math.min(size.width, size.height) - 1);
    if (!overflow) return;
    setPosition({
      x: size.width > size.height ? clamp(origin.position.x - 100 * (event.clientX - origin.x) / overflow) : 50,
      y: size.height > size.width ? clamp(origin.position.y - 100 * (event.clientY - origin.y) / overflow) : 50,
    });
  }

  function save() {
    const source = image.current;
    if (!source || !size.width || saving.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 640;
    const context = canvas.getContext("2d");
    if (!context) return setError("This browser couldn’t crop the photo.");
    const edge = Math.min(size.width, size.height);
    const x = (size.width - edge) * position.x / 100;
    const y = (size.height - edge) * position.y / 100;
    context.fillStyle = "#fff";
    context.fillRect(0, 0, 640, 640);
    context.drawImage(source, x, y, edge, edge, 0, 0, 640, 640);
    saving.current = true;
    canvas.toBlob((blob) => {
      saving.current = false;
      if (blob) onSave(new File([blob], "group-photo.jpg", { type: "image/jpeg" }));
      else setError("We couldn’t crop that photo. Try a different image.");
    }, "image/jpeg", 0.9);
  }

  return <section className="space-y-5">
    <p className="text-sm text-night-sky/75">Drag the photo to position it inside the circle.</p>
    <div className="mx-auto aspect-square w-full max-w-72 touch-none overflow-hidden rounded-full bg-white shadow-sm ring-2 ring-sky-depth/45"
      onPointerDown={(event) => {
        if (!size.width || busy) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { x: event.clientX, y: event.clientY, position };
      }}
      onPointerMove={moveCrop}
      onLostPointerCapture={() => { drag.current = null; }}>
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img ref={image} src={url} alt="Group photo crop preview" draggable={false}
          className="size-full select-none object-cover" style={{ objectPosition: `${position.x}% ${position.y}%` }}
          onLoad={(event) => setSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
          onError={() => setError("This browser couldn’t open that photo. Choose a JPEG, PNG, or WebP image.")} />
      )}
    </div>
    {size.width !== size.height && <label className="mx-auto block max-w-72 text-sm font-semibold">
      {size.width > size.height ? "Horizontal position" : "Vertical position"}
      <input type="range" min="0" max="100" disabled={busy} value={size.width > size.height ? position.x : position.y}
        onChange={(event) => {
          const value = Number(event.target.value);
          setPosition(size.width > size.height ? { x: value, y: 50 } : { x: 50, y: value });
        }} className="mt-2 w-full accent-sky-depth" />
    </label>}
    {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
    <div className="flex gap-3">
      <button type="button" disabled={busy} onClick={onCancel} className="min-h-12 flex-1 rounded-xl border border-night-sky/15 bg-white px-3 text-sm font-bold">Cancel</button>
      <button type="button" disabled={busy || !size.width} onClick={save} className="min-h-12 flex-1 rounded-xl bg-night-sky px-3 text-sm font-bold text-white disabled:opacity-50">Save photo</button>
    </div>
  </section>;
}
