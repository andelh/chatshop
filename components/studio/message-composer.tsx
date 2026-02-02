"use client";

import { useMutation } from "convex/react";
import { AlertCircle, Send } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";

interface MessageComposerProps {
  threadId: Id<"threads">;
  agentStatus?: string;
  onMessageSent?: () => void;
}

export function MessageComposer({
  threadId,
  agentStatus,
  onMessageSent,
}: MessageComposerProps) {
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const sendMessage = useMutation(api.messages.sendHumanAgentMessage);

  const isPaused = agentStatus === "paused" || agentStatus === "handoff";

  const handleSend = async () => {
    if (!message.trim()) return;

    setIsSending(true);
    try {
      await sendMessage({
        threadId,
        content: message.trim(),
      });
      setMessage("");
      onMessageSent?.();
    } catch (error) {
      console.error("Failed to send message:", error);
      alert("Failed to send message. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isPaused) {
    return null;
  }

  return (
    <div className="p-4 border-t border-border bg-card">
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your response as a human agent..."
            className={cn(
              "min-h-[80px] resize-none",
              agentStatus === "handoff" &&
                "border-orange-300 focus:border-orange-400",
            )}
            disabled={isSending}
          />
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <AlertCircle className="h-3 w-3" />
              <span>
                {agentStatus === "handoff"
                  ? "AI handoff - Human agent responding"
                  : "AI paused - Human agent responding"}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              Press Enter to send, Shift+Enter for new line
            </div>
          </div>
        </div>
        <Button
          onClick={handleSend}
          disabled={!message.trim() || isSending}
          className={cn(
            "shrink-0",
            agentStatus === "handoff"
              ? "bg-orange-600 hover:bg-orange-700"
              : "",
          )}
        >
          {isSending ? (
            <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
