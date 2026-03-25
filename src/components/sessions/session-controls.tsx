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
import { updateSession, deleteSession } from "@/actions/sessions";
import { toast } from "sonner";
import type { Session } from "@/db/schema";

export function SessionControls({ session }: { session: Session }) {
  const router = useRouter();

  async function handleStatusChange(status: string) {
    await updateSession(session.id, {
      status: status as Session["status"],
    });
    toast.success(`Session marked as ${status}`);
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm("Delete this session and all its notes?")) return;
    await deleteSession(session.id);
    toast.success("Session deleted");
    router.push("/sessions");
  }

  return (
    <div className="flex items-center gap-2">
      <Select defaultValue={session.status} onValueChange={(v) => v && handleStatusChange(v)}>
        <SelectTrigger className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="scheduled">Scheduled</SelectItem>
          <SelectItem value="in-progress">In Progress</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
          <SelectItem value="archived">Archived</SelectItem>
        </SelectContent>
      </Select>
      <Button variant="destructive" size="sm" onClick={handleDelete}>
        Delete
      </Button>
    </div>
  );
}
