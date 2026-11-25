"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { hasVideo, ParticipantView, StreamTheme, useCallStateHooks } from "@stream-io/video-react-sdk";

type Position = { x: number; y: number };

function clamp(value: number) {
  return Math.min(1, Math.max(0, value));
}

export default function FamilyChatVideoStage({ name, mirrorSelf }: { name: string; mirrorSelf: boolean }) {
  const { useLocalParticipant, useRemoteParticipants } = useCallStateHooks();
  const local = useLocalParticipant();
  const remote = useRemoteParticipants()[0];
  const area = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointer: number; x: number; y: number } | null>(null);
  const [position, setPosition] = useState<Position>({ x: 1, y: 0 });
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

  function beginDrag(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || !event.isPrimary) return;
    const frame = event.currentTarget.getBoundingClientRect();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointer: event.pointerId, x: event.clientX - frame.left, y: event.clientY - frame.top };
  }

  function movePreview(event: PointerEvent<HTMLDivElement>) {
    const start = drag.current;
    if (start?.pointer !== event.pointerId || !area.current) return;
    const bounds = area.current.getBoundingClientRect();
    const tile = event.currentTarget.getBoundingClientRect();
    setPosition({
      x: clamp((event.clientX - start.x - bounds.left) / Math.max(1, bounds.width - tile.width)),
      y: clamp((event.clientY - start.y - bounds.top) / Math.max(1, bounds.height - tile.height)),
    });
  }

  function moveWithKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    const step = 0.1;
    const offset = {
      ArrowLeft: [-step, 0], ArrowRight: [step, 0],
      ArrowUp: [0, -step], ArrowDown: [0, step],
    }[event.key];
    if (!offset) return;
    event.preventDefault();
    setPosition(({ x, y }) => ({ x: clamp(x + offset[0]), y: clamp(y + offset[1]) }));
  }

  return (
    <StreamTheme className="absolute inset-0">
      <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(ellipse_at_35%_25%,#243b60,var(--brand-night-sky)_68%)]">
        {remote && hasVideo(remote) ? (
          <ParticipantView participant={remote} muteAudio ParticipantViewUI={null}
            className="size-full border-0! rounded-none! [&_video]:object-cover!" />
        ) : (
          <div className="flex flex-col items-center gap-3 text-sky">
            <div className="grid size-20 place-items-center rounded-3xl border border-sky/35 bg-white/10 text-2xl font-black">
              {initials}
            </div>
            <span className="text-sm text-white/75">{remote ? "Camera off" : "Waiting for video…"}</span>
          </div>
        )}
      </div>
      <div ref={area}
        className="pointer-events-none absolute inset-x-3 bottom-[calc(6.75rem+env(safe-area-inset-bottom))] top-[calc(5.25rem+env(safe-area-inset-top))] sm:inset-x-5">
        <div role="group" aria-label="Your camera preview. Drag or use the arrow keys to move it." tabIndex={0}
          onPointerDown={beginDrag} onPointerMove={movePreview}
          onLostPointerCapture={() => { drag.current = null; }} onKeyDown={moveWithKeyboard}
          className="pointer-events-auto absolute grid h-[clamp(3.5rem,23dvh,12rem)] max-h-full aspect-[3/4] touch-none cursor-grab select-none place-items-center overflow-hidden rounded-2xl border border-sky/50 bg-night-sky shadow-xl outline-offset-4 focus-visible:outline-2 focus-visible:outline-sky active:cursor-grabbing"
          style={{
            left: `${position.x * 100}%`, top: `${position.y * 100}%`,
            transform: `translate(${-position.x * 100}%, ${-position.y * 100}%)`,
          }}>
          {local && hasVideo(local) ? (
            <ParticipantView participant={local} muteAudio mirror={mirrorSelf} ParticipantViewUI={null}
              className="pointer-events-none size-full border-0! rounded-none! [&_video]:object-cover!" />
          ) : <span className="px-1 text-center text-xs font-bold text-white/75">Camera off</span>}
          <span aria-hidden="true" className="absolute bottom-1.5 left-1/2 h-1 w-5 -translate-x-1/2 rounded-full bg-white/70" />
        </div>
      </div>
    </StreamTheme>
  );
}
