"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WaveformPlayer } from "./waveform-player";
import { toast } from "sonner";
import { getPendingGroups, subscribePendingGroups } from "@/lib/pending-groups";
import { getExpandedGroups, setExpandedGroups as saveExpandedGroups } from "@/lib/library-state";

function path_join(...parts: string[]) { return parts.join("/"); }

type LibraryFile = {
  filename: string;
  title: string;
  size: number;
  createdAt: string;
  liked: boolean;
  weirdness: number | null;
  played: boolean;
};

type SongGroup = {
  name: string;
  files: LibraryFile[];
};

// Extract group name: "Apollos Playlist #3" -> "Apollos Playlist"
function getGroupName(title: string): string {
  return title.replace(/\s*#?\d+[a-c]?$/, "").trim();
}

function groupFiles(files: LibraryFile[]): (SongGroup | LibraryFile)[] {
  // Exclude liked files — they go in the Favorites folder
  const nonLiked = files.filter((f) => !f.liked);
  const groups: Record<string, LibraryFile[]> = {};
  const ungrouped: LibraryFile[] = [];

  for (const file of nonLiked) {
    const match = file.title.match(/^(.+?)\s*#?\d+[a-c]?$/);
    if (match) {
      const name = match[1].trim();
      if (!groups[name]) groups[name] = [];
      groups[name].push(file);
    } else {
      ungrouped.push(file);
    }
  }

  const result: (SongGroup | LibraryFile)[] = [];

  // Add groups (only if 2+ tracks) in order of newest file
  const sortedGroups = Object.entries(groups)
    .map(([name, groupFiles]) => ({
      name,
      files: groupFiles.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    }))
    .sort((a, b) =>
      new Date(b.files[0].createdAt).getTime() - new Date(a.files[0].createdAt).getTime()
    );

  for (const group of sortedGroups) {
    result.push(group);
  }

  // Add ungrouped files sorted by date
  ungrouped.sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  result.push(...ungrouped);

  return result;
}

function isGroup(item: SongGroup | LibraryFile): item is SongGroup {
  return "files" in item && Array.isArray(item.files);
}

export function SongLibrary() {
  const [files, setFiles] = useState<LibraryFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedGroups, setExpandedGroupsState] = useState<Set<string>>(getExpandedGroups);

  function setExpandedGroups(groups: Set<string>) {
    setExpandedGroupsState(groups);
    saveExpandedGroups(groups);
  }
  const [pending, setPending] = useState(getPendingGroups());
  const [retrying, setRetrying] = useState(false);
  const [sessionList, setSessionList] = useState<Array<{ id: number; projectName: string; artistName: string | null }>>([]);
  const [addingToSession, setAddingToSession] = useState<string | null>(null);

  useEffect(() => {
    loadLibrary();
    fetch("/api/sessions/list").then((r) => r.json()).then((d) => setSessionList(d.sessions || [])).catch(() => {});
    return subscribePendingGroups(() => setPending([...getPendingGroups()]));
  }, []);

  async function loadLibrary() {
    try {
      // Sync Dropbox state first (likes/rejects from shared folder)
      await fetch("/api/dropbox/sync", { method: "POST" }).catch(() => {});

      const res = await fetch("/api/suno/library");
      if (res.ok) {
        const data = await res.json();
        setFiles(data.files || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const interval = setInterval(loadLibrary, 10000);
    return () => clearInterval(interval);
  }, []);

  function toggleGroup(name: string) {
    const next = new Set(expandedGroups);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setExpandedGroups(next);
  }

  function hasNewFiles(groupName: string): boolean {
    const groupFiles = files.filter((f) => {
      const match = f.title.match(/^(.+?)\s*#?\d+[a-c]?$/);
      return match && match[1].trim() === groupName;
    });
    return groupFiles.some((f) => !f.played);
  }

  async function handleLike(filename: string, currentlyLiked: boolean) {
    const newLiked = !currentlyLiked;
    setFiles((prev) =>
      prev.map((f) => (f.filename === filename ? { ...f, liked: newLiked } : f))
    );
    try {
      await fetch("/api/suno/library/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename, liked: newLiked }),
      });
    } catch {
      setFiles((prev) =>
        prev.map((f) =>
          f.filename === filename ? { ...f, liked: currentlyLiked } : f
        )
      );
    }
  }

  async function handleDelete(filename: string, title: string) {
    if (!confirm(`Delete "${title}"? This removes the MP3 file.`)) return;

    setFiles((prev) => prev.filter((f) => f.filename !== filename));
    try {
      const res = await fetch("/api/suno/library/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename }),
      });
      if (res.ok) {
        toast.success(`"${title}" deleted`);
      } else {
        loadLibrary();
        toast.error("Failed to delete");
      }
    } catch {
      loadLibrary();
      toast.error("Failed to delete");
    }
  }

  async function handleDeleteFolder(groupName: string) {
    // Find all files in this group (including liked ones from the full list)
    const groupFiles = files.filter((f) => {
      const match = f.title.match(/^(.+?)\s*#?\d+[a-c]?$/);
      return match && match[1].trim() === groupName;
    });
    const toDelete = groupFiles.filter((f) => !f.liked);
    const kept = groupFiles.filter((f) => f.liked);

    if (toDelete.length === 0) {
      toast.success("All tracks in this folder are favorited — nothing to delete");
      return;
    }

    const msg = kept.length > 0
      ? `Delete ${toDelete.length} track${toDelete.length !== 1 ? "s" : ""} from "${groupName}"? (${kept.length} favorited track${kept.length !== 1 ? "s" : ""} will be kept)`
      : `Delete all ${toDelete.length} track${toDelete.length !== 1 ? "s" : ""} from "${groupName}"?`;

    if (!confirm(msg)) return;

    // Optimistic removal of non-liked
    setFiles((prev) => prev.filter((f) => !toDelete.some((d) => d.filename === f.filename)));

    let failed = 0;
    for (const file of toDelete) {
      try {
        const res = await fetch("/api/suno/library/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: file.filename }),
        });
        if (!res.ok) failed++;
      } catch {
        failed++;
      }
    }

    if (failed > 0) {
      loadLibrary();
      toast.error(`${failed} file(s) failed to delete`);
    } else {
      toast.success(`"${groupName}" deleted${kept.length > 0 ? ` (${kept.length} favorited kept)` : ""}`);
    }
  }

  async function handleRetryDownloads() {
    setRetrying(true);
    try {
      const res = await fetch("/api/suno/retry-download", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Retry failed");
        return;
      }
      if (data.status === "up_to_date") {
        toast.success("All songs already downloaded");
      } else {
        toast.success(data.message);
        loadLibrary();
      }
    } catch {
      toast.error("Retry failed");
    } finally {
      setRetrying(false);
    }
  }

  function formatSize(bytes: number) {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  async function handleAddToSession(sessionId: number, file: LibraryFile) {
    const filePath = path_join("downloads", file.filename);
    try {
      const res = await fetch("/api/sessions/add-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, filePath, filename: file.filename }),
      });
      const data = await res.json();
      if (res.ok) toast.success(data.message || "Added to session");
      else toast.error(data.error || "Failed");
    } catch { toast.error("Failed"); }
    setAddingToSession(null);
  }

  function renderTrack(file: LibraryFile) {
    return (
      <div key={file.filename}>
        <div className="flex gap-2">
          <div className="flex-1 min-w-0">
            <WaveformPlayer
              src={`/api/suno/audio?file=${encodeURIComponent(file.filename)}`}
              title={file.title}
              weirdness={file.weirdness}
              filename={file.filename}
              played={file.played || file.liked}
              extraInfo={
                <div className="relative">
                  <button
                    onClick={() => setAddingToSession(addingToSession === file.filename ? null : file.filename)}
                    className="text-blue-400 hover:text-blue-300"
                    title="Add to Session"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 5v14" /><path d="M5 12h14" />
                    </svg>
                  </button>
                  {addingToSession === file.filename && (
                    <div className="absolute right-0 top-5 z-50 bg-card border rounded-md shadow-lg py-1 min-w-48 max-h-48 overflow-y-auto">
                      {sessionList.length === 0 ? (
                        <p className="text-xs text-muted-foreground px-3 py-2">No sessions</p>
                      ) : (
                        sessionList.map((s) => (
                          <button
                            key={s.id}
                            onClick={() => handleAddToSession(s.id, file)}
                            className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors"
                          >
                            <span className="font-medium">{s.projectName}</span>
                            {s.artistName && (
                              <span className="text-muted-foreground ml-1">— {s.artistName}</span>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              }
            />
          </div>
          <div className="flex flex-col gap-1 shrink-0 pt-3">
            <Button
              variant="ghost"
              size="sm"
              className={`w-9 h-9 p-0 ${file.liked ? "text-green-400" : "text-muted-foreground hover:text-green-400"}`}
              onClick={() => handleLike(file.filename, file.liked)}
              title={file.liked ? "Unlike" : "Like"}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill={file.liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 10v12" />
                <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z" />
              </svg>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-9 h-9 p-0 text-muted-foreground hover:text-destructive"
              onClick={() => handleDelete(file.filename, file.title)}
              title="Delete"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: "rotate(180deg)" }}>
                <path d="M7 10v12" />
                <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z" />
              </svg>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div>
        <div className="h-20 rounded bg-muted animate-pulse" />
      </div>
    );
  }

  const items = groupFiles(files);
  const likedCount = files.filter((f) => f.liked).length;

  return (
    <div>
        {files.length === 0 && pending.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No songs yet. Generate one above to get started.
          </p>
        ) : (
          <div className="space-y-3">
            {/* Pending groups (generating) */}
            {pending.map((pg) => {
              // Don't show if real files already exist for this group
              const existingGroup = items.find(
                (item) => isGroup(item) && (item as SongGroup).name === pg.name
              );
              if (existingGroup) return null;
              return (
                <div key={`pending-${pg.name}`} className="rounded-lg border border-dashed border-blue-500/30 bg-blue-500/5">
                  <div className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
                      <span className="text-sm font-semibold">{pg.name}</span>
                      <span className="animate-pulse text-sm" style={{ filter: "drop-shadow(0 0 4px #60a5fa) drop-shadow(0 0 8px #3b82f6)" }}>
                        ✨
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-blue-400 border-blue-400/30">
                        Generating {pg.titles.length * 2} tracks...
                      </Badge>
                    </div>
                  </div>
                  <div className="px-3 pb-3 space-y-2">
                    {pg.titles.flatMap((t) => [0, 1].map((v) => (
                      <div key={`${t}-v${v}`} className="flex items-center gap-2 p-2 rounded bg-muted/30">
                        <div className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
                        <span className="text-xs text-muted-foreground">{t}</span>
                        <span className="text-[10px] text-blue-400/40 ml-1">v{v + 1}</span>
                        <span className="text-[10px] text-blue-400/60 ml-auto">awaiting</span>
                      </div>
                    )))}
                  </div>
                </div>
              );
            })}
            {/* Favorites folder */}
            {likedCount > 0 && (() => {
              const likedFiles = files.filter((f) => f.liked);
              const favExpanded = expandedGroups.has("__favorites__");
              return (
                <div className="rounded-lg border" style={{ background: "rgba(var(--folder-r), var(--folder-g), var(--folder-b), 1)" }}>
                  <div
                    onClick={() => toggleGroup("__favorites__")}
                    className="w-full flex items-center justify-between p-3 hover:bg-muted/40 transition-colors rounded-lg cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className={`transition-transform ${favExpanded ? "rotate-90" : ""}`}
                      >
                        <path d="m9 18 6-6-6-6" />
                      </svg>
                      <span className="text-sm font-bold">Favorites</span>
                      <span className="text-sm" style={{ filter: "drop-shadow(0 0 3px #eab308)" }}>⭐️</span>
                    </div>
                    <Badge variant="secondary">{likedCount} track{likedCount !== 1 ? "s" : ""}</Badge>
                  </div>
                  {favExpanded && (
                    <div className="px-3 pb-3 space-y-3">
                      {likedFiles.map((file) => renderTrack(file))}
                    </div>
                  )}
                </div>
              );
            })()}

            {items.map((item, itemIndex) => {
              if (isGroup(item)) {
                const expanded = expandedGroups.has(item.name);
                const isNew = hasNewFiles(item.name);
                const likedInGroup = item.files.filter((f) => f.liked).length;
                const totalGroups = items.filter(isGroup).length;
                const groupIndex = items.filter((it, idx) => idx <= itemIndex && isGroup(it)).length - 1;
                // Deep purple (favorites) → frost purple (last folder)
                // Opacity goes from 0.12 down to 0.04
                const purpleOpacity = Math.max(0.6, 1 - (groupIndex / Math.max(totalGroups - 1, 1)) * 0.4);
                // Hue shifts from deep (280) to frost/lighter (260)
                return (
                  <div key={`group-${item.name}`} className="rounded-lg border" style={{ background: `rgba(var(--folder-r), var(--folder-g), var(--folder-b), ${purpleOpacity})` }}>
                    <div
                      onClick={() => toggleGroup(item.name)}
                      className="w-full flex items-center justify-between p-3 hover:bg-muted/40 transition-colors rounded-lg cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className={`transition-transform ${expanded ? "rotate-90" : ""}`}
                        >
                          <path d="m9 18 6-6-6-6" />
                        </svg>
                        <span className="text-sm font-bold">{item.name}</span>
                        {isNew && (
                          <span className="ml-1 animate-pulse text-sm" style={{ filter: "drop-shadow(0 0 4px #facc15) drop-shadow(0 0 8px #fbbf24)" }}>
                            ✨
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {likedInGroup > 0 && (
                          <span className="text-xs text-green-400">
                            {likedInGroup} liked
                          </span>
                        )}
                        <Badge variant="secondary">
                          {item.files.length} track{item.files.length !== 1 ? "s" : ""}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteFolder(item.name);
                          }}
                          title="Delete folder"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                          </svg>
                        </Button>
                      </div>
                    </div>
                    {expanded && (
                      <div className="px-3 pb-3 space-y-3">
                        {item.files.map((file) => renderTrack(file))}
                      </div>
                    )}
                  </div>
                );
              }
              return renderTrack(item);
            })}
          </div>
        )}
    </div>
  );
}
