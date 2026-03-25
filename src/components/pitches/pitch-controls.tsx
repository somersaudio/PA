"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updatePitchStatus, deletePitch } from "@/actions/pitches";
import { toast } from "sonner";
import type { Pitch } from "@/db/schema";

export function PitchControls({ pitch }: { pitch: Pitch }) {
  const router = useRouter();

  async function handleStatusChange(status: string) {
    await updatePitchStatus(
      pitch.id,
      status as Pitch["status"]
    );
    toast.success(`Status updated to ${status}`);
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm("Delete this pitch and all activity?")) return;
    await deletePitch(pitch.id);
    toast.success("Pitch deleted");
    router.push("/pitches");
  }

  return (
    <div className="space-y-3">
      <Select defaultValue={pitch.status} onValueChange={(v) => v && handleStatusChange(v)}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="new">New</SelectItem>
          <SelectItem value="pitched">Pitched</SelectItem>
          <SelectItem value="follow-up">Follow-up</SelectItem>
          <SelectItem value="closed-won">Closed Won</SelectItem>
          <SelectItem value="closed-lost">Closed Lost</SelectItem>
        </SelectContent>
      </Select>
      <Button
        variant="ghost"
        onClick={handleDelete}
        className="w-full text-destructive"
      >
        Delete Pitch
      </Button>
    </div>
  );
}
