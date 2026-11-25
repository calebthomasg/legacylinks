"use client";

import { hasAudio, hasVideo, ParticipantView, StreamTheme, useCallStateHooks, type StreamVideoParticipant } from "@stream-io/video-react-sdk";
import FamilyChatVideoStage from "./FamilyChatVideoStage";

function ParticipantTile({ participant, spotlight = false, mirrorSelf }: {
  participant: StreamVideoParticipant;
  spotlight?: boolean;
  mirrorSelf: boolean;
}) {
  const name = participant.name || "Family member";
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
  return (
    <figure aria-label={spotlight ? `Active speaker: ${name}` : name}
      className={`relative isolate grid min-h-0 min-w-0 place-items-center overflow-hidden rounded-xl bg-night-sky ${participant.isSpeaking ? "ring-2 ring-inset ring-teal" : "border border-white/10"}`}>
      {hasVideo(participant) ? (
        <ParticipantView participant={participant} muteAudio ParticipantViewUI={null}
          mirror={participant.isLocalParticipant ? mirrorSelf : false}
          className="absolute! inset-0 size-full border-0! rounded-none! [&_video]:size-full! [&_video]:object-contain! [&_video]:object-center!" />
      ) : (
        <span aria-hidden="true" className="grid size-8 max-h-full place-items-center rounded-full bg-sky/20 text-xs font-black text-sky sm:size-11 sm:text-base">{initials}</span>
      )}
      <figcaption className="absolute inset-x-0 bottom-0 flex min-w-0 items-center gap-1 bg-linear-to-t from-night-sky/95 to-transparent px-2 pb-1 pt-2 text-xs font-bold text-white">
        <span className="min-w-0 truncate">{participant.isLocalParticipant ? "You" : name}</span>
        {!hasAudio(participant) && <span className="shrink-0 text-[10px] text-white/80">Muted</span>}
      </figcaption>
    </figure>
  );
}

export default function FamilyChatGroupVideoStage({ name, mirrorSelf }: { name: string; mirrorSelf: boolean }) {
  const { useRawParticipants } = useCallStateHooks();
  // The raw list keeps tiles from shifting whenever someone starts talking.
  const participants = useRawParticipants();
  if (participants.length <= 2) return <FamilyChatVideoStage name={name} mirrorSelf={mirrorSelf} />;

  const spotlight = participants.length > 8
    ? participants.find((participant) => participant.isDominantSpeaker)
      ?? participants.find((participant) => participant.isSpeaking)
      ?? participants[0]
    : null;
  return (
    <StreamTheme className="absolute inset-x-2 bottom-[calc(6.5rem+env(safe-area-inset-bottom))] top-[calc(4.5rem+env(safe-area-inset-top))] sm:inset-x-4">
      {spotlight ? (
        <div className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto] gap-2">
          <ParticipantTile participant={spotlight} mirrorSelf={mirrorSelf} spotlight />
          <div aria-label="All call participants" tabIndex={0}
            className="flex h-[clamp(3.5rem,14dvh,7.5rem)] snap-x gap-2 overflow-x-auto overscroll-x-contain pb-1">
            {participants.map((participant) => (
              <div key={participant.sessionId} className="grid aspect-[4/3] min-h-0 shrink-0 snap-start">
                <ParticipantTile participant={participant} mirrorSelf={mirrorSelf} />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div aria-label="Call participants"
          className={`grid h-full auto-rows-fr grid-cols-2 gap-1.5 sm:gap-2 ${participants.length > 4 ? "lg:grid-cols-4" : ""}`}>
          {participants.map((participant) => (
            <ParticipantTile key={participant.sessionId} participant={participant} mirrorSelf={mirrorSelf} />
          ))}
        </div>
      )}
    </StreamTheme>
  );
}
