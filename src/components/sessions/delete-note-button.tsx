"use client";

import { useRouter } from "next/navigation";
import { deleteSessionNote } from "@/actions/sessions";

export function DeleteNoteButton({ noteId }: { noteId: number }) {
  const router = useRouter();

  async function handleDelete() {
    await deleteSessionNote(noteId);
    router.refresh();
  }

  return (
    <button
      onClick={handleDelete}
      className="text-muted-foreground/40 hover:text-destructive transition-colors"
      title="Delete note"
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 6 6 18" /><path d="m6 6 12 12" />
      </svg>
    </button>
  );
}
