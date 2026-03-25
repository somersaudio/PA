"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { getPendingChat, clearPendingChat, subscribePendingChat } from "@/lib/chat-inject";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true); // open by default
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = useCallback(async (text: string, existingMessages: Message[] = []) => {
    const userMsg: Message = { role: "user", content: text };
    const newMessages = [...existingMessages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    setOpen(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });
      const data = await res.json();
      if (res.ok && data.reply) {
        setMessages([...newMessages, { role: "assistant", content: data.reply }]);
        router.refresh();
      } else {
        toast.error(data.error || "Chat failed");
      }
    } catch {
      toast.error("Failed to reach assistant");
    } finally {
      setLoading(false);
    }
  }, [router]);

  // Listen for injected messages from other components (e.g. inbox Execute button)
  useEffect(() => {
    function check() {
      const pending = getPendingChat();
      if (pending && !loading) {
        clearPendingChat();
        sendMessage(pending.userMessage, messages);
      }
    }
    check();
    return subscribePendingChat(check);
  });

  async function handleSend() {
    if (!input.trim() || loading) return;
    sendMessage(input.trim(), messages);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-8 shrink-0 bg-primary/10 hover:bg-primary/20 border-l flex items-center justify-center transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
          <path d="m15 18-6-6 6-6" />
        </svg>
      </button>
    );
  }

  return (
    <aside className="w-80 shrink-0 border-l bg-card/90 h-full flex flex-col backdrop-blur-sm">
      {/* Header */}
      <div className="px-3 pt-2 pb-2 border-b space-y-1.5">
        <div className="flex items-center justify-end" id="api-status-slot" />
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold">Assistant</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0"
            onClick={() => setOpen(false)}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length > 0 && (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-1 text-[10px] text-muted-foreground"
              onClick={() => setMessages([])}
            >
              Clear
            </Button>
          </div>
        )}
        {messages.length === 0 && (
          <div className="text-center text-xs text-muted-foreground py-8 space-y-2">
            <p className="font-medium">Producer&apos;s Assistant</p>
            <p>I can read your emails, manage sessions, create pitches, control Pro Tools, generate Suno prompts, and run commands on your Mac.</p>
            <p>Try: &quot;What emails came in today?&quot;</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`text-xs leading-relaxed ${
              msg.role === "user"
                ? "bg-primary/10 text-foreground p-2 rounded-lg ml-8"
                : "text-foreground/90 p-2"
            }`}
          >
            {msg.role === "assistant" ? (
              <div className="prose prose-xs prose-invert max-w-none [&_h1]:text-sm [&_h1]:font-bold [&_h1]:mb-1 [&_h2]:text-xs [&_h2]:font-bold [&_h2]:mb-1 [&_h3]:text-xs [&_h3]:font-bold [&_h3]:mb-1 [&_p]:text-xs [&_p]:mb-1.5 [&_ul]:text-xs [&_ul]:mb-1.5 [&_ol]:text-xs [&_ol]:mb-1.5 [&_li]:mb-0.5 [&_table]:text-[10px] [&_th]:px-2 [&_th]:py-1 [&_td]:px-2 [&_td]:py-1 [&_hr]:my-2 [&_blockquote]:text-xs [&_blockquote]:border-l-2 [&_blockquote]:border-blue-400/30 [&_blockquote]:pl-2 [&_blockquote]:italic [&_strong]:text-foreground [&_code]:text-[10px] [&_code]:bg-muted [&_code]:px-1 [&_code]:rounded">
                <ReactMarkdown rehypePlugins={[rehypeRaw]}>{msg.content}</ReactMarkdown>
              </div>
            ) : (
              <div className="whitespace-pre-wrap">{msg.content}</div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 p-2 text-xs text-muted-foreground">
            <div className="h-3 w-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            Thinking...
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t p-2">
        <div className="flex gap-1.5">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything..."
            rows={1}
            className="text-xs min-h-[32px] resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={loading}
          />
          <Button
            size="sm"
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="shrink-0 h-8 px-3"
          >
            Send
          </Button>
        </div>
      </div>
    </aside>
  );
}
