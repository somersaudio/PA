"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { createMixNote } from "@/actions/mix-notes";
import { toast } from "sonner";

export function MixNoteInput() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setLoading(true);
    try {
      const note = await createMixNote(text.trim());

      // Trigger Claude parsing
      const res = await fetch("/api/mix-agent/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText: text.trim() }),
      });

      if (res.ok) {
        const parsed = await res.json();
        // Update the note with parsed data via server action
        const { updateMixNoteParsed } = await import("@/actions/mix-notes");
        await updateMixNoteParsed(
          note.id,
          parsed.commands,
          parsed.soundflowScript
        );
        toast.success("Mix note parsed successfully");
      } else {
        toast.error("Note saved but parsing failed. You can retry from the detail view.");
      }

      setText("");
      router.refresh();
    } catch {
      toast.error("Failed to create mix note");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder='e.g. "Turn the vocal up 2dB on Lead Vox" or "Add more reverb to the BGVs"'
        rows={3}
      />
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={loading || !text.trim()}>
          {loading ? "Parsing with Claude..." : "Submit & Parse"}
        </Button>
        <span className="text-xs text-muted-foreground">
          Claude will translate your note into SoundFlow commands
        </span>
      </div>
    </form>
  );
}
