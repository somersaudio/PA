"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const steps = [
  { id: "welcome", title: "Welcome to CTPA" },
  { id: "claude", title: "AI Provider" },
  { id: "spotify", title: "Spotify" },
  { id: "email", title: "Email" },
  { id: "dropbox", title: "Dropbox" },
  { id: "chrome", title: "Chrome Setup" },
  { id: "done", title: "Ready!" },
];

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Claude
  const [claudeKey, setClaudeKey] = useState("");

  // Spotify
  const [spotifyId, setSpotifyId] = useState("");
  const [spotifySecret, setSpotifySecret] = useState("");

  // Email
  const [imapHost, setImapHost] = useState("imap.mail.me.com");
  const [imapPort, setImapPort] = useState("993");
  const [imapUser, setImapUser] = useState("");
  const [imapPass, setImapPass] = useState("");

  // Dropbox
  const [dropboxPath, setDropboxPath] = useState("");

  async function saveKey(provider: string, key: string) {
    await fetch("/api/settings/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, key }),
    });
  }

  async function saveSpotify() {
    await fetch("/api/settings/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "spotify", clientId: spotifyId, clientSecret: spotifySecret }),
    });
  }

  async function saveEmail() {
    await fetch("/api/email/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ host: imapHost, port: parseInt(imapPort), user: imapUser, pass: imapPass, secure: true }),
    });
  }

  async function saveDropbox() {
    await fetch("/api/settings/dropbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderPath: dropboxPath }),
    });
  }

  async function handleNext() {
    setSaving(true);
    try {
      const current = steps[step].id;
      if (current === "claude" && claudeKey.trim()) {
        await saveKey("anthropic", claudeKey.trim());
        toast.success("Claude connected");
      }
      if (current === "spotify" && spotifyId.trim() && spotifySecret.trim()) {
        await saveSpotify();
        toast.success("Spotify connected");
      }
      if (current === "email" && imapUser.trim() && imapPass.trim()) {
        await saveEmail();
        toast.success("Email connected");
      }
      if (current === "dropbox" && dropboxPath.trim()) {
        await saveDropbox();
        toast.success("Dropbox connected");
      }
    } catch {}
    setSaving(false);

    if (step === steps.length - 1) {
      // Mark setup complete
      localStorage.setItem("pa-setup-complete", "true");
      router.push("/sessions");
    } else {
      setStep(step + 1);
    }
  }

  const current = steps[step].id;

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <Card className="w-full max-w-lg">
        <CardContent className="p-8 space-y-6">
          {/* Progress */}
          <div className="flex gap-1">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-muted"}`}
              />
            ))}
          </div>

          {/* Welcome */}
          {current === "welcome" && (
            <div className="text-center space-y-4">
              <h1 className="text-2xl font-bold">Welcome to CTPA</h1>
              <p className="text-sm text-muted-foreground">
                Central Tools for Producer Administration
              </p>
              <p className="text-sm text-muted-foreground">
                Let&apos;s get you set up. This takes about 2 minutes.
                You can skip any step and set it up later in Settings.
              </p>
            </div>
          )}

          {/* Claude API */}
          {current === "claude" && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Image src="/claude-logo.png" alt="Claude" width={32} height={32} className="rounded" />
                <div>
                  <h2 className="text-lg font-bold">Claude API Key</h2>
                  <p className="text-xs text-muted-foreground">Powers the AI assistant, email analysis, and Suno prompts</p>
                </div>
              </div>
              <Input
                value={claudeKey}
                onChange={(e) => setClaudeKey(e.target.value)}
                placeholder="sk-ant-api03-..."
                type="password"
                className="text-sm"
              />
              <p className="text-[10px] text-muted-foreground">
                Get one at console.anthropic.com → API Keys
              </p>
            </div>
          )}

          {/* Spotify */}
          {current === "spotify" && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-[#1DB954] flex items-center justify-center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold">Spotify</h2>
                  <p className="text-xs text-muted-foreground">For playlist parsing and artist photos</p>
                </div>
              </div>
              <Input
                value={spotifyId}
                onChange={(e) => setSpotifyId(e.target.value)}
                placeholder="Client ID"
                className="text-sm"
              />
              <Input
                value={spotifySecret}
                onChange={(e) => setSpotifySecret(e.target.value)}
                placeholder="Client Secret"
                type="password"
                className="text-sm"
              />
              <p className="text-[10px] text-muted-foreground">
                Create a free app at developer.spotify.com/dashboard. Use http://127.0.0.1:3000/callback as redirect URI.
              </p>
            </div>
          )}

          {/* Email */}
          {current === "email" && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-blue-500 flex items-center justify-center">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
                    <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold">Email</h2>
                  <p className="text-xs text-muted-foreground">AI-powered inbox for work emails</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input value={imapHost} onChange={(e) => setImapHost(e.target.value)} placeholder="imap.mail.me.com" className="text-sm" />
                <Input value={imapPort} onChange={(e) => setImapPort(e.target.value)} placeholder="993" className="text-sm" />
              </div>
              <Input value={imapUser} onChange={(e) => setImapUser(e.target.value)} placeholder="you@email.com" className="text-sm" />
              <Input value={imapPass} onChange={(e) => setImapPass(e.target.value)} placeholder="App password" type="password" className="text-sm" />
              <p className="text-[10px] text-muted-foreground">
                For iCloud: use an App-Specific Password from appleid.apple.com. For Gmail: use an App Password from myaccount.google.com/apppasswords.
              </p>
            </div>
          )}

          {/* Dropbox */}
          {current === "dropbox" && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-[#0061FF] flex items-center justify-center">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                    <path d="M6 2l6 3.75L18 2l6 3.75-6 3.75 6 3.75-6 3.75-6-3.75-6 3.75-6-3.75 6-3.75L0 5.75z"/>
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold">Dropbox Sync</h2>
                  <p className="text-xs text-muted-foreground">Share songs with collaborators via Dropbox</p>
                </div>
              </div>
              <Input
                value={dropboxPath}
                onChange={(e) => setDropboxPath(e.target.value)}
                placeholder="/Users/you/Dropbox/SharedFolder"
                className="text-sm"
              />
              <p className="text-[10px] text-muted-foreground">
                Paste the full path to your shared Dropbox folder. Creates New/Liked/Rejected subfolders automatically.
              </p>
            </div>
          )}

          {/* Chrome */}
          {current === "chrome" && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-yellow-500 flex items-center justify-center text-lg">
                  ⚡
                </div>
                <div>
                  <h2 className="text-lg font-bold">Chrome Setup</h2>
                  <p className="text-xs text-muted-foreground">Required for Suno automation</p>
                </div>
              </div>
              <div className="space-y-3 text-sm">
                <div className="p-3 rounded bg-muted">
                  <p className="font-medium mb-1">1. Open Google Chrome</p>
                  <p className="text-xs text-muted-foreground">Make sure Chrome is installed on this Mac</p>
                </div>
                <div className="p-3 rounded bg-muted">
                  <p className="font-medium mb-1">2. Enable JavaScript from Apple Events</p>
                  <p className="text-xs text-muted-foreground">
                    Go to: <span className="font-mono text-foreground">View → Developer → Allow JavaScript from Apple Events</span>
                  </p>
                </div>
                <div className="p-3 rounded bg-muted">
                  <p className="font-medium mb-1">3. Log into Suno</p>
                  <p className="text-xs text-muted-foreground">
                    Go to <span className="font-mono text-foreground">suno.com</span> and sign in. The app will automate song generation through Chrome.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Done */}
          {current === "done" && (
            <div className="text-center space-y-4">
              <div className="text-4xl">🎛️</div>
              <h2 className="text-2xl font-bold">You&apos;re all set!</h2>
              <p className="text-sm text-muted-foreground">
                CTPA is ready. You can always change these settings later.
                Your AI assistant is on the right — ask it anything.
              </p>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between pt-2">
            {step > 0 ? (
              <Button variant="ghost" size="sm" onClick={() => setStep(step - 1)}>
                Back
              </Button>
            ) : (
              <div />
            )}
            <div className="flex items-center gap-2">
              {current !== "welcome" && current !== "done" && (
                <Button variant="ghost" size="sm" onClick={() => setStep(step + 1)}>
                  Skip
                </Button>
              )}
              <Button onClick={handleNext} disabled={saving}>
                {saving ? "Saving..." : current === "done" ? "Let's Go" : current === "welcome" ? "Get Started" : "Next"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
