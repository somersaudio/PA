"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getCachedAudio, setCachedAudio } from "@/lib/audio-cache";
import { queueDecode } from "@/lib/decode-queue";
import { setActiveTrack, registerCallbacks, clearCallbacks } from "@/lib/active-track";
import { broadcastPlaybackTime } from "@/components/layout/now-playing";
import { globalPlay, globalPause, globalSeek, globalToggle, globalSetPitch, getAudioElement, isGlobalPlaying, getGlobalSrc, getGlobalSemitones } from "@/lib/global-player";
import { PitchShifter } from "soundtouchjs";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function shiftKey(key: string, semitoneShift: number): string {
  const match = key.match(/^([A-G]#?)\s*(Major|Minor)$/i);
  if (!match) return key;
  const noteIdx = NOTE_NAMES.indexOf(match[1]);
  if (noteIdx === -1) return key;
  const newIdx = ((noteIdx + semitoneShift) % 12 + 12) % 12;
  return `${NOTE_NAMES[newIdx]} ${match[2]}`;
}

// Global: when any player starts, it fires this event so others stop
const stopAllEvent = new EventTarget();
function notifyPlayStart(id: string) {
  stopAllEvent.dispatchEvent(new CustomEvent("play", { detail: id }));
}

type Marker = {
  id: string;
  time: number;
  comments: string[];
};

export function WaveformPlayer({
  src,
  title,
  weirdness,
  filename,
  played: initialPlayed,
  extraInfo,
}: {
  src: string;
  title: string;
  weirdness?: number | null;
  filename?: string;
  played?: boolean;
  extraInfo?: React.ReactNode;
}) {
  const instanceId = useRef(`player-${Math.random().toString(36).slice(2)}`);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const waveformData = useRef<number[]>([]);
  const durationRef = useRef(0);
  const playingRef = useRef(false);
  const semitonesRef = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [displayTime, setDisplayTime] = useState(0);
  const [duration, setDurationState] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [focused, setFocused] = useState(false);
  const [bpm, setBpm] = useState<number | null>(null);
  const [musicalKey, setMusicalKey] = useState<string | null>(null);
  const [semitones, setSemitones] = useState(0);
  const [hasBeenPlayed, setHasBeenPlayed] = useState(initialPlayed ?? false);

  // Markers
  // Stop this player when another player starts
  useEffect(() => {
    function onOtherPlay(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (detail !== instanceId.current && playingRef.current) {
        playingRef.current = false;
        setPlaying(false);
      }
    }
    stopAllEvent.addEventListener("play", onOtherPlay);
    return () => stopAllEvent.removeEventListener("play", onOtherPlay);
  }, []);

  // Sync with global player on mount — check if this track is already playing
  useEffect(() => {
    if (isGlobalPlaying(src)) {
      playingRef.current = true;
      setPlaying(true);
      const globalSemitones = getGlobalSemitones();
      if (globalSemitones !== 0) {
        setSemitones(globalSemitones);
        semitonesRef.current = globalSemitones;
      }
    }
  }, [src]);

  const [markers, setMarkersState] = useState<Marker[]>([]);
  const [activeMarkerId, setActiveMarkerId] = useState<string | null>(null);
  const [newComment, setNewComment] = useState("");
  const markersRef = useRef<Marker[]>([]);
  markersRef.current = markers;
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Persist markers with debounce
  function setMarkers(updater: Marker[] | ((prev: Marker[]) => Marker[])) {
    setMarkersState((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      // Debounced save to API
      if (filename) {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
          fetch("/api/suno/markers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filename, markers: next }),
          }).catch(() => {});
        }, 500);
      }
      return next;
    });
  }

  // Load markers on mount
  useEffect(() => {
    if (!filename) return;
    fetch(`/api/suno/markers?file=${encodeURIComponent(filename)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.markers?.length > 0) setMarkersState(d.markers);
      })
      .catch(() => {});
  }, [filename]);

  const activeMarker = markers.find((m) => m.id === activeMarkerId) || null;
  const [commentVisible, setCommentVisible] = useState(false);
  const [commentFading, setCommentFading] = useState(false);
  const [commentAdding, setCommentAdding] = useState(false);
  const commentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggeredMarkersRef = useRef<Set<string>>(new Set());

  function showCommentBriefly() {
    if (commentTimerRef.current) clearTimeout(commentTimerRef.current);
    setCommentVisible(true);
    setCommentFading(false);
    // Start fading at 5.5s, fully gone at 7s
    commentTimerRef.current = setTimeout(() => {
      setCommentFading(true);
      commentTimerRef.current = setTimeout(() => {
        setCommentVisible(false);
        setCommentFading(false);
      }, 1500);
    }, 5500);
  }

  // Broadcast state to the comment panel
  useEffect(() => {
    if (playing) {
      setActiveTrack({
        filename: filename || src,
        title,
        markers,
        activeMarkerId,
        playing: true,
      });
      registerCallbacks({
        addComment: (markerId, comment) => {
          setMarkers((prev) =>
            prev.map((m) =>
              m.id === markerId ? { ...m, comments: [...m.comments, comment] } : m
            )
          );
        },
        deleteComment: (markerId, idx) => {
          setMarkers((prev) =>
            prev.map((m) =>
              m.id === markerId
                ? { ...m, comments: m.comments.filter((_, i) => i !== idx) }
                : m
            )
          );
        },
        deleteMarker: (id) => {
          setMarkers((prev) => prev.filter((m) => m.id !== id));
          if (activeMarkerId === id) setActiveMarkerId(null);
        },
        setActiveMarker: (id) => setActiveMarkerId(id),
        seekAndPlay: (time) => {
          notifyPlayStart(instanceId.current);
          seekTo(time);
          if (!playingRef.current) {
            startPlayback(time);
            playingRef.current = true;
            setPlaying(true);
          }
        },
      });
    }
    // Don't clear active track when playing becomes false —
    // the global player may still be playing after unmount
  }, [playing, markers, activeMarkerId, title, filename]);

  // Single load: fetch once, decode for playback, analyze in worker
  useEffect(() => {
    let cancelled = false;

    // Check cache first
    const cached = getCachedAudio(src);
    if (cached) {
      waveformData.current = cached.waveform;
      durationRef.current = cached.duration;
      setDurationState(cached.duration);
      setBpm(cached.bpm);
      setMusicalKey(cached.musicalKey);
      setLoaded(true);
    }

    // If cached, we're done
    if (cached) return;

    // Decode via sequential queue (one at a time, won't freeze UI)
    queueDecode(src).then((decoded) => {
      if (cancelled) return;

      durationRef.current = decoded.duration;
      setDurationState(decoded.duration);

      // Compute waveform (fast — just averaging)
      const bars = 200;
      const blockSize = Math.floor(decoded.channelData.length / bars);
      const peaks: number[] = [];
      for (let i = 0; i < bars; i++) {
        let sum = 0;
        const start = i * blockSize;
        for (let j = 0; j < blockSize; j++) {
          sum += Math.abs(decoded.channelData[start + j] || 0);
        }
        peaks.push(sum / blockSize);
      }
      const maxPeak = Math.max(...peaks, 0.01);
      const waveform = peaks.map((p) => p / maxPeak);

      if (cancelled) return;
      waveformData.current = waveform;
      setLoaded(true);

      // BPM + key in worker (non-blocking)
      const rawData = new Float32Array(decoded.channelData);
      const worker = new Worker("/audio-worker.js");
      worker.onmessage = (e) => {
        if (cancelled) { worker.terminate(); return; }
        setBpm(e.data.bpm);
        setMusicalKey(e.data.musicalKey);
        setCachedAudio(src, { waveform, duration: decoded.duration, bpm: e.data.bpm, musicalKey: e.data.musicalKey });
        worker.terminate();
      };
      worker.onerror = () => worker.terminate();
      worker.postMessage(
        { channelData: rawData, sampleRate: decoded.sampleRate, duration: decoded.duration, id: src },
        [rawData.buffer]
      );
    }).catch(() => {
      if (!cancelled) {
        waveformData.current = Array(200).fill(0.3);
        setLoaded(true);
      }
    });

    return () => {
      cancelled = true;
      // Don't pause global player on unmount — let it keep playing
    };
  }, [src]);

  // Apply semitone pitch shift
  useEffect(() => {
    semitonesRef.current = semitones;
    if (isGlobalPlaying(src)) {
      globalSetPitch(semitones);
    }
  }, [semitones, src]);

  // Draw waveform with markers
  const draw = useCallback((prog: number, currentMarkers?: Marker[], currentActiveId?: string | null) => {
    const canvas = canvasRef.current;
    if (!canvas || waveformData.current.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const bars = waveformData.current;
    const barWidth = width / bars.length;
    const gap = 1;
    const progressX = prog * width;
    const dur = durationRef.current || 1;
    const mks = currentMarkers ?? markersRef.current;
    const activeId = currentActiveId !== undefined ? currentActiveId : activeMarkerId;

    ctx.clearRect(0, 0, width, height);

    // Draw bars
    for (let i = 0; i < bars.length; i++) {
      const x = i * barWidth;
      const barH = Math.max(2, bars[i] * (height * 0.85));
      const y = (height - barH) / 2;
      ctx.fillStyle = x < progressX ? "hsl(0, 0%, 90%)" : "hsl(0, 0%, 40%)";
      ctx.fillRect(x + gap / 2, y, Math.max(1, barWidth - gap), barH);
    }

    // Draw markers
    for (const marker of mks) {
      const mx = (marker.time / dur) * width;
      const isActive = marker.id === activeId;

      // Vertical line
      ctx.fillStyle = isActive ? "hsl(210, 100%, 60%)" : "hsl(210, 80%, 50%)";
      ctx.fillRect(mx - 1, 0, 2, height);

      // Triangle at top
      ctx.beginPath();
      ctx.moveTo(mx - 5, 0);
      ctx.lineTo(mx + 5, 0);
      ctx.lineTo(mx, 8);
      ctx.closePath();
      ctx.fill();

      // Comment count
      if (marker.comments.length > 0) {
        ctx.font = "bold 9px sans-serif";
        ctx.fillText(String(marker.comments.length), mx + 7, 9);
      }
    }
  }, [activeMarkerId]);

  // Redraw when paused
  useEffect(() => {
    if (loaded && !playing) draw(progress, markers, activeMarkerId);
  }, [loaded, progress, playing, draw, markers, activeMarkerId]);

  // Animation loop
  useEffect(() => {
    if (!playing) return;

    function tick() {
      if (!playingRef.current) return;
      const dur = durationRef.current;
      if (dur > 0) {
        const t = getCurrentTime();
        const p = Math.min(t / dur, 1);
        setProgress(p);
        setDisplayTime(t);
        broadcastPlaybackTime(t);
        draw(p);

        // Check if playback just crossed a marker
        for (const marker of markersRef.current) {
          if (
            !triggeredMarkersRef.current.has(marker.id) &&
            t >= marker.time &&
            t < marker.time + 1.5
          ) {
            triggeredMarkersRef.current.add(marker.id);
            setActiveMarkerId(marker.id);
            showCommentBriefly();
          }
        }
      }
      animRef.current = requestAnimationFrame(tick);
    }

    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [playing, draw]);

  // Listen for keyboard shortcuts when focused
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!focused) return;
      const tag = (e.target as HTMLElement)?.tagName;

      // Spacebar: toggle play/pause
      if (e.key === " " && tag !== "TEXTAREA" && tag !== "INPUT") {
        e.preventDefault();
        togglePlayRef.current();
        return;
      }

      // Enter: drop marker (only on first press, not repeat)
      if (e.key === "Enter" && tag !== "TEXTAREA" && !e.repeat) {
        e.preventDefault();

        const newMarker: Marker = {
          id: `m-${Date.now()}`,
          time: Math.round(getCurrentTime() * 10) / 10,
          comments: [],
        };

        setMarkers((prev) => [...prev, newMarker].sort((a, b) => a.time - b.time));
        setActiveMarkerId(newMarker.id);
        showCommentBriefly();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [focused]);

  function getCurrentTime(): number {
    return getAudioElement()?.currentTime || 0;
  }

  function startPlayback(offset: number) {
    triggeredMarkersRef.current = new Set(
      markersRef.current.filter((m) => m.time < offset).map((m) => m.id)
    );
    globalPlay(src, filename || "", title, offset);
  }

  function stopPlayback() {
    globalPause();
  }

  const playedMarkedRef = useRef(false);

  const togglePlayRef = useRef(() => {});
  togglePlayRef.current = () => {
    if (playingRef.current && isGlobalPlaying(src)) {
      globalPause();
      playingRef.current = false;
      setPlaying(false);
    } else {
      notifyPlayStart(instanceId.current);
      if (!playedMarkedRef.current && filename) {
        playedMarkedRef.current = true;
        setHasBeenPlayed(true);
        fetch("/api/suno/library/played", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename }),
        }).catch(() => {});
      }
      globalPlay(src, filename || "", title);
      playingRef.current = true;
      setPlaying(true);
    }
  };

  function togglePlay() {
    togglePlayRef.current();
  }

  function seekTo(time: number) {
    const dur = durationRef.current;
    if (!dur) return;

    setProgress(time / dur);
    setDisplayTime(time);
    draw(time / dur);

    // Always play from this point
    globalPlay(src, filename || "", title, time);
    playingRef.current = true;
    setPlaying(true);
  }

  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const dur = durationRef.current;
    if (!canvas || !dur) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    const seekTime = pct * dur;

    // Check if clicking near an existing marker (within 8px)
    const y = e.clientY - rect.top;
    const clickedMarker = markers.find((m) => {
      const markerX = (m.time / dur) * rect.width;
      return Math.abs(x - markerX) < 15;
    });

    if (clickedMarker) {
      setActiveMarkerId(
        activeMarkerId === clickedMarker.id ? null : clickedMarker.id
      );
      // Always start playback from marker position
      notifyPlayStart(instanceId.current);
      seekTo(clickedMarker.time);
      if (!playingRef.current) {
        startPlayback(clickedMarker.time);
        playingRef.current = true;
        setPlaying(true);
      }
      if (clickedMarker.comments.length > 0) {
        showCommentBriefly();
      }
      return;
    }

    seekTo(seekTime);
  }

  function addComment() {
    if (!activeMarkerId || !newComment.trim()) return;
    setMarkers((prev) =>
      prev.map((m) =>
        m.id === activeMarkerId
          ? { ...m, comments: [...m.comments, newComment.trim()] }
          : m
      )
    );
    setNewComment("");
    // Allow this marker to re-trigger on next pass
    triggeredMarkersRef.current.delete(activeMarkerId);
  }

  function deleteMarker(id: string) {
    setMarkers((prev) => prev.filter((m) => m.id !== id));
    if (activeMarkerId === id) setActiveMarkerId(null);
  }

  function deleteComment(markerId: string, idx: number) {
    setMarkers((prev) =>
      prev.map((m) =>
        m.id === markerId
          ? { ...m, comments: m.comments.filter((_, i) => i !== idx) }
          : m
      )
    );
    triggeredMarkersRef.current.delete(markerId);
  }

  function formatTime(s: number) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }

  return (
    <div
      ref={containerRef}
      className={`rounded-md bg-muted/[0.88] border transition-colors select-none ${focused ? "ring-1 ring-blue-500/50" : ""}`}
      tabIndex={0}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        // Don't blur if focus moves to a child
        if (!containerRef.current?.contains(e.relatedTarget as Node)) {
          setFocused(false);
        }
      }}
    >
      <div className="flex items-center gap-2 p-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={togglePlay}
          className="shrink-0 w-7 h-7 rounded-full p-0"
        >
          {playing ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </Button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-xs truncate">
              {(() => {
                const match = title.match(/^(.+?)\s*(\d+)$/);
                if (match) {
                  return <><span className="font-bold">{match[1]}</span><span className="text-muted-foreground ml-1">{match[2]}</span></>;
                }
                return <span className="font-bold">{title}</span>;
              })()}
              {!hasBeenPlayed && (
                <span className="ml-1 text-xs" style={{ filter: "drop-shadow(0 0 4px #facc15) drop-shadow(0 0 8px #fbbf24)" }}>✨</span>
              )}
            </span>
            <div className="flex items-center gap-2 shrink-0 ml-2">
              {extraInfo}
              {musicalKey && (
                <span className="text-xs font-mono text-emerald-400">
                  {semitones !== 0 ? shiftKey(musicalKey, semitones) : musicalKey}
                </span>
              )}
              {bpm && (
                <span className="text-xs font-mono text-purple-400">
                  {bpm} BPM
                </span>
              )}
            </div>
          </div>
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            className="w-full h-6 cursor-pointer rounded"
            style={{ display: loaded ? "block" : "none" }}
          />
          {!loaded && (
            <div className="w-full h-6 rounded bg-muted animate-pulse" />
          )}
          {duration > 0 && (
            <div className="flex items-center justify-between mt-0.5">
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 text-[10px] text-muted-foreground hover:text-foreground"
                  onClick={() => setSemitones((s) => s - 1)}
                >
                  -
                </Button>
                <span className={`text-[10px] font-mono min-w-[3rem] text-center ${semitones !== 0 ? "text-orange-400" : "text-muted-foreground"}`}>
                  {semitones > 0 ? `+${semitones}` : semitones} st
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 text-[10px] text-muted-foreground hover:text-foreground"
                  onClick={() => setSemitones((s) => s + 1)}
                >
                  +
                </Button>
                {semitones !== 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 px-1 text-[9px] text-muted-foreground hover:text-foreground"
                    onClick={() => setSemitones(0)}
                  >
                    reset
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                {weirdness != null && (
                  <span className="text-[10px]">
                    <span className="text-red-400 font-mono">{weirdness}%</span>
                    {" "}
                    <span className="text-foreground">weirdness</span>
                  </span>
                )}
                <span className="text-[10px] text-muted-foreground">
                  {formatTime(displayTime)} / {formatTime(duration)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Comment toast — fades in under waveform, fades out after 7s */}
      {commentVisible && activeMarker && (
        <div
          className={`px-3 pb-2 transition-opacity duration-700 ${commentFading ? "opacity-0" : "opacity-100"}`}
        >
          {/* Header line: time, comments, add, delete — all on one row */}
          <div className="flex items-center gap-2 text-xs">
            <span className="font-mono text-blue-400">{formatTime(activeMarker.time)}</span>
            {activeMarker.comments.map((comment, i) => (
              <span key={i} className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                {comment}
                <button
                  className="text-muted-foreground/50 hover:text-destructive"
                  onClick={() => deleteComment(activeMarker.id, i)}
                >
                  x
                </button>
              </span>
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-1.5 text-[10px] text-blue-400"
              onClick={() => {
                setCommentAdding(true);
                if (commentTimerRef.current) clearTimeout(commentTimerRef.current);
                setCommentFading(false);
              }}
            >
              + Add
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-1.5 text-[10px] text-destructive ml-auto"
              onClick={() => deleteMarker(activeMarker.id)}
            >
              Delete
            </Button>
          </div>

          {/* Add comment input — only when clicking Add */}
          {commentAdding && (
            <div className="flex gap-2 mt-1.5">
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Comment..."
                rows={1}
                className="text-xs min-h-[28px]"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (newComment.trim()) {
                      addComment();
                      setCommentAdding(false);
                      showCommentBriefly();
                    }
                  }
                  if (e.key === "Escape") {
                    setCommentAdding(false);
                    showCommentBriefly();
                  }
                }}
                onFocus={() => {
                  if (commentTimerRef.current) clearTimeout(commentTimerRef.current);
                  setCommentFading(false);
                }}
                onBlur={() => {
                  setCommentAdding(false);
                  showCommentBriefly();
                }}
              />
              <Button
                size="sm"
                onClick={() => {
                  addComment();
                  setCommentAdding(false);
                  showCommentBriefly();
                }}
                disabled={!newComment.trim()}
                className="shrink-0 h-7 text-xs"
              >
                Add
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
