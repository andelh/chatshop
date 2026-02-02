"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { formatDistanceToNow } from "date-fns";
import { Bot, MessageSquare, RefreshCw, User } from "lucide-react";
import { useState } from "react";
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
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { MessageComposer } from "./message-composer";

interface ConversationViewProps {
  threadId: Id<"threads">;
  thread?: Doc<"threads">;
}

interface MessageItemProps {
  messageId: Id<"messages">;
  threadId: Id<"threads">;
  content: string;
  role: "user" | "assistant" | "human_agent";
  timestamp: number;
  toolCalls?: any[];
  reasoning?: string;
  aiMetadata?: {
    model: string;
    totalTokens: number;
    reasoningTokens: number;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
  };
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
        state={hasError ? "output-error" : "output-available"}
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
  messageId,
  threadId,
  content,
  role,
  timestamp,
  toolCalls,
  reasoning,
  aiMetadata,
}: MessageItemProps) {
  const isUser = role === "user";
  const isHumanAgent = role === "human_agent";
  const isAssistant = role === "assistant";
  const parsedReasoning = parseReasoning(reasoning);
  const [isRetrying, setIsRetrying] = useState(false);
  const retryMessage = useAction(api.messages.retryAIResponse);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await retryMessage({
        threadId,
        messageId,
      });
    } catch (error) {
      console.error("Failed to retry message:", error);
      alert("Failed to retry message. Please try again.");
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div
      className={cn(
        "group flex gap-3 py-4 px-4",
        isUser ? "flex-row" : "flex-row",
      )}
    >
      <Avatar
        className={cn(
          "h-8 w-8 shrink-0",
          isUser ? "bg-primary" : isHumanAgent ? "bg-green-600" : "bg-muted",
        )}
      >
        <AvatarFallback
          className={
            isUser
              ? "bg-primary text-primary-foreground"
              : isHumanAgent
                ? "bg-green-600 text-white"
                : "bg-muted"
          }
        >
          {isUser ? (
            <User className="h-4 w-4" />
          ) : isHumanAgent ? (
            <User className="h-4 w-4" />
          ) : (
            <Bot className="h-4 w-4" />
          )}
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
            {isUser ? "Customer" : isHumanAgent ? "Human Agent" : "Maya AI"}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(timestamp, { addSuffix: true })}
          </span>

          {/* Retry button for AI messages - always visible on mobile */}
          {isAssistant && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-100 md:opacity-0 md:group-hover:opacity-100 hover:bg-muted active:bg-muted/80 transition-all"
                  disabled={isRetrying}
                >
                  {isRetrying ? (
                    <div className="h-3 w-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={handleRetry}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry response
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
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
            "rounded-lg px-4 py-2 text-sm group",
            isUser
              ? "bg-primary text-primary-foreground ml-auto max-w-[80%]"
              : isHumanAgent
                ? "bg-green-100 text-green-900 max-w-[80%] border border-green-300"
                : "bg-muted max-w-[80%]",
          )}
        >
          <p className="whitespace-pre-wrap">{content}</p>
        </div>

        {/* AI Metadata - only show for AI assistant, not human agent */}
        {!isUser && !isHumanAgent && aiMetadata && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
            <span className="bg-muted px-2 py-0.5 rounded">
              {aiMetadata.model}
            </span>
            <span>{aiMetadata.totalTokens.toLocaleString()} tokens</span>
            {aiMetadata.reasoningTokens > 0 && (
              <span>
                {aiMetadata.reasoningTokens.toLocaleString()} reasoning
              </span>
            )}
            <span>${aiMetadata.costUsd.toFixed(4)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function ConversationView({ threadId, thread }: ConversationViewProps) {
  const messages = useQuery(api.messages.listByThread, {
    threadId,
    limit: 100,
  });

  const agentStatus = thread?.agentStatus ?? "active";
  const isPausedOrHandoff =
    agentStatus === "paused" || agentStatus === "handoff";

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
          <div className="divide-y divide-border/50 pb-6">
            {messages.map((message) => (
              <MessageItem
                key={message._id}
                messageId={message._id}
                threadId={threadId}
                content={message.content}
                role={message.role}
                timestamp={message.timestamp}
                toolCalls={message.toolCalls}
                reasoning={message.reasoning}
                aiMetadata={message.aiMetadata}
              />
            ))}
          </div>
        </ScrollArea>
      </div>

      {isPausedOrHandoff && (
        <MessageComposer
          threadId={threadId}
          agentStatus={agentStatus}
          onMessageSent={() => {
            // Messages will refresh automatically via Convex
          }}
        />
      )}

      <div className="p-4 border-t border-border bg-muted/30">
        <p className="text-xs text-center text-muted-foreground">
          {agentStatus === "active" && `AI Active • Read-only monitoring mode`}
          {agentStatus === "paused" && `AI Paused • Human agent responding`}
          {agentStatus === "handoff" && `AI Handoff • Human agent responding`}
          {agentStatus === "pending_human" &&
            `Pending Human • Awaiting response`}
          {!agentStatus && `Read-only monitoring mode`}
          {" • "}
          {messages.length} message{messages.length !== 1 ? "s" : ""}
        </p>
      </div>
    </div>
  );
}
