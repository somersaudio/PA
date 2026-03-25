"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { addSessionNote } from "@/actions/sessions";
import { toast } from "sonner";

export function QuickNote({ sessionId }: { sessionId: number }) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setLoading(true);
    try {
      await addSessionNote(sessionId, content.trim());
      setContent("");
      toast.success("Note added");
      router.refresh();
    } catch {
      toast.error("Failed to add note");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Quick note... (e.g., 'Artist wants more reverb on chorus vocals')"
        rows={2}
      />
      <Button type="submit" size="sm" disabled={loading || !content.trim()}>
        {loading ? "Adding..." : "Add Note"}
      </Button>
    </form>
  );
}
