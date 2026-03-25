"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addPitchActivity } from "@/actions/pitches";
import { toast } from "sonner";

export function PitchActivityForm({ pitchId }: { pitchId: number }) {
  const [type, setType] = useState<string>("note");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setLoading(true);
    try {
      await addPitchActivity(
        pitchId,
        type as "sent" | "follow-up" | "response" | "note",
        content.trim()
      );
      setContent("");
      toast.success("Activity logged");
      router.refresh();
    } catch {
      toast.error("Failed to log activity");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Select value={type} onValueChange={(v) => v && setType(v)}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="sent">Sent</SelectItem>
          <SelectItem value="follow-up">Follow-up</SelectItem>
          <SelectItem value="response">Response</SelectItem>
          <SelectItem value="note">Note</SelectItem>
        </SelectContent>
      </Select>
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="What happened?"
        rows={2}
      />
      <Button type="submit" size="sm" disabled={loading || !content.trim()}>
        {loading ? "Logging..." : "Log Activity"}
      </Button>
    </form>
  );
}
