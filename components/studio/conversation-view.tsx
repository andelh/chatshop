"use client";

import { useQuery } from "convex/react";
import { formatDistanceToNow } from "date-fns";
import { Bot, MessageSquare, User } from "lucide-react";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";

interface ConversationViewProps {
  threadId: Id<"threads">;
}

interface MessageItemProps {
  content: string;
  role: "user" | "assistant";
  timestamp: number;
  toolCalls?: any[];
  reasoning?: string;
}

function ToolCallDisplay({ tool }: { tool: any }) {
  const toolName = tool.toolName || tool.name || "unknown";
  const toolArgs = tool.args || tool.input || {};
  const toolResult = tool.result || tool.output;
  const hasError = tool.error || tool.state === "output-error";

  return (
    <Tool className="mt-2">
      <ToolHeader
        title={toolName}
        type={`tool-call-${toolName}`}
        state={
          hasError
            ? "output-error"
            : toolResult
              ? "output-available"
              : "input-available"
        }
      />
      <ToolContent>
        <ToolInput input={toolArgs} />
        {toolResult && (
          <ToolOutput
            output={toolResult}
            errorText={hasError ? tool.error : undefined}
          />
        )}
      </ToolContent>
    </Tool>
  );
}

function parseReasoning(reasoning: string | undefined): string | null {
  if (!reasoning) return null;

  try {
    const parsed = JSON.parse(reasoning);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((item) => item.type === "reasoning" && item.text)
        .map((item) => item.text)
        .join("\n\n");
    }
    return reasoning;
  } catch {
    return reasoning;
  }
}

function MessageItem({
  content,
  role,
  timestamp,
  toolCalls,
  reasoning,
}: MessageItemProps) {
  const isUser = role === "user";
  const parsedReasoning = parseReasoning(reasoning);

  return (
    <div
      className={cn("flex gap-3 py-4 px-4", isUser ? "flex-row" : "flex-row")}
    >
      <Avatar
        className={cn("h-8 w-8 shrink-0", isUser ? "bg-primary" : "bg-muted")}
      >
        <AvatarFallback
          className={isUser ? "bg-primary text-primary-foreground" : "bg-muted"}
        >
          {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>

      <div
        className={cn(
          "flex-1 space-y-2 min-w-0",
          isUser ? "items-end" : "items-start",
        )}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {isUser ? "Customer" : "Maya AI"}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(timestamp, { addSuffix: true })}
          </span>
        </div>

        {/* Tool Calls - show before the message */}
        {!isUser && toolCalls && toolCalls.length > 0 && (
          <div className="w-full max-w-[90%]">
            {toolCalls.map((tool) => (
              <ToolCallDisplay
                key={tool.toolCallId || tool.name || tool.toolName}
                tool={tool}
              />
            ))}
          </div>
        )}

        {/* Reasoning/Thinking */}
        {!isUser && parsedReasoning && (
          <Reasoning className="w-full max-w-[90%]">
            <ReasoningTrigger />
            <ReasoningContent>{parsedReasoning}</ReasoningContent>
          </Reasoning>
        )}

        {/* Message Content */}
        <div
          className={cn(
            "rounded-lg px-4 py-2 text-sm",
            isUser
              ? "bg-primary text-primary-foreground ml-auto max-w-[80%]"
              : "bg-muted max-w-[80%]",
          )}
        >
          <p className="whitespace-pre-wrap">{content}</p>
        </div>
      </div>
    </div>
  );
}

export function ConversationView({ threadId }: ConversationViewProps) {
  const messages = useQuery(api.messages.listByThread, {
    threadId,
    limit: 100,
  });

  if (messages === undefined) {
    return (
      <div className="flex-1 flex flex-col h-full">
        <div className="p-4 border-b border-border">
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="flex-1 p-4 space-y-4">
          <div className="flex gap-3 flex-row">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-16 w-[70%]" />
            </div>
          </div>
          <div className="flex gap-3 flex-row-reverse">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-24 ml-auto" />
              <Skeleton className="h-16 w-[70%] ml-auto" />
            </div>
          </div>
          <div className="flex gap-3 flex-row">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-16 w-[70%]" />
            </div>
          </div>
          <div className="flex gap-3 flex-row-reverse">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-24 ml-auto" />
              <Skeleton className="h-16 w-[70%] ml-auto" />
            </div>
          </div>
          <div className="flex gap-3 flex-row">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-16 w-[70%]" />
            </div>
          </div>
          <div className="flex gap-3 flex-row-reverse">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-24 ml-auto" />
              <Skeleton className="h-16 w-[70%] ml-auto" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col h-full items-center justify-center p-8 text-center">
        <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">No messages yet</h3>
        <p className="text-sm text-muted-foreground mt-2">
          This conversation hasn&apos;t started yet.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="divide-y divide-border/50">
            {messages.map((message) => (
              <MessageItem
                key={message._id}
                content={message.content}
                role={message.role}
                timestamp={message.timestamp}
                toolCalls={message.toolCalls}
                reasoning={message.reasoning}
              />
            ))}
          </div>
        </ScrollArea>
      </div>

      <div className="p-4 border-t border-border bg-muted/30">
        <p className="text-xs text-center text-muted-foreground">
          Read-only monitoring mode • {messages.length} message
          {messages.length !== 1 ? "s" : ""}
        </p>
      </div>
    </div>
  );
}
