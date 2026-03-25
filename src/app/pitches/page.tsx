import { getPitches, getStalePitches } from "@/actions/pitches";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NewPitchDialog } from "@/components/pitches/new-pitch-dialog";

const statusColors: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  new: "outline",
  pitched: "default",
  "follow-up": "secondary",
  "closed-won": "default",
  "closed-lost": "destructive",
};

const pipelineStages = ["new", "pitched", "follow-up", "closed-won", "closed-lost"] as const;

export default async function PitchesPage() {
  const allPitches = await getPitches();
  const stalePitches = await getStalePitches(7);

  const grouped = pipelineStages.reduce(
    (acc, stage) => {
      acc[stage] = allPitches.filter((p) => p.status === stage);
      return acc;
    },
    {} as Record<string, typeof allPitches>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Pitch Pipeline</h1>
        <NewPitchDialog />
      </div>

      {stalePitches.length > 0 && (
        <Card className="mb-6 border-destructive/50 bg-destructive/5">
          <CardContent className="py-4">
            <p className="text-sm font-medium text-destructive">
              {stalePitches.length} stale lead{stalePitches.length > 1 ? "s" : ""} — no activity in 7+ days
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              {stalePitches.map((p) => (
                <Link key={p.id} href={`/pitches/${p.id}`}>
                  <Badge variant="destructive" className="cursor-pointer">
                    {p.songTitle} → {p.recipientName}
                  </Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {pipelineStages.map((stage) => (
          <Card key={stage}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium capitalize flex items-center justify-between">
                {stage}
                <Badge variant="outline" className="ml-2">
                  {grouped[stage]?.length || 0}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(grouped[stage] || []).map((pitch) => (
                  <Link key={pitch.id} href={`/pitches/${pitch.id}`}>
                    <div className="p-3 rounded-md border hover:bg-muted transition-colors cursor-pointer">
                      <p className="text-sm font-medium truncate">
                        {pitch.songTitle}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        → {pitch.recipientName}
                      </p>
                      {pitch.recipientCompany && (
                        <p className="text-xs text-muted-foreground truncate">
                          {pitch.recipientCompany}
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
                {(!grouped[stage] || grouped[stage].length === 0) && (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    Empty
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
