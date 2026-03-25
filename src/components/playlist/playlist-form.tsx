"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { GenerationTimer } from "./generation-timer";
import { addPendingGroup, removePendingGroup } from "@/lib/pending-groups";
import { getPendingAudio, clearPendingAudio, subscribePendingAudio } from "@/lib/pending-audio";

type Song = { artist: string; title: string };

export function PlaylistForm() {
  const [url, setUrl] = useState("");
  const [extraPrompt, setExtraPrompt] = useState("");
  const [weirdness1, setWeirdness1] = useState("55");
  const [weirdness2, setWeirdness2] = useState("69");
  const [forceBpm, setForceBpm] = useState("");
  const [forceKey, setForceKey] = useState("");
  const [totalSongs, setTotalSongs] = useState(2);
  const [audioFile, setAudioFile] = useState<{ name: string; path: string } | null>(null);
  const [audioFromInbox, setAudioFromInbox] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [playlistName, setPlaylistName] = useState<string | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [sunoPrompt, setSunoPrompt] = useState<string | null>(null);
  const [charCount, setCharCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [genCount, setGenCount] = useState(0);
  const genCountRef = useRef(0);
  const [downloadStatus, setDownloadStatus] = useState<string | null>(null);

  // Pick up audio sent from inbox
  useEffect(() => {
    function checkPending() {
      const pending = getPendingAudio();
      if (pending) {
        setAudioFile({ name: pending.name, path: pending.path });
        setAudioFromInbox(true);
        clearPendingAudio();
      }
    }
    checkPending();
    return subscribePendingAudio(checkPending);
  }, []);

  // Pick up queued generations from the chat assistant
  const processingQueue = useRef(false);
  useEffect(() => {
    const interval = setInterval(async () => {
      if (processingQueue.current || generating || loading) return;
      try {
        const res = await fetch("/api/suno/queue");
        const data = await res.json();
        if (!data.items || data.items.length === 0) return;
        const item = data.items[0]; // process one at a time
        processingQueue.current = true;

        // Set form state from queued item
        const artists = item.artists.split(/\s*[,]\s*|\s+x\s+/i).map((a: string) => a.trim()).filter((a: string) => a.length > 0);
        const tracks = artists.map((a: string) => ({ artist: a, title: "" }));
        const name = artists.join(" x ");
        setUrl(item.artists);
        setSongs(tracks);
        setPlaylistName(name);
        setTotalSongs(item.count || 4);
        setWeirdness1(String(item.weirdness1 ?? 55));
        setWeirdness2(String(item.weirdness2 ?? 69));
        setLoading(true);
        setStatus(`Chat requested: generating Suno prompt for ${name}...`);

        // Generate the prompt
        const promptRes = await fetch("/api/playlist/generate-prompt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ songs: tracks, extraPrompt: item.extraPrompt || undefined }),
        });
        if (!promptRes.ok) throw new Error("Failed to generate prompt");
        const promptData = await promptRes.json();

        setSunoPrompt(promptData.prompt);
        sunoPromptRef.current = promptData.prompt;
        setCharCount(promptData.charCount);
        setStatus(null);
        setLoading(false);

        // Auto-trigger Suno generation with overrides (state hasn't re-rendered yet)
        handleGenerateOnSuno(promptData.prompt, name, {
          totalSongs: item.count || 4,
          w1: item.weirdness1 ?? 55,
          w2: item.weirdness2 ?? 69,
        });
      } catch {
        toast.error("Failed to process chat generation request");
        setLoading(false);
        setStatus(null);
      } finally {
        processingQueue.current = false;
      }
    }, 2000);
    return () => clearInterval(interval);
  });
  const [downloaded, setDownloaded] = useState<Array<{ title: string; path: string }>>([]);
  const [timerActive, setTimerActive] = useState(false);
  const [timerStart, setTimerStart] = useState(0);
  const [promptExpanded, setPromptExpanded] = useState(false);
  const sunoPromptRef = useRef<string | null>(null);

  async function handleSubmit() {
    if (!url.trim()) return;
    setLoading(true);
    setSunoPrompt(null);
    setSongs([]);
    setPlaylistName(null);
    setSubmitted(false);
    setGenCount(0);
    genCountRef.current = 0;
    setDownloaded([]);

    try {
      const input = url.trim();
      const isUrl = input.startsWith("http") || input.includes("spotify.com") || input.includes("suno.com");

      let tracks: Song[] = [];
      let name: string | null = null;

      if (isUrl) {
        // Playlist URL mode
        setStatus("Fetching playlist...");
        const parseRes = await fetch("/api/playlist/parse-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: input }),
        });
        const parseData = await parseRes.json();
        if (!parseRes.ok) {
          toast.error(parseData.error || "Failed to parse playlist");
          return;
        }
        if (!parseData.tracks || parseData.tracks.length === 0) {
          toast.error("No tracks found in this playlist");
          return;
        }
        tracks = parseData.tracks;
        name = parseData.name || null;
      } else {
        // Artist names mode — split by commas
        const artists = input.split(",").map((a) => a.trim()).filter((a) => a.length > 0);
        if (artists.length < 2) {
          toast.error("Enter at least 2 artists separated by commas, or paste a Spotify link");
          return;
        }
        // Create pseudo-tracks with just artist names (no specific songs)
        tracks = artists.map((a) => ({ artist: a, title: "" }));
        name = artists.join(" x ");
        setStatus(`Generating Suno prompt from ${artists.length} artists...`);
      }

      setSongs(tracks);
      setPlaylistName(name);

      setStatus(isUrl
        ? `Found ${tracks.length} tracks — generating Suno prompt...`
        : `Analyzing ${tracks.length} artists — generating Suno prompt...`
      );
      const promptRes = await fetch("/api/playlist/generate-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songs: tracks, extraPrompt: extraPrompt.trim() || undefined, forceBpm: forceBpm.trim() || undefined, forceKey: forceKey.trim() || undefined }),
      });
      if (!promptRes.ok) throw new Error("Failed to generate prompt");
      const promptData = await promptRes.json();

      setSunoPrompt(promptData.prompt);
      sunoPromptRef.current = promptData.prompt;
      setCharCount(promptData.charCount);
      setStatus(null);

      // Auto-trigger generation on Suno
      handleGenerateOnSuno(promptData.prompt, name);
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
      setStatus(null);
    }
  }

  async function regenerate() {
    if (songs.length === 0) return;
    setLoading(true);
    setStatus("Regenerating...");
    try {
      const res = await fetch("/api/playlist/generate-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songs, extraPrompt: extraPrompt.trim() || undefined, forceBpm: forceBpm.trim() || undefined, forceKey: forceKey.trim() || undefined }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setSunoPrompt(data.prompt);
      sunoPromptRef.current = data.prompt;
      setCharCount(data.charCount);
      setSubmitted(false);
      toast.success("New prompt generated");
    } catch {
      toast.error("Failed to regenerate");
    } finally {
      setLoading(false);
      setStatus(null);
    }
  }

  async function copyPrompt() {
    if (sunoPrompt) {
      await navigator.clipboard.writeText(sunoPrompt);
      toast.success("Copied to clipboard");
    }
  }

  async function handleGenerateOnSuno(promptOverride?: string, nameOverride?: string | null, overrides?: { totalSongs?: number; w1?: number; w2?: number }) {
    const prompt = promptOverride || sunoPromptRef.current || sunoPrompt;
    if (!prompt) return;
    const name = nameOverride !== undefined ? nameOverride : playlistName;
    setGenerating(true);

    // Ask the API for the next available number based on existing Suno songs
    let nextNum = genCountRef.current + 1;
    try {
      const numRes = await fetch("/api/suno/next-number", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playlistName: name || "Playlist" }),
      });
      if (numRes.ok) {
        const numData = await numRes.json();
        nextNum = numData.nextNumber;
      }
    } catch {
      // Fall back to local counter
    }
    const base = name || "Playlist";
    const numGenerations = Math.max(1, Math.floor((overrides?.totalSongs ?? totalSongs) / 2));
    const w1 = overrides?.w1 ?? (parseInt(weirdness1) || 55);
    const w2 = overrides?.w2 ?? (parseInt(weirdness2) || 69);

    // Build titles and weirdness for each generation
    const titles: string[] = [];
    const weirdnessLevels: number[] = [];
    const wMap: Record<string, number> = {};

    for (let i = 0; i < numGenerations; i++) {
      const title = `${base} ${nextNum + i}`;
      titles.push(title);
      // Alternate: even generations (0, 2, 4...) = w1, odd (1, 3, 5...) = w2
      const w = i % 2 === 0 ? w1 : w2;
      weirdnessLevels.push(w);
      wMap[title] = w;
    }

    genCountRef.current = nextNum + numGenerations - 1;

    setTimerActive(true);
    setTimerStart(Date.now());
    setSubmitted(true);
    setGenCount(genCountRef.current);

    addPendingGroup(base, titles);

    // Start polling immediately
    pollForDownload(titles, base, wMap);

    // Fire off the generation
    fetch("/api/suno/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, titles, weirdnessLevels, audioFilePath: audioFile?.path }),
    })
      .then((res) => res.json())
      .then((data) => {
        setGenerating(false);
        if (data.error) {
          toast.error(data.error);
        }
      })
      .catch(() => {
        toast.error("Failed to connect to Suno");
        setGenerating(false);
      });

    toast.success(`Generating ${totalSongs} songs (${numGenerations} x2) on Suno`);
  }

  async function pollForDownload(songTitles: string[], groupName?: string, weirdnessMap?: Record<string, number>) {
    setDownloadStatus("Waiting for Suno to finish generating...");
    let attempts = 0;
    const maxAttempts = 40; // ~13 minutes at 20s intervals
    let downloaded = false;

    const tryDownload = async (): Promise<boolean> => {
      try {
        const res = await fetch("/api/suno/download", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ titles: songTitles, weirdnessMap }),
        });
        const data = await res.json();

        if (data.status === "downloaded" && data.downloaded?.length > 0) {
          setDownloadStatus(null);
          setTimerActive(false);
          if (groupName) removePendingGroup(groupName);
          toast.success(`${data.downloaded.length} MP3(s) saved to /downloads`);
          setDownloaded(data.downloaded);
          return true;
        }

        if (data.status === "generating") {
          setDownloadStatus(`Waiting for songs... (${Math.round(attempts * 20)}s)`);
        }
        // On error/429, just keep trying — don't stop
        return false;
      } catch {
        return false;
      }
    };

    const poll = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) {
        clearInterval(poll);
        // One final attempt
        const success = await tryDownload();
        if (!success) {
          setDownloadStatus(null);
          setTimerActive(false);
          toast.error("Timed out. Songs may still be generating on Suno.");
        }
        return;
      }

      const success = await tryDownload();
      if (success) {
        downloaded = true;
        clearInterval(poll);
      }
    }, 20000);
  }

  return (
    <div className="space-y-6">
      {/* Input */}
      <Card className="bg-card/[0.88]">
        <CardContent className="pt-6">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Enter Playlist Url or Artist Names.."
            className="h-12 text-base"
            onKeyDown={(e) => e.key === "Enter" && !loading && handleSubmit()}
            disabled={loading}
          />
          <Input
            value={extraPrompt}
            onChange={(e) => setExtraPrompt(e.target.value)}
            placeholder="Prompt additions.."
            className="mt-2 text-sm"
            disabled={loading}
          />
          {/* Audio file upload */}
          <div className="flex items-center gap-2 mt-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setUploading(true);
                try {
                  const formData = new FormData();
                  formData.append("file", file);
                  const res = await fetch("/api/upload", { method: "POST", body: formData });
                  const data = await res.json();
                  if (res.ok) {
                    setAudioFile({ name: file.name, path: data.filePath });
                    toast.success(`Uploaded: ${file.name}`);
                  } else {
                    toast.error(data.error || "Upload failed");
                  }
                } catch {
                  toast.error("Upload failed");
                } finally {
                  setUploading(false);
                }
              }}
            />
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || loading}
            >
              {uploading ? "Uploading..." : audioFile ? "Change Audio" : "+ Audio File"}
            </Button>
            {audioFile && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                </svg>
                <span
                  className={`truncate max-w-40 ${audioFromInbox ? "text-cyan-400 animate-pulse" : ""}`}
                  style={audioFromInbox ? { filter: "drop-shadow(0 0 4px #22d3ee) drop-shadow(0 0 8px #06b6d4)" } : undefined}
                >
                  {audioFile.name}
                </span>
                <button
                  onClick={() => { setAudioFile(null); setAudioFromInbox(false); }}
                  className="text-muted-foreground/50 hover:text-destructive"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-1.5 mt-2">
            <div className="flex flex-col items-center mr-1">
              <button
                onClick={() => setTotalSongs((n) => Math.min(n + 2, 20))}
                className="text-[9px] text-muted-foreground hover:text-foreground leading-none"
                disabled={loading}
              >
                ▲
              </button>
              <span className="text-xs font-mono text-foreground font-bold">{totalSongs}</span>
              <button
                onClick={() => setTotalSongs((n) => Math.max(n - 2, 2))}
                className="text-[9px] text-muted-foreground hover:text-foreground leading-none"
                disabled={loading}
              >
                ▼
              </button>
            </div>
            <Input
              value={weirdness1}
              onChange={(e) => setWeirdness1(e.target.value.replace(/\D/g, "").slice(0, 3))}
              className="w-10 h-8 text-center text-xs font-mono text-red-400 px-0"
              disabled={loading}
            />
            {totalSongs > 2 && (
              <Input
                value={weirdness2}
                onChange={(e) => setWeirdness2(e.target.value.replace(/\D/g, "").slice(0, 3))}
                className="w-10 h-8 text-center text-xs font-mono text-red-400 px-0"
                disabled={loading}
              />
            )}
            <Input
              value={forceBpm}
              onChange={(e) => setForceBpm(e.target.value.replace(/\D/g, "").slice(0, 3))}
              placeholder="BPM"
              className="w-12 h-8 text-center text-xs font-mono text-purple-400 px-0"
              disabled={loading}
            />
            <Input
              value={forceKey}
              onChange={(e) => setForceKey(e.target.value)}
              placeholder="Key"
              className="w-16 h-8 text-center text-xs font-mono text-emerald-400 px-0"
              disabled={loading}
            />
            <Button
              onClick={handleSubmit}
              disabled={loading || !url.trim()}
              className="h-8 px-5 text-sm"
            >
              {loading ? "Working..." : "Suno it"}
            </Button>
          </div>
          {status && (
            <p className="text-sm text-muted-foreground mt-3 animate-pulse">
              {status}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Result */}
      {sunoPrompt && (
        <Card>
          <button
            onClick={() => setPromptExpanded(!promptExpanded)}
            className="w-full flex items-center justify-between p-4 hover:bg-muted/40 transition-colors"
          >
            <div className="flex items-center gap-2">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={`transition-transform ${promptExpanded ? "rotate-90" : ""}`}
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
              <span className="text-sm font-semibold">Suno Prompt</span>
              {playlistName && (
                <span className="text-sm font-normal text-muted-foreground">
                  from {playlistName}
                </span>
              )}
            </div>
            <Badge variant={charCount <= 1000 ? "secondary" : "destructive"}>
              {charCount} / 1000
            </Badge>
          </button>
          {promptExpanded && (
            <CardContent className="space-y-4 pt-0">
              <div className="p-4 rounded-md bg-muted text-sm leading-relaxed whitespace-pre-wrap border">
                {sunoPrompt}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => handleGenerateOnSuno()}
                  disabled={generating}
                >
                  {generating
                    ? "Opening Suno..."
                    : genCount > 0
                    ? `Generate on Suno (#${genCount + 1})`
                    : "Generate on Suno"}
                </Button>
                <Button variant="outline" onClick={copyPrompt}>
                  Copy to Clipboard
                </Button>
                <Button variant="ghost" onClick={regenerate} disabled={loading}>
                  {loading ? "Regenerating..." : "Regenerate"}
                </Button>
              </div>
            </CardContent>
          )}
          <GenerationTimer active={timerActive} startTime={timerStart} />
        </Card>
      )}

    </div>
  );
}
