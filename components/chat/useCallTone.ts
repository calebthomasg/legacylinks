import { useEffect } from "react";

const tones = {
  outgoing: "/family-chat/tones/calling_tone.mp3",
  incoming: "/family-chat/tones/receiving_tone.mp3",
};

let context: AudioContext | undefined;
const buffers = new Map<string, Promise<AudioBuffer>>();

function unlock() {
  try {
    context ??= new AudioContext();
    if (context.state !== "running") void context.resume().catch(() => undefined);
  } catch {
    // Ringing remains visible if playback is unavailable.
  }
}

export function useCallToneUnlock() {
  useEffect(() => {
    document.addEventListener("pointerdown", unlock);
    document.addEventListener("keydown", unlock);
    return () => {
      document.removeEventListener("pointerdown", unlock);
      document.removeEventListener("keydown", unlock);
    };
  }, []);
}

export function useCallTone(tone: keyof typeof tones | null) {
  useEffect(() => {
    if (!tone) return;
    unlock();
    const player = context;
    if (!player) return;
    let active = true;
    let source: AudioBufferSourceNode | undefined;
    let timer: number | undefined;
    const url = tones[tone];
    const buffer = buffers.get(url) ?? fetch(url).then((response) => {
      if (!response.ok) throw new Error("Call tone unavailable");
      return response.arrayBuffer();
    }).then((data) => player.decodeAudioData(data));
    buffers.set(url, buffer);

    function play(decoded: AudioBuffer) {
      if (!active || !player) return;
      if (player.state !== "running" || document.hidden) {
        timer = window.setTimeout(() => play(decoded), 500);
        return;
      }
      source = player.createBufferSource();
      source.buffer = decoded;
      source.loop = true;
      source.connect(player.destination);
      source.start();
    }

    void buffer.then(play).catch(() => buffers.delete(url));
    return () => {
      active = false;
      if (timer !== undefined) window.clearTimeout(timer);
      source?.stop();
      source?.disconnect();
    };
  }, [tone]);
}
