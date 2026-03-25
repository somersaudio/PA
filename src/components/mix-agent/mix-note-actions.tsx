"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { approveMixNote, updateMixNoteStatus, deleteMixNote } from "@/actions/mix-notes";
import { toast } from "sonner";
import type { MixNote } from "@/db/schema";

export function MixNoteActions({ note }: { note: MixNote }) {
  const [loading, setLoading] = useState<string | null>(null);
  const router = useRouter();

  async function handleApprove() {
    setLoading("approve");
    try {
      await approveMixNote(note.id);
      toast.success("Mix note approved");
      router.refresh();
    } catch {
      toast.error("Failed to approve");
    } finally {
      setLoading(null);
    }
  }

  async function handleExecute() {
    setLoading("execute");
    try {
      const res = await fetch("/api/mix-agent/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId: note.id }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success("Executed in SoundFlow");
      } else {
        toast.error(result.error || "Execution failed");
      }
      router.refresh();
    } catch {
      toast.error("Failed to execute");
    } finally {
      setLoading(null);
    }
  }

  async function handleCopy() {
    if (note.soundflowScript) {
      await navigator.clipboard.writeText(note.soundflowScript);
      toast.success("Script copied to clipboard");
    }
  }

  async function handleReparse() {
    setLoading("reparse");
    try {
      const res = await fetch("/api/mix-agent/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText: note.rawText }),
      });
      if (res.ok) {
        const parsed = await res.json();
        const { updateMixNoteParsed } = await import("@/actions/mix-notes");
        await updateMixNoteParsed(note.id, parsed.commands, parsed.soundflowScript);
        toast.success("Re-parsed successfully");
        router.refresh();
      } else {
        toast.error("Parsing failed");
      }
    } catch {
      toast.error("Failed to re-parse");
    } finally {
      setLoading(null);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this mix note?")) return;
    await deleteMixNote(note.id);
    toast.success("Deleted");
    router.push("/mix-agent");
  }

  return (
    <div className="space-y-3">
      {note.status === "parsed" && (
        <Button
          onClick={handleApprove}
          disabled={loading !== null}
          className="w-full"
        >
          {loading === "approve" ? "Approving..." : "Approve Commands"}
        </Button>
      )}

      {note.status === "approved" && (
        <Button
          onClick={handleExecute}
          disabled={loading !== null}
          className="w-full"
        >
          {loading === "execute" ? "Executing..." : "Execute in SoundFlow"}
        </Button>
      )}

      {note.soundflowScript && (
        <Button variant="secondary" onClick={handleCopy} className="w-full">
          Copy Script to Clipboard
        </Button>
      )}

      {(note.status === "pending" || note.status === "parsed" || note.status === "failed") && (
        <Button
          variant="outline"
          onClick={handleReparse}
          disabled={loading !== null}
          className="w-full"
        >
          {loading === "reparse" ? "Parsing..." : "Re-parse with Claude"}
        </Button>
      )}

      {note.status === "done" && (
        <p className="text-sm text-green-600 font-medium text-center">
          Successfully executed
        </p>
      )}

      <Button
        variant="ghost"
        onClick={handleDelete}
        className="w-full text-destructive"
      >
        Delete Note
      </Button>
    </div>
  );
}
