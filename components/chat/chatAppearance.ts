import { chatTones, chatWallpapers } from "./chatAppearanceCatalog";

export const muteOptions = [
  { minutes: 15, label: "For 15 minutes" },
  { minutes: 60, label: "For 1 hour" },
  { minutes: 480, label: "For 8 hours" },
  { minutes: 1440, label: "For 24 hours" },
  { minutes: -1, label: "Until I change it" },
];

export function isChatMuted(mutedAt: string | null, mutedUntil: string | null, now = Date.now()) {
  return Boolean(mutedAt && (!mutedUntil || Date.parse(mutedUntil) > now));
}

export const themes = [{ id: "default", name: "LegacyLink", outgoing: "", incoming: "" }, ...chatWallpapers];
export type ChatTheme = (typeof themes)[number];

export function getChatTheme(id: string | null) {
  return themes.find((theme) => theme.id === id) ?? themes[0];
}

export function wallpaperUrl(theme: ChatTheme, thumbnail = false) {
  return theme.id === "default" ? undefined : `/family-chat/themes/${theme.id}${thumbnail ? "-thumb" : ""}.webp`;
}

export function wallpaperStyle(theme: ChatTheme) {
  const url = wallpaperUrl(theme);
  return url ? { backgroundImage: `url("${url}")` } : undefined;
}

export function bubbleStyle(theme: ChatTheme, outgoing: boolean) {
  return theme.id === "default" ? undefined : { backgroundColor: outgoing ? theme.outgoing : theme.incoming, color: outgoing ? "#fff" : "#14233c" };
}

export const tones = [{ id: "silent", name: "Silent" }, { id: "default", name: "LegacyLink ping" }, ...chatTones];

export function toneUrl(id: string) {
  return chatTones.some((tone) => tone.id === id) ? `/family-chat/tones/${id}.mp3` : null;
}

export function playDefaultChatTone(context: AudioContext) {
  const oscillator = context.createOscillator();
  const volume = context.createGain();
  oscillator.frequency.value = 660;
  volume.gain.setValueAtTime(0.08, context.currentTime);
  volume.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.15);
  oscillator.connect(volume).connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.16);
}
