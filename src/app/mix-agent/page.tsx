import { getMixNotes } from "@/actions/mix-notes";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MixNoteInput } from "@/components/mix-agent/mix-note-input";
import { AgentPanel } from "@/components/mix-agent/agent-panel";
import { SoundFlowCommands } from "@/components/mix-agent/soundflow-commands";

const statusColors: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "outline",
  parsed: "secondary",
  approved: "default",
  executing: "default",
  done: "secondary",
  failed: "destructive",
};

export default async function MixAgentPage() {
  const notes = await getMixNotes();

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Mix Agent</h1>

      {/* Agentic Pro Tools Control */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Pro Tools Agent
            <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-400/30">
              Vision + SoundFlow
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AgentPanel />
        </CardContent>
      </Card>

      {/* SoundFlow Commands */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            SoundFlow Commands
            <Badge variant="outline" className="text-[10px] text-blue-400 border-blue-400/30">
              Library
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SoundFlowCommands />
        </CardContent>
      </Card>

      {/* Quick Mix Notes */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Quick Mix Note</CardTitle>
        </CardHeader>
        <CardContent>
          <MixNoteInput />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Note Queue</CardTitle>
        </CardHeader>
        <CardContent>
          {notes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No mix notes yet. Add one above to get started.
            </p>
          ) : (
            <div className="space-y-2">
              {notes.map((note) => (
                <Link
                  key={note.id}
                  href={`/mix-agent/${note.id}`}
                  className="flex items-center justify-between p-4 rounded-md hover:bg-muted transition-colors border"
                >
                  <div className="flex-1 min-w-0 mr-4">
                    <p className="text-sm font-medium truncate">
                      {note.rawText}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(note.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <Badge variant={statusColors[note.status] || "outline"}>
                    {note.status}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
