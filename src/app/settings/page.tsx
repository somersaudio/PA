"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/components/theme-provider";
import { toast } from "sonner";

type KeyStatus = {
  anthropic: boolean;
  openai: boolean;
  gemini: boolean;
  spotify: boolean;
};

const providers = [
  { id: "anthropic", name: "Claude", logo: "/claude-logo.png", placeholder: "sk-ant-..." },
  { id: "openai", name: "OpenAI", logo: "/openai-logo.png", placeholder: "sk-..." },
  { id: "gemini", name: "Gemini", logo: "/gemini-logo.png", placeholder: "AI..." },
];

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [keyStatus, setKeyStatus] = useState<KeyStatus>({ anthropic: false, openai: false, gemini: false, spotify: false });
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState("");
  const [spotifyClientId, setSpotifyClientId] = useState("");
  const [spotifyClientSecret, setSpotifyClientSecret] = useState("");
  const [saving, setSaving] = useState(false);

  // SoundFlow
  const [sfUserId, setSfUserId] = useState("");
  const [sfCommandCount, setSfCommandCount] = useState(0);
  const [editingSoundFlow, setEditingSoundFlow] = useState(false);
  const [sfSaving, setSfSaving] = useState(false);

  // Dropbox
  const [dropboxPath, setDropboxPath] = useState("");
  const [dropboxConnected, setDropboxConnected] = useState(false);
  const [editingDropbox, setEditingDropbox] = useState(false);
  const [dropboxSaving, setDropboxSaving] = useState(false);

  // Email IMAP
  const [emailMonitoring, setEmailMonitoring] = useState(false);
  const [editingEmail, setEditingEmail] = useState(false);
  const [imapHost, setImapHost] = useState("");
  const [imapPort, setImapPort] = useState("993");
  const [imapUser, setImapUser] = useState("");
  const [imapPass, setImapPass] = useState("");
  const [emailConnecting, setEmailConnecting] = useState(false);

  useEffect(() => {
    fetch("/api/settings/api-keys")
      .then((r) => r.json())
      .then((d) => setKeyStatus(d))
      .catch(() => {});
    fetch("/api/soundflow/user-id")
      .then((r) => r.json())
      .then((d) => { if (d.userId) setSfUserId(d.userId); })
      .catch(() => {});
    fetch("/api/soundflow/commands")
      .then((r) => r.json())
      .then((d) => setSfCommandCount(Array.isArray(d) ? d.length : 0))
      .catch(() => {});
    fetch("/api/settings/dropbox")
      .then((r) => r.json())
      .then((d) => {
        setDropboxConnected(d.connected || false);
        if (d.folderPath) setDropboxPath(d.folderPath);
      })
      .catch(() => {});
    fetch("/api/email/inbox")
      .then((r) => r.json())
      .then((d) => setEmailMonitoring(d.monitoring || false))
      .catch(() => {});
    const saved = localStorage.getItem("pa-imap-config");
    if (saved) {
      const c = JSON.parse(saved);
      setImapHost(c.host || "");
      setImapPort(c.port || "993");
      setImapUser(c.user || "");
    }
  }, []);

  async function handleSaveKey(provider: string) {
    if (!keyInput.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, key: keyInput.trim() }),
      });
      if (res.ok) {
        setKeyStatus((prev) => ({ ...prev, [provider]: true }));
        setEditingProvider(null);
        setKeyInput("");
        toast.success(`${providers.find((p) => p.id === provider)?.name} API key saved`);
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to save");
      }
    } catch {
      toast.error("Failed to save key");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Settings</h1>

      {/* API Keys */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>AI Providers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {providers.map((p) => {
            const connected = keyStatus[p.id as keyof KeyStatus];
            const editing = editingProvider === p.id;
            return (
              <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg border">
                <Image
                  src={p.logo}
                  alt={p.name}
                  width={28}
                  height={28}
                  className={`rounded ${p.id === "openai" ? "invert" : ""}`}
                />
                <span className="text-sm font-medium flex-1">{p.name}</span>
                {editing ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={keyInput}
                      onChange={(e) => setKeyInput(e.target.value)}
                      placeholder={p.placeholder}
                      type="password"
                      className="w-48 h-8 text-xs"
                      onKeyDown={(e) => e.key === "Enter" && handleSaveKey(p.id)}
                    />
                    <Button
                      size="sm"
                      className="h-8"
                      onClick={() => handleSaveKey(p.id)}
                      disabled={saving || !keyInput.trim()}
                    >
                      Save
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8"
                      onClick={() => { setEditingProvider(null); setKeyInput(""); }}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : connected ? (
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="bg-green-600 text-xs">Connected</Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground"
                      onClick={() => setEditingProvider(p.id)}
                    >
                      Update
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => setEditingProvider(p.id)}
                  >
                    Add Key
                  </Button>
                )}
              </div>
            );
          })}

          {/* Spotify */}
          <div className="flex items-center gap-3 p-3 rounded-lg border">
            <div className="w-7 h-7 rounded bg-[#1DB954] flex items-center justify-center shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
              </svg>
            </div>
            <span className="text-sm font-medium flex-1">Spotify</span>
            {editingProvider === "spotify" ? (
              <div className="flex items-center gap-2">
                <Input
                  value={spotifyClientId}
                  onChange={(e) => setSpotifyClientId(e.target.value)}
                  placeholder="Client ID"
                  className="w-36 h-8 text-xs"
                />
                <Input
                  value={spotifyClientSecret}
                  onChange={(e) => setSpotifyClientSecret(e.target.value)}
                  placeholder="Client Secret"
                  type="password"
                  className="w-36 h-8 text-xs"
                />
                <Button
                  size="sm"
                  className="h-8"
                  onClick={async () => {
                    if (!spotifyClientId.trim() || !spotifyClientSecret.trim()) return;
                    setSaving(true);
                    try {
                      const res = await fetch("/api/settings/api-keys", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ provider: "spotify", clientId: spotifyClientId.trim(), clientSecret: spotifyClientSecret.trim() }),
                      });
                      if (res.ok) {
                        setKeyStatus((prev) => ({ ...prev, spotify: true }));
                        setEditingProvider(null);
                        setSpotifyClientId("");
                        setSpotifyClientSecret("");
                        toast.success("Spotify connected");
                      }
                    } catch { toast.error("Failed"); }
                    finally { setSaving(false); }
                  }}
                  disabled={saving || !spotifyClientId.trim() || !spotifyClientSecret.trim()}
                >
                  Save
                </Button>
                <Button variant="ghost" size="sm" className="h-8" onClick={() => setEditingProvider(null)}>
                  Cancel
                </Button>
              </div>
            ) : keyStatus.spotify ? (
              <div className="flex items-center gap-2">
                <Badge variant="default" className="bg-green-600 text-xs">Connected</Badge>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => setEditingProvider("spotify")}>
                  Update
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" className="h-8" onClick={() => setEditingProvider("spotify")}>
                Add Keys
              </Button>
            )}
          </div>
          {/* Email IMAP */}
          <div className="flex items-center gap-3 p-3 rounded-lg border">
            <div className="w-7 h-7 rounded bg-blue-500 flex items-center justify-center shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
                <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
              </svg>
            </div>
            <span className="text-sm font-medium flex-1">Email (IMAP)</span>
            {editingEmail ? (
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <Input value={imapHost} onChange={(e) => setImapHost(e.target.value)} placeholder="imap.mail.me.com" className="w-36 h-8 text-xs" />
                  <Input value={imapPort} onChange={(e) => setImapPort(e.target.value)} placeholder="993" className="w-16 h-8 text-xs" />
                </div>
                <div className="flex gap-2">
                  <Input value={imapUser} onChange={(e) => setImapUser(e.target.value)} placeholder="you@email.com" className="w-36 h-8 text-xs" />
                  <Input value={imapPass} onChange={(e) => setImapPass(e.target.value)} placeholder="App password" type="password" className="w-36 h-8 text-xs" />
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="h-8"
                    disabled={emailConnecting || !imapHost || !imapUser || !imapPass}
                    onClick={async () => {
                      setEmailConnecting(true);
                      localStorage.setItem("pa-imap-config", JSON.stringify({ host: imapHost, port: imapPort, user: imapUser }));
                      try {
                        const res = await fetch("/api/email/start", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ host: imapHost, port: parseInt(imapPort) || 993, user: imapUser, pass: imapPass, secure: true }),
                        });
                        if (res.ok) {
                          setEmailMonitoring(true);
                          setEditingEmail(false);
                          toast.success("Email monitoring started");
                        } else {
                          const d = await res.json();
                          toast.error(d.error || "Failed");
                        }
                      } catch { toast.error("Failed to connect"); }
                      finally { setEmailConnecting(false); }
                    }}
                  >
                    {emailConnecting ? "Connecting..." : "Connect"}
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8" onClick={() => setEditingEmail(false)}>Cancel</Button>
                </div>
              </div>
            ) : emailMonitoring ? (
              <div className="flex items-center gap-2">
                <Badge variant="default" className="bg-green-600 text-xs">Connected</Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground"
                  onClick={async () => {
                    await fetch("/api/email/stop", { method: "POST" });
                    setEmailMonitoring(false);
                    toast.success("Email monitoring stopped");
                  }}
                >
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" className="h-8" onClick={() => setEditingEmail(true)}>
                Connect
              </Button>
            )}
          </div>
          {/* Dropbox */}
          <div className="flex items-center gap-3 p-3 rounded-lg border">
            <div className="w-7 h-7 rounded bg-[#0061FF] flex items-center justify-center shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                <path d="M6 2l6 3.75L18 2l6 3.75-6 3.75 6 3.75-6 3.75-6-3.75-6 3.75-6-3.75 6-3.75L0 5.75z"/>
              </svg>
            </div>
            <span className="text-sm font-medium flex-1">Dropbox Sync</span>
            {editingDropbox ? (
              <div className="flex items-center gap-2">
                <Input
                  value={dropboxPath}
                  onChange={(e) => setDropboxPath(e.target.value)}
                  placeholder="/Users/you/Dropbox/FolderName"
                  className="w-64 h-8 text-xs"
                />
                <Button
                  size="sm"
                  className="h-8"
                  disabled={dropboxSaving || !dropboxPath.trim()}
                  onClick={async () => {
                    setDropboxSaving(true);
                    try {
                      const res = await fetch("/api/settings/dropbox", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ folderPath: dropboxPath.trim() }),
                      });
                      const d = await res.json();
                      if (res.ok) {
                        setDropboxConnected(true);
                        setEditingDropbox(false);
                        toast.success("Dropbox folder set — New/Liked/Rejected created");
                      } else {
                        toast.error(d.error || "Failed");
                      }
                    } catch { toast.error("Failed"); }
                    finally { setDropboxSaving(false); }
                  }}
                >
                  {dropboxSaving ? "Saving..." : "Save"}
                </Button>
                <Button variant="ghost" size="sm" className="h-8" onClick={() => setEditingDropbox(false)}>Cancel</Button>
              </div>
            ) : dropboxConnected ? (
              <div className="flex items-center gap-2">
                <Badge variant="default" className="bg-green-600 text-xs">Connected</Badge>
                <span className="text-[10px] text-muted-foreground truncate max-w-32">{dropboxPath.split("/").pop()}</span>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => setEditingDropbox(true)}>
                  Change
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" className="h-8" onClick={() => setEditingDropbox(true)}>
                Set Folder
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* SoundFlow */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>SoundFlow</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3 p-3 rounded-lg border">
            <div className="w-7 h-7 rounded bg-purple-600 flex items-center justify-center shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium">User ID</span>
              {sfUserId && !editingSoundFlow && (
                <p className="text-[10px] text-muted-foreground font-mono truncate">{sfUserId}</p>
              )}
            </div>
            {editingSoundFlow ? (
              <div className="flex items-center gap-2">
                <Input
                  value={sfUserId}
                  onChange={(e) => setSfUserId(e.target.value)}
                  placeholder="SoundFlow User ID"
                  className="w-64 h-8 text-xs font-mono"
                />
                <Button
                  size="sm"
                  className="h-8"
                  disabled={sfSaving || !sfUserId.trim()}
                  onClick={async () => {
                    setSfSaving(true);
                    try {
                      const res = await fetch("/api/soundflow/user-id", {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ userId: sfUserId.trim() }),
                      });
                      const d = await res.json();
                      if (res.ok) {
                        setEditingSoundFlow(false);
                        toast.success(`SoundFlow User ID saved — ${d.changed} commands updated`);
                      } else {
                        toast.error(d.error || "Failed");
                      }
                    } catch { toast.error("Failed"); }
                    finally { setSfSaving(false); }
                  }}
                >
                  {sfSaving ? "Saving..." : "Save"}
                </Button>
                <Button variant="ghost" size="sm" className="h-8" onClick={() => setEditingSoundFlow(false)}>
                  Cancel
                </Button>
              </div>
            ) : sfUserId ? (
              <div className="flex items-center gap-2">
                <Badge variant="default" className="bg-green-600 text-xs">Connected</Badge>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => setEditingSoundFlow(true)}>
                  Change
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" className="h-8" onClick={() => setEditingSoundFlow(true)}>
                Set ID
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg border">
            <div className="w-7 h-7 rounded bg-purple-600/50 flex items-center justify-center shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
                <path d="M18 14h-8" /><path d="M15 18h-5" /><path d="M10 6h8v4h-8V6Z" />
              </svg>
            </div>
            <span className="text-sm font-medium flex-1">Commands Library</span>
            <Badge variant="outline" className="text-xs">{sfCommandCount} commands</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Theme */}
      <Card>
        <CardHeader>
          <CardTitle>Theme</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            {[
              { id: "default" as const, name: "Default", color: "#888" },
              { id: "blue-wave" as const, name: "Blue Wave", color: "#4d9fff" },
              { id: "green-wave" as const, name: "Green Wave", color: "#22c55e" },
              { id: "valheim" as const, name: "Valheim", color: "#00d4aa" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${
                  theme === t.id
                    ? "border-foreground bg-muted"
                    : "border-border hover:border-foreground/30"
                }`}
              >
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: t.color }}
                />
                <span className="text-sm font-medium">{t.name}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
