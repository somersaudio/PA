"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { setPendingAudio } from "@/lib/pending-audio";
import { injectChatMessage } from "@/lib/chat-inject";
import { toast } from "sonner";

type Attachment = {
  filename: string;
  size: number;
  contentType: string;
  savedPath: string;
};

type Email = {
  id: string;
  from: string;
  fromName: string;
  subject: string;
  date: string;
  body: string;
  attachments: Attachment[];
  aiSummary: string | null;
  category: "work" | "personal" | "newsletter" | "notification" | "spam" | null;
  priority: "high" | "medium" | "low" | null;
  actionItems: string[];
  read: boolean;
};

export default function InboxPage() {
  const navRouter = useRouter();
  const [emails, setEmails] = useState<Email[]>([]);
  const [monitoring, setMonitoring] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const hasAutoSelected = useRef(false);
  const [connecting, setConnecting] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [sessionList, setSessionList] = useState<Array<{ id: number; projectName: string; artistName: string | null }>>([]);
  const [addingToSession, setAddingToSession] = useState<string | null>(null); // attachment savedPath

  const [contacts, setContacts] = useState<Record<string, { name: string; relationship: string }>>({});

  // IMAP config
  const [host, setHost] = useState("");
  const [port, setPort] = useState("993");
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");

  useEffect(() => {
    // Load saved config
    const saved = localStorage.getItem("pa-imap-config");
    if (saved) {
      const config = JSON.parse(saved);
      setHost(config.host || "");
      setPort(config.port || "993");
      setUser(config.user || "");
    }
    loadInbox();
    loadContacts();
    loadSessions();
    const interval = setInterval(loadInbox, 5000);
    return () => clearInterval(interval);
  }, []);

  async function loadInbox() {
    try {
      const res = await fetch("/api/email/inbox");
      if (res.ok) {
        const data = await res.json();
        const emailList: Email[] = data.emails || [];
        setEmails(emailList);
        setUnreadCount(data.unreadCount || 0);
        setMonitoring(data.monitoring || false);

        // Auto-select most urgent email on first load
        if (!hasAutoSelected.current && emailList.length > 0) {
          hasAutoSelected.current = true;
          const priorityOrder = { high: 0, medium: 1, low: 2 };
          const sorted = [...emailList].sort((a, b) => {
            const pa = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 2;
            const pb = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 2;
            if (pa !== pb) return pa - pb;
            return new Date(b.date).getTime() - new Date(a.date).getTime();
          });
          setSelectedEmail(sorted[0]);
        }
      }
    } catch {}
  }

  async function loadSessions() {
    try {
      const res = await fetch("/api/sessions/list");
      if (res.ok) {
        const data = await res.json();
        setSessionList(data.sessions || []);
      }
    } catch {}
  }

  async function handleAddToSession(sessionId: number, att: Attachment) {
    try {
      const res = await fetch("/api/sessions/add-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          filePath: att.savedPath,
          filename: att.filename,
          fromEmail: selectedEmail?.from,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "Added to session");
      } else {
        toast.error(data.error || "Failed");
      }
    } catch {
      toast.error("Failed to add to session");
    }
    setAddingToSession(null);
  }

  async function loadContacts() {
    try {
      const res = await fetch("/api/email/contacts");
      if (res.ok) {
        const data = await res.json();
        setContacts(data.contacts || {});
      }
    } catch {}
  }

  function getContactName(email: Email): string {
    const contact = contacts[email.from];
    if (contact?.name && contact.name !== email.from) return contact.name;
    if (email.fromName && email.fromName !== email.from) return email.fromName;
    return email.from;
  }

  async function handleConnect() {
    if (!host || !user || !pass) {
      toast.error("Fill in all IMAP fields");
      return;
    }
    setConnecting(true);
    localStorage.setItem(
      "pa-imap-config",
      JSON.stringify({ host, port, user })
    );
    try {
      const res = await fetch("/api/email/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host,
          port: parseInt(port) || 993,
          user,
          pass,
          secure: true,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Email monitoring started");
        setMonitoring(true);
        setShowConfig(false);
        loadInbox();
      } else {
        toast.error(data.error || "Failed to connect");
      }
    } catch {
      toast.error("Failed to connect");
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    await fetch("/api/email/stop", { method: "POST" });
    setMonitoring(false);
    toast.success("Email monitoring stopped");
  }

  async function handleSelectEmail(email: Email) {
    setSelectedEmail(email);
    if (!email.read) {
      await fetch("/api/email/inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "markRead", id: email.id }),
      });
      setEmails((prev) =>
        prev.map((e) => (e.id === email.id ? { ...e, read: true } : e))
      );
    }
  }

  async function handleDeleteEmail(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    setEmails((prev) => prev.filter((em) => em.id !== id));
    if (selectedEmail?.id === id) setSelectedEmail(null);
    await fetch("/api/email/inbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
  }

  function formatDate(iso: string) {
    const d = new Date(iso);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    }
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">Inbox</h1>
          {unreadCount > 0 && (
            <Badge variant="default">{unreadCount} new</Badge>
          )}
          {monitoring && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-muted-foreground"
          onClick={() => {
            loadInbox();
            toast.success("Inbox refreshed");
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
            <path d="M16 21h5v-5" />
          </svg>
          Refresh
        </Button>
      </div>

      {/* Email list + detail */}
      <div className="flex gap-4" style={{ minHeight: "60vh" }}>
        {/* Email list */}
        <Card className="w-96 shrink-0">
          <CardContent className="p-0">
            {emails.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">
                {monitoring ? "Waiting for emails..." : "Connect an email to get started"}
              </p>
            ) : (
              <div className="divide-y">
                {emails.map((email) => (
                  <div
                    key={email.id}
                    onClick={() => handleSelectEmail(email)}
                    className={`p-3 cursor-pointer transition-colors ${
                      selectedEmail?.id === email.id
                        ? "bg-muted"
                        : "hover:bg-muted/50"
                    } ${!email.read ? "border-l-2 border-l-blue-400" : ""}`}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span className={`text-sm truncate ${!email.read ? "font-semibold" : ""}`}>
                        {getContactName(email)}
                      </span>
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <span className="text-[10px] text-muted-foreground">
                          {formatDate(email.date)}
                        </span>
                        <button
                          onClick={(e) => handleDeleteEmail(e, email.id)}
                          className="text-muted-foreground/50 hover:text-destructive p-0.5"
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <p className={`text-xs truncate ${!email.read ? "text-foreground" : "text-muted-foreground"}`}>
                      {email.subject}
                    </p>
                    {email.aiSummary && (
                      <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                        {email.aiSummary}
                      </p>
                    )}
                    <div className="flex items-center gap-1 mt-1">
                      {email.attachments.length > 0 && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                          <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                        </svg>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Email detail */}
        <Card className="flex-1 overflow-visible">
          <CardContent className="p-4 overflow-visible">
            {selectedEmail ? (
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold">{selectedEmail.subject}</h2>
                  <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                    <span>{getContactName(selectedEmail)}</span>
                    <span className="text-xs text-muted-foreground">{selectedEmail.from}</span>
                    <span className="ml-auto text-xs">
                      {new Date(selectedEmail.date).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* AI Summary */}
                {selectedEmail.aiSummary && (
                  <div className="p-3 rounded-md bg-blue-500/10 border border-blue-500/20">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-blue-400">AI Summary</span>
                      {selectedEmail.actionItems.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[10px] text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                          onClick={() => {
                            const message = `Execute these action items from the email "${selectedEmail.subject}" from ${getContactName(selectedEmail)}:\n\n${selectedEmail.actionItems.map((a, i) => `${i + 1}. ${a}`).join("\n")}\n\nEmail body for context: "${selectedEmail.body}"`;
                            injectChatMessage(message);
                            toast.success("Sent to assistant");
                          }}
                        >
                          <span className="flex items-center gap-1">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polygon points="6 3 20 12 6 21 6 3" />
                            </svg>
                            Execute
                          </span>
                        </Button>
                      )}
                    </div>
                    <p className="text-sm mt-1">{selectedEmail.aiSummary}</p>
                    {selectedEmail.actionItems.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {selectedEmail.actionItems.map((item, i) => (
                          <div key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                            <span className="text-blue-400/60 mt-0.5">•</span>
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Attachments */}
                {selectedEmail.attachments.length > 0 && (
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">
                      Attachments
                    </span>
                    <div className="space-y-2 mt-1">
                      {selectedEmail.attachments.map((att, i) => {
                        const isAudio = /\.(mp3|wav|aiff?|flac|ogg|m4a|mp4)$/i.test(att.filename);
                        const audioSrc = `/api/email/attachment?path=${encodeURIComponent(att.savedPath)}`;
                        return (
                          <div key={i} className="rounded-md bg-muted p-2">
                            <div className="flex items-center gap-2 text-xs">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground shrink-0">
                                <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                              </svg>
                              <span className="font-medium">{att.filename}</span>
                              <span className="text-muted-foreground">{formatSize(att.size)}</span>
                              {isAudio && (
                                <>
                                  <div className="relative ml-auto">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-5 px-1.5 text-[10px] text-blue-400"
                                      onClick={() => setAddingToSession(addingToSession === att.savedPath ? null : att.savedPath)}
                                    >
                                      + Session
                                    </Button>
                                    {addingToSession === att.savedPath && (
                                      <div className="absolute right-0 top-6 z-50 bg-card border rounded-md shadow-lg py-1 min-w-48 max-h-48 overflow-y-auto">
                                        {sessionList.length === 0 ? (
                                          <p className="text-xs text-muted-foreground px-3 py-2">No sessions</p>
                                        ) : (
                                          sessionList.map((s) => (
                                            <button
                                              key={s.id}
                                              onClick={() => handleAddToSession(s.id, att)}
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
                                  <button
                                    onClick={() => {
                                      setPendingAudio({ name: att.filename, path: att.savedPath });
                                      toast.success("Audio ready — opening Spotify + Suno");
                                      navRouter.push("/playlist-parser");
                                    }}
                                    className="opacity-70 hover:opacity-100 transition-opacity"
                                    title="Send to Suno"
                                  >
                                    <Image src="/spotify-suno-logo.png" alt="Suno" width={16} height={16} className="rounded" />
                                  </button>
                                </>
                              )}
                            </div>
                            {isAudio && (
                              <AttachmentPlayer src={audioSrc} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Body */}
                <div className="text-sm whitespace-pre-wrap leading-relaxed">
                  {selectedEmail.body}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-24">
                Select an email to view
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AttachmentPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = "metadata";
    audio.src = src;
    audioRef.current = audio;
    audio.addEventListener("loadedmetadata", () => {
      if (audio.duration && isFinite(audio.duration)) setDuration(audio.duration);
    });
    audio.addEventListener("timeupdate", () => {
      if (audio.duration) setProgress(audio.currentTime / audio.duration);
    });
    audio.addEventListener("ended", () => {
      setPlaying(false);
      setProgress(0);
    });
    return () => { audio.pause(); audio.removeAttribute("src"); };
  }, [src]);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) { audio.play(); setPlaying(true); }
    else { audio.pause(); setPlaying(false); }
  }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const audio = audioRef.current;
    const bar = barRef.current;
    if (!audio || !bar || !duration) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = pct * duration;
    setProgress(pct);
  }

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center gap-2 mt-2 p-1.5 rounded bg-background/50">
      <button onClick={toggle} className="shrink-0 w-6 h-6 flex items-center justify-center text-foreground">
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
      </button>
      <div
        ref={barRef}
        onClick={seek}
        className="flex-1 h-1.5 bg-muted rounded-full cursor-pointer relative"
      >
        <div
          className="h-full bg-foreground/60 rounded-full"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      <span className="text-[9px] text-muted-foreground font-mono shrink-0">
        {duration > 0 ? `${fmt(progress * duration)} / ${fmt(duration)}` : ""}
      </span>
    </div>
  );
}
