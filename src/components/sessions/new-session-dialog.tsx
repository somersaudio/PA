"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createSession } from "@/actions/sessions";
import { toast } from "sonner";

export function NewSessionDialog() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    try {
      await createSession({
        projectName: form.get("projectName") as string,
        artistName: (form.get("artistName") as string) || undefined,
        date: form.get("date") as string,
        status: "scheduled",
      });
      toast.success("Session created");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Failed to create session");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        New Session
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Session</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Project Name</label>
            <Input name="projectName" required placeholder="e.g. Summer EP Mix" />
          </div>
          <div>
            <label className="text-sm font-medium">Artist</label>
            <Input name="artistName" placeholder="e.g. Artist Name" />
          </div>
          <div>
            <label className="text-sm font-medium">Date</label>
            <Input
              name="date"
              type="date"
              required
              defaultValue={new Date().toISOString().split("T")[0]}
            />
          </div>
          <Button type="submit" className="w-full">
            Create Session
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
