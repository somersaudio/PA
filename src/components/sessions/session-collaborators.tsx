"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArtistAvatar } from "./artist-avatar";
import { toast } from "sonner";

type Collaborator = {
  name: string;
  role: string;
};

const roles = ["artist", "writer", "engineer", "producer", "vocalist", "musician", "mixer", "other"];

export function SessionCollaborators({ sessionId }: { sessionId: number }) {
  const [collabs, setCollabs] = useState<Collaborator[]>([]);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("artist");
  const router = useRouter();
  const [contacts, setContacts] = useState<Array<{ name: string; email: string; relationship: string }>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    fetch(`/api/sessions/collaborators?sessionId=${sessionId}`)
      .then((r) => r.json())
      .then((d) => setCollabs(d.collaborators || []))
      .catch(() => {});
    fetch("/api/email/contacts")
      .then((r) => r.json())
      .then((d) => {
        const list = Object.values(d.contacts || {}) as Array<{ name: string; email: string; relationship: string }>;
        setContacts(list);
      })
      .catch(() => {});
  }, [sessionId]);

  async function handleAdd() {
    if (!newName.trim()) return;
    try {
      const res = await fetch("/api/sessions/collaborators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, name: newName.trim(), role: newRole }),
      });
      const data = await res.json();
      if (res.ok) {
        setCollabs(data.collaborators);
        setNewName("");
        setAdding(false);
        toast.success(`Added ${newName.trim()}`);
        router.refresh();
      }
    } catch {
      toast.error("Failed to add");
    }
  }

  async function handleRemove(name: string) {
    try {
      const res = await fetch("/api/sessions/collaborators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, name, action: "remove" }),
      });
      const data = await res.json();
      if (res.ok) {
        setCollabs(data.collaborators);
        router.refresh();
      }
    } catch {}
  }

  return (
    <div className="space-y-3">
      {/* Collaborator list */}
      {collabs.length > 0 && (
        <div className="space-y-2">
          {collabs.map((c) => (
            <div key={c.name} className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
              <ArtistAvatar name={c.name} size={32} />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium">{c.name}</span>
                <span className="text-[10px] text-muted-foreground ml-2 capitalize">{c.role}</span>
              </div>
              <button
                onClick={() => handleRemove(c.name)}
                className="text-muted-foreground/50 hover:text-destructive shrink-0"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      {adding ? (
        <div className="space-y-2">
          <div className="relative">
            <Input
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
                setShowSuggestions(e.target.value.length > 0);
              }}
              placeholder="Name..."
              className="h-8 text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
                if (e.key === "Escape") setShowSuggestions(false);
              }}
              onFocus={() => newName.length > 0 && setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            />
            {showSuggestions && (() => {
              const query = newName.toLowerCase();
              const matches = contacts.filter((c) =>
                c.name.toLowerCase().includes(query) &&
                !collabs.some((col) => col.name === c.name)
              ).slice(0, 6);
              if (matches.length === 0) return null;
              return (
                <div className="absolute left-0 right-0 top-9 z-50 bg-card border rounded-md shadow-lg py-1 max-h-40 overflow-y-auto">
                  {matches.map((c) => (
                    <button
                      key={c.email}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setNewName(c.name);
                        setShowSuggestions(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors flex items-center gap-2"
                    >
                      <ArtistAvatar name={c.name} size={20} />
                      <span className="font-medium">{c.name}</span>
                      <span className="text-muted-foreground capitalize">{c.relationship}</span>
                    </button>
                  ))}
                </div>
              );
            })()}
          </div>
          <div className="flex gap-1 flex-wrap">
            {roles.map((r) => (
              <button
                key={r}
                onClick={() => setNewRole(r)}
                className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors capitalize ${
                  newRole === r ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-foreground/30"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-xs" onClick={handleAdd} disabled={!newName.trim()}>
              Add
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setAdding(false); setNewName(""); }}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs w-full"
          onClick={() => setAdding(true)}
        >
          + Add Collaborator
        </Button>
      )}
    </div>
  );
}
