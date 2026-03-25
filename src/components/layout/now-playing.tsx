"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getPlayerState, subscribePlayer, globalToggle, globalSeek } from "@/lib/global-player";
import { getCachedAudio } from "@/lib/audio-cache";

const timeListeners = new Set<(time: number) => void>();
export function broadcastPlaybackTime(time: number) {
  timeListeners.forEach((fn) => fn(time));
}

export function NowPlaying() {
  const [currentTime, setCurrentTime] = useState(0);
  const [trackFilename, setTrackFilename] = useState<string | null>(null);
  const [trackTitle, setTrackTitle] = useState("");
  const [trackPlaying, setTrackPlaying] = useState(false);
  const [trackDuration, setTrackDuration] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const waveformData = useRef<number[]>([]);
  const durationRef = useRef(0);

  // Subscribe to global player changes
  useEffect(() => {
    function sync() {
      const s = getPlayerState();
      if (s) {
        setTrackFilename(s.filename || null);
        setTrackTitle(s.title);
        setTrackPlaying(s.playing);
        setTrackDuration(s.duration);
        setCurrentTime(s.currentTime);
      } else {
        setTrackPlaying(false);
        setTrackFilename(null);
      }
    }
    sync();
    return subscribePlayer(sync);
  }, []);

  // Listen for playback time broadcasts from waveform player
  useEffect(() => {
    const listener = (time: number) => setCurrentTime(time);
    timeListeners.add(listener);
    return () => { timeListeners.delete(listener); };
  }, []);

  // Poll time when on another page
  useEffect(() => {
    const interval = setInterval(() => {
      const s = getPlayerState();
      if (s?.playing) setCurrentTime(s.currentTime);
    }, 200);
    return () => clearInterval(interval);
  }, []);

  // Load waveform when track changes
  useEffect(() => {
    if (!trackFilename) {
      waveformData.current = [];
      return;
    }
    const src = `/api/suno/audio?file=${encodeURIComponent(trackFilename)}`;
    const cached = getCachedAudio(src);
    if (cached) {
      waveformData.current = cached.waveform;
      durationRef.current = cached.duration;
    } else {
      waveformData.current = [];
      durationRef.current = trackDuration;
    }
  }, [trackFilename, trackDuration]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const dur = durationRef.current || trackDuration || 1;
    const progress = currentTime / dur;
    const progressX = progress * width;

    ctx.clearRect(0, 0, width, height);

    const bars = waveformData.current;
    if (bars.length > 0) {
      const barWidth = width / bars.length;
      const gap = 1;
      for (let i = 0; i < bars.length; i++) {
        const x = i * barWidth;
        const barH = Math.max(1, bars[i] * (height * 0.85));
        const y = (height - barH) / 2;
        ctx.fillStyle = x < progressX ? "hsl(0, 0%, 90%)" : "hsl(0, 0%, 40%)";
        ctx.fillRect(x + gap / 2, y, Math.max(1, barWidth - gap), barH);
      }
    } else {
      // Simple progress bar fallback
      ctx.fillStyle = "hsl(0, 0%, 25%)";
      ctx.fillRect(0, height / 2 - 1, width, 2);
      ctx.fillStyle = "hsl(0, 0%, 90%)";
      ctx.fillRect(0, height / 2 - 1, progressX, 2);
    }
  }, [currentTime, trackDuration]);

  useEffect(() => { draw(); }, [draw]);

  if (!trackFilename && !trackPlaying) return null;

  const dur = durationRef.current || trackDuration || 1;
  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas || !dur) return;
    const rect = canvas.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    globalSeek(pct * dur);
  }

  return (
    <div className="px-2 py-2 space-y-1">
      <div className="flex items-center gap-1.5">
        <button onClick={globalToggle} className="shrink-0 w-5 h-5 flex items-center justify-center text-foreground">
          {trackPlaying ? (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
        <span className="text-[10px] font-medium text-foreground truncate flex-1">
          {trackTitle}
        </span>
      </div>
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        className="w-full h-4 cursor-pointer rounded"
      />
      <div className="flex justify-end">
        <span className="text-[9px] text-muted-foreground font-mono">
          {fmt(currentTime)} / {fmt(dur)}
        </span>
      </div>
    </div>
  );
}
