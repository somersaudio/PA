import { getMixNote } from "@/actions/mix-notes";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MixNoteActions } from "@/components/mix-agent/mix-note-actions";
import Link from "next/link";
import type { ParsedCommand } from "@/db/schema";

const statusColors: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "outline",
  parsed: "secondary",
  approved: "default",
  executing: "default",
  done: "secondary",
  failed: "destructive",
};

export default async function MixNoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const note = await getMixNote(Number(id));
  if (!note) notFound();

  const commands = (note.parsedCommands || []) as ParsedCommand[];

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/mix-agent"
          className="text-sm text-muted-foreground hover:underline"
        >
          Mix Agent
        </Link>
        <div className="flex items-center gap-3 mt-1">
          <h1 className="text-3xl font-bold">Mix Note #{note.id}</h1>
          <Badge variant={statusColors[note.status] || "outline"}>
            {note.status}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Original Note</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{note.rawText}</p>
              <p className="text-xs text-muted-foreground mt-2">
                {new Date(note.createdAt).toLocaleString()}
              </p>
            </CardContent>
          </Card>

          {commands.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Parsed Commands</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {commands.map((cmd, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-md border bg-muted/50"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline">{cmd.action}</Badge>
                        <span className="text-sm font-medium">
                          {cmd.trackName}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {cmd.description}
                      </p>
                      <p className="text-xs font-mono mt-1">
                        {cmd.parameter}: {cmd.value}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {note.errorMessage && (
            <Card className="border-destructive">
              <CardHeader>
                <CardTitle className="text-destructive">Error</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{note.errorMessage}</p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {note.soundflowScript && (
            <Card>
              <CardHeader>
                <CardTitle>SoundFlow Script</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-muted p-4 rounded-md overflow-x-auto max-h-96">
                  <code>{note.soundflowScript}</code>
                </pre>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <MixNoteActions note={note} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
