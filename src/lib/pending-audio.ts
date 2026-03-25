// Global state for passing audio files from inbox to Spotify+Suno tab

type PendingAudio = {
  name: string;
  path: string;
} | null;

let pending: PendingAudio = null;
const listeners = new Set<() => void>();

export function setPendingAudio(audio: PendingAudio) {
  pending = audio;
  listeners.forEach((fn) => fn());
}

export function getPendingAudio(): PendingAudio {
  return pending;
}

export function clearPendingAudio() {
  pending = null;
}

export function subscribePendingAudio(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
