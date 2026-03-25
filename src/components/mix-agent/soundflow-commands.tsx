"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type SFCommand = {
  id: string;
  name: string;
  description: string;
};

export function SoundFlowCommands() {
  const [commands, setCommands] = useState<SFCommand[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newId, setNewId] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [testing, setTesting] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetch("/api/soundflow/commands")
      .then((r) => r.json())
      .then((d) => { setCommands(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return commands;
    const q = search.toLowerCase();
    return commands.filter(
      (c) => c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)
    );
  }, [commands, search]);

  // Group by category (derive from name patterns)
  const grouped = useMemo(() => {
    const groups: Record<string, SFCommand[]> = {};
    for (const cmd of filtered) {
      // Try to derive category from common patterns
      const name = cmd.name;
      let category = "Other";
      if (/play|stop|record|rewind|fast forward|return to zero|go to end|transport/i.test(name)) category = "Transport";
      else if (/fader|volume|set fader|db/i.test(name)) category = "Faders";
      else if (/mute|solo/i.test(name)) category = "Mute / Solo";
      else if (/audiosuite|plugin/i.test(name)) category = "Plugins";
      else if (/zoom|scroll|view/i.test(name)) category = "Navigation";
      else if (/edit|cut|copy|paste|duplicate|undo|redo|trim|fade|consolidat/i.test(name)) category = "Editing";
      else if (/track|new track|delete track|rename|color/i.test(name)) category = "Tracks";
      else if (/send|bus|aux|route/i.test(name)) category = "Routing";
      else if (/marker|memory|location/i.test(name)) category = "Markers";
      else if (/bounce|export|import/i.test(name)) category = "Bounce / Export";
      else if (/select|selection/i.test(name)) category = "Selection";
      else if (/automation/i.test(name)) category = "Automation";
      else if (/window|show|hide|close|open/i.test(name)) category = "Windows";
      else if (/pan/i.test(name)) category = "Pan";
      if (!groups[category]) groups[category] = [];
      groups[category].push(cmd);
    }
    // Sort categories
    const order = ["Transport", "Faders", "Mute / Solo", "Pan", "Editing", "Selection", "Tracks", "Plugins", "Routing", "Navigation", "Markers", "Automation", "Bounce / Export", "Windows", "Other"];
    const sorted: [string, SFCommand[]][] = [];
    for (const cat of order) {
      if (groups[cat]) sorted.push([cat, groups[cat]]);
    }
    for (const [cat, cmds] of Object.entries(groups)) {
      if (!order.includes(cat)) sorted.push([cat, cmds]);
    }
    return sorted;
  }, [filtered]);

  async function handleAdd() {
    if (!newName.trim() || !newId.trim()) return;
    try {
      const res = await fetch("/api/soundflow/commands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: newId, name: newName, description: newDesc }),
      });
      if (res.ok) {
        const cmd = await res.json();
        setCommands((prev) => [...prev, cmd]);
        setNewName(""); setNewId(""); setNewDesc("");
        setAdding(false);
        toast.success(`Added: ${cmd.name}`);
      }
    } catch { toast.error("Failed to add command"); }
  }

  async function handleDelete(idx: number) {
    // Find real index in full list
    const cmd = filtered[idx];
    const realIdx = commands.indexOf(cmd);
    if (realIdx < 0) return;
    try {
      const res = await fetch("/api/soundflow/commands", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ index: realIdx }),
      });
      if (res.ok) {
        setCommands((prev) => prev.filter((_, i) => i !== realIdx));
        toast.success(`Deleted: ${cmd.name}`);
      }
    } catch { toast.error("Failed to delete"); }
  }

  async function handleTest(cmd: SFCommand, idx: number) {
    setTesting(idx);
    try {
      const res = await fetch("/api/soundflow/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commandId: cmd.id }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(`${cmd.name}: ${data.result}`);
      } else {
        toast.error(`${cmd.name}: ${data.error}`);
      }
    } catch { toast.error("Failed to run"); }
    finally { setTesting(null); }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading commands...</p>;
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search commands..."
          className="h-8 text-xs flex-1"
        />
        <Badge variant="outline" className="text-[10px] shrink-0">
          {filtered.length} / {commands.length}
        </Badge>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Collapse" : "Expand"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          onClick={() => setAdding(!adding)}
        >
          {adding ? "Cancel" : "+ Add"}
        </Button>
      </div>

      {/* Add form */}
      {adding && (
        <div className="p-3 rounded-lg border bg-muted/30 space-y-2">
          <div className="flex gap-2">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Command Name" className="h-8 text-xs" />
            <Input value={newId} onChange={(e) => setNewId(e.target.value)} placeholder="SoundFlow Command ID" className="h-8 text-xs flex-1" />
          </div>
          <div className="flex gap-2">
            <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Description (optional)" className="h-8 text-xs flex-1" />
            <Button size="sm" className="h-8" onClick={handleAdd} disabled={!newName.trim() || !newId.trim()}>Add</Button>
          </div>
        </div>
      )}

      {/* Commands list */}
      <div className={`space-y-3 ${expanded ? "" : "max-h-80"} overflow-y-auto`}>
        {grouped.map(([category, cmds]) => (
          <div key={category}>
            <div className="sticky top-0 bg-background/95 backdrop-blur-sm z-10 py-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {category}
              </span>
              <Badge variant="outline" className="text-[9px] ml-1.5 px-1 py-0">
                {cmds.length}
              </Badge>
            </div>
            <div className="space-y-1 mt-1">
              {cmds.map((cmd) => {
                const globalIdx = filtered.indexOf(cmd);
                return (
                  <div
                    key={cmd.id + globalIdx}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 transition-colors group text-xs"
                  >
                    <span className="font-medium min-w-0 truncate flex-1">{cmd.name}</span>
                    <span className="text-muted-foreground truncate max-w-64 hidden group-hover:inline">
                      {cmd.description.slice(0, 80)}
                    </span>
                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[10px]"
                        onClick={() => handleTest(cmd, globalIdx)}
                        disabled={testing === globalIdx}
                      >
                        {testing === globalIdx ? "..." : "Test"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[10px] text-destructive hover:text-destructive"
                        onClick={() => handleDelete(globalIdx)}
                      >
                        Del
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
