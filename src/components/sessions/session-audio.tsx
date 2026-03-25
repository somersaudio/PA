"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WaveformPlayer } from "@/components/playlist/waveform-player";

type AudioFile = {
  path: string;
  filename: string;
  fromEmail: string | null;
  addedAt: string;
};

type Contact = {
  name: string;
  email: string;
};

export function SessionAudio({ fileReferences }: { fileReferences: string[] }) {
  const [contacts, setContacts] = useState<Record<string, Contact>>({});
  const [validRefs, setValidRefs] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/email/contacts")
      .then((r) => r.json())
      .then((d) => setContacts(d.contacts || {}))
      .catch(() => {});

    // Validate which files still exist
    fetch("/api/sessions/audio-files", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileReferences }),
    })
      .then((r) => r.json())
      .then((d) => setValidRefs(d.files || []))
      .catch(() => setValidRefs(fileReferences || []));
  }, [fileReferences]);

  const audioFiles: AudioFile[] = validRefs
    .map((ref) => {
      try {
        return JSON.parse(ref);
      } catch {
        return null;
      }
    })
    .filter((f): f is AudioFile => f !== null && f.path);

  const audioOnly = audioFiles.filter((f) =>
    /\.(mp3|wav|aiff?|flac|ogg|m4a|mp4)$/i.test(f.filename)
  );

  if (audioOnly.length === 0) return null;

  function getContactName(email: string): string {
    const contact = contacts[email];
    if (contact?.name && contact.name !== email) return contact.name;
    return email;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Audio Files
          <span className="text-xs text-muted-foreground font-normal">
            {audioOnly.length} track{audioOnly.length !== 1 ? "s" : ""}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {audioOnly.map((file, i) => (
          <div key={i}>
            <WaveformPlayer
              src={`/api/email/attachment?path=${encodeURIComponent(file.path)}`}
              title={file.filename.replace(/\.[^.]+$/, "")}
              played={true}
            />
            {file.fromEmail && (
              <p className="text-[9px] text-muted-foreground mt-0.5 px-1">
                from {getContactName(file.fromEmail)} — {new Date(file.addedAt).toLocaleDateString()}
              </p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
