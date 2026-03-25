"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { addPitchActivity } from "@/actions/pitches";
import { toast } from "sonner";

export function FollowUpSuggestion({ pitchId }: { pitchId: number }) {
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleGenerate() {
    setLoading(true);
    try {
      const res = await fetch("/api/pitches/suggest-followup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pitchId }),
      });
      if (res.ok) {
        const data = await res.json();
        setSuggestion(data.suggestion);
      } else {
        toast.error("Failed to generate suggestion");
      }
    } catch {
      toast.error("Failed to generate suggestion");
    } finally {
      setLoading(false);
    }
  }

  async function handleAccept() {
    if (!suggestion) return;
    await addPitchActivity(pitchId, "follow-up", suggestion);
    toast.success("Follow-up logged");
    setSuggestion(null);
    router.refresh();
  }

  if (suggestion) {
    return (
      <div className="space-y-3">
        <div className="p-4 rounded-md bg-muted text-sm whitespace-pre-wrap">
          {suggestion}
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={handleAccept}>
            Log as Follow-up
          </Button>
          <Button size="sm" variant="outline" onClick={handleGenerate}>
            Regenerate
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSuggestion(null)}
          >
            Dismiss
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Button onClick={handleGenerate} disabled={loading} variant="secondary">
      {loading ? "Generating..." : "Generate Follow-up with Claude"}
    </Button>
  );
}
