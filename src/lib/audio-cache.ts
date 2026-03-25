/**
 * Global client-side cache for decoded audio data.
 * Survives component unmounts / re-mounts.
 */

type CachedAudio = {
  waveform: number[];
  duration: number;
  bpm: number | null;
  musicalKey: string | null;
};

const cache = new Map<string, CachedAudio>();

export function getCachedAudio(src: string): CachedAudio | undefined {
  return cache.get(src);
}

export function setCachedAudio(src: string, data: CachedAudio) {
  cache.set(src, data);
}
