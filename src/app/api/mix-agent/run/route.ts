import { NextRequest } from "next/server";
import { runMixAgent, AgentMode, AgentStep } from "@/lib/protools-agent";

export async function POST(req: NextRequest) {
  try {
    const { instruction, mode } = await req.json();
    if (!instruction) {
      return new Response(JSON.stringify({ error: "instruction required" }), { status: 400 });
    }

    const agentMode: AgentMode = mode || "supervised";
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const send = (step: AgentStep) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(step)}\n\n`));
        };

        try {
          const { summary } = await runMixAgent(instruction, agentMode, send);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done", content: summary, timestamp: Date.now() })}\n\n`));
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : "Agent failed";
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", content: message, timestamp: Date.now() })}\n\n`));
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Agent failed";
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
