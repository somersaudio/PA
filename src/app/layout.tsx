import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import { Sidebar } from "@/components/layout/sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { CommentDrawer } from "@/components/playlist/comment-panel";
import { ChatPanel } from "@/components/chat-panel";
import { ApiStatus } from "@/components/layout/api-status";
import "./globals.css";

export const metadata: Metadata = {
  title: "PA — Producer's Assistant",
  description: "AI-powered Pro Tools control, session management, and music production toolkit",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased dark"
      style={{ fontFamily: "Helvetica Neue, Helvetica, Arial, sans-serif" }}
    >
      <body className="h-full flex">
        <ThemeProvider>
          <Sidebar />
          <main className="flex-1 overflow-auto">
            <div className="p-8">{children}</div>
          </main>
          <ApiStatus />
          <CommentDrawer />
          <ChatPanel />
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
