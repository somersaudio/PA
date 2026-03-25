// Global audio player that persists across page navigation

type PlayerState = {
  src: string;
  filename: string;
  title: string;
  playing: boolean;
  currentTime: number;
  duration: number;
  semitones: number;
};

let audio: HTMLAudioElement | null = null;
let state: PlayerState | null = null;
const listeners = new Set<() => void>();

export function getPlayerState(): PlayerState | null {
  if (!state) return null;
  if (audio) {
    state.currentTime = audio.currentTime;
    state.duration = audio.duration || state.duration;
    state.playing = !audio.paused;
  }
  return state;
}

export function subscribePlayer(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

function notify() {
  listeners.forEach((fn) => fn());
}

export function globalPlay(src: string, filename: string, title: string, offset?: number) {
  // If same source, just resume
  if (audio && state?.src === src) {
    if (offset !== undefined) audio.currentTime = offset;
    audio.play().catch(() => {});
    state.playing = true;
    notify();
    return;
  }

  // New source — create fresh audio
  if (audio) {
    audio.pause();
    audio.removeAttribute("src");
  }

  audio = new Audio();
  audio.preload = "auto";
  audio.src = src;
  if (offset !== undefined) audio.currentTime = offset;

  state = { src, filename, title, playing: true, currentTime: offset || 0, duration: 0, semitones: 0 };

  audio.addEventListener("loadedmetadata", () => {
    if (state) state.duration = audio!.duration;
    notify();
  });

  audio.addEventListener("ended", () => {
    if (state) state.playing = false;
    notify();
  });

  audio.play().catch(() => {});
  notify();
}

export function globalPause() {
  if (audio) audio.pause();
  if (state) state.playing = false;
  notify();
}

export function globalToggle() {
  if (!audio || !state) return;
  if (audio.paused) {
    audio.play();
    state.playing = true;
  } else {
    audio.pause();
    state.playing = false;
  }
  notify();
}

export function globalSeek(time: number) {
  if (!audio) return;
  audio.currentTime = time;
  if (state) state.currentTime = time;
  notify();
}

export function globalSetPitch(semitones: number) {
  if (state) state.semitones = semitones;
  if (!audio) return;
  audio.preservesPitch = false;
  audio.playbackRate = Math.pow(2, semitones / 12);
  notify();
}

export function getGlobalSemitones(): number {
  return state?.semitones || 0;
}

export function getAudioElement(): HTMLAudioElement | null {
  return audio;
}

export function isGlobalPlaying(src: string): boolean {
  return state?.src === src && state?.playing === true;
}

export function getGlobalSrc(): string | null {
  return state?.src || null;
}
