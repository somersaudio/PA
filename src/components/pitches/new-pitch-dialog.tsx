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
import { Textarea } from "@/components/ui/textarea";
import { createPitch } from "@/actions/pitches";
import { toast } from "sonner";

export function NewPitchDialog() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    try {
      await createPitch({
        songTitle: form.get("songTitle") as string,
        recipientName: form.get("recipientName") as string,
        recipientEmail: (form.get("recipientEmail") as string) || undefined,
        recipientCompany: (form.get("recipientCompany") as string) || undefined,
        notes: (form.get("notes") as string) || undefined,
      });
      toast.success("Pitch created");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Failed to create pitch");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        New Pitch
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Pitch</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Song Title</label>
            <Input name="songTitle" required placeholder="e.g. Midnight Drive" />
          </div>
          <div>
            <label className="text-sm font-medium">Recipient Name</label>
            <Input
              name="recipientName"
              required
              placeholder="e.g. A&R Name"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Email</label>
            <Input
              name="recipientEmail"
              type="email"
              placeholder="email@label.com"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Company / Label</label>
            <Input name="recipientCompany" placeholder="e.g. Atlantic Records" />
          </div>
          <div>
            <label className="text-sm font-medium">Notes</label>
            <Textarea name="notes" placeholder="Any context about this pitch..." />
          </div>
          <Button type="submit" className="w-full">
            Create Pitch
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
