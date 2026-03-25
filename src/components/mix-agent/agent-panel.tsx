"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type AgentStep = {
  type: "think" | "command" | "vision" | "result" | "error" | "done";
  content: string;
  timestamp: number;
};

type AgentMode = "supervised" | "semi-autonomous" | "autonomous";

const modeLabels: Record<AgentMode, string> = {
  supervised: "Supervised",
  "semi-autonomous": "Semi-Auto",
  autonomous: "Full Auto",
};

const modeColors: Record<AgentMode, string> = {
  supervised: "text-blue-400",
  "semi-autonomous": "text-amber-400",
  autonomous: "text-emerald-400",
};

const stepIcons: Record<string, string> = {
  think: "🧠",
  command: "⚡",
  vision: "👁",
  result: "✅",
  error: "❌",
};

export function AgentPanel() {
  const [instruction, setInstruction] = useState("");
  const [mode, setMode] = useState<AgentMode>("supervised");
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [steps]);

  // Also scroll on any re-render while running
  useEffect(() => {
    if (running && scrollRef.current) {
      const id = setInterval(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
      }, 200);
      return () => clearInterval(id);
    }
  }, [running]);

  async function handleRun() {
    if (!instruction.trim() || running) return;
    setRunning(true);
    setSteps([]);
    setSummary(null);

    try {
      const res = await fetch("/api/mix-agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction: instruction.trim(), mode }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Agent failed");
        setSteps([{ type: "error", content: data.error || "Failed", timestamp: Date.now() }]);
        setRunning(false);
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const step = JSON.parse(line.slice(6)) as AgentStep & { type: string };
              if (step.type === "done") {
                setSummary(step.content);
                toast.success("Agent completed");
              } else if (step.type === "error") {
                setSteps((prev) => [...prev, step]);
                toast.error(step.content);
              } else {
                setSteps((prev) => [...prev, step]);
              }
            } catch {}
          }
        }
      }
    } catch {
      toast.error("Failed to reach agent");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Instruction input */}
      <div className="space-y-3">
        <Textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder='e.g. "Make the vocal sit better in the mix" or "Turn Lead Vox up 2dB and add more reverb"'
          rows={3}
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.metaKey) {
              e.preventDefault();
              handleRun();
            }
          }}
          disabled={running}
        />
        <div className="flex items-center gap-3">
          <Button onClick={handleRun} disabled={running || !instruction.trim()}>
            {running ? (
              <span className="flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" className="animate-spin" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                Agent Working...
              </span>
            ) : (
              "Run Agent"
            )}
          </Button>

          {/* Mode selector */}
          <div className="flex items-center gap-1.5">
            {(["supervised", "semi-autonomous", "autonomous"] as AgentMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                  mode === m
                    ? `${modeColors[m]} bg-muted`
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {modeLabels[m]}
              </button>
            ))}
          </div>

          <span className="text-[10px] text-muted-foreground ml-auto">
            {mode === "supervised" && "Reviews each step before executing"}
            {mode === "semi-autonomous" && "Executes batches, you verify results"}
            {mode === "autonomous" && "Full control — executes and verifies on its own"}
          </span>
        </div>
      </div>

      {/* Agent log */}
      {steps.length > 0 && (
        <div
          ref={scrollRef}
          className="rounded-lg border bg-background/50 max-h-96 overflow-y-auto"
        >
          <div className="p-3 space-y-2">
            {steps.map((step, i) => (
              <div
                key={i}
                className={`flex items-start gap-2 text-xs ${
                  step.type === "error" ? "text-red-400" : "text-foreground/80"
                }`}
              >
                <span className="shrink-0 mt-0.5">{stepIcons[step.type] || "•"}</span>
                <div className="min-w-0">
                  <Badge
                    variant="outline"
                    className="text-[9px] px-1 py-0 mr-1.5 align-middle"
                  >
                    {step.type}
                  </Badge>
                  <span className="break-words whitespace-pre-wrap">{step.content}</span>
                </div>
              </div>
            ))}
            {running && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="h-3 w-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                Agent is working...
              </div>
            )}
          </div>
        </div>
      )}

      {/* Summary */}
      {summary && !running && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <span className="text-xs font-medium text-emerald-400">Agent Summary</span>
          <p className="text-sm mt-1 whitespace-pre-wrap">{summary}</p>
        </div>
      )}
    </div>
  );
}
