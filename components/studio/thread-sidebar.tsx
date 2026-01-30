"use client";

import { useQuery } from "convex/react";
import { MessageSquare } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ThreadListItem } from "./thread-list-item";

interface ThreadSidebarProps {
  shopId: Id<"shops">;
  selectedThreadId?: Id<"threads">;
  onSelectThread: (threadId: Id<"threads">) => void;
}

export function ThreadSidebar({
  shopId,
  selectedThreadId,
  onSelectThread,
}: ThreadSidebarProps) {
  const data = useQuery(api.threads.listByShopWithStats, {
    shopId,
    status: "active",
  });

  if (data === undefined) {
    return (
      <div className="w-full h-full border-r border-border bg-muted/30">
        <div className="p-4 border-b border-border">
          <Skeleton className="h-6 w-32" />
        </div>
        <div className="p-4 space-y-4">
          <div className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (data.threads.length === 0) {
    return (
      <div className="w-full h-full border-r border-border bg-muted/30 flex flex-col">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold text-lg">Conversations</h2>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
          <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No active conversations</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full border-r border-border bg-muted/30 flex flex-col">
      <div className="p-4 border-b border-border">
        <h2 className="font-semibold text-lg">Conversations</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {data.threads.length} active thread
          {data.threads.length !== 1 ? "s" : ""}
        </p>
        {/* Aggregate Stats */}
        <div className="mt-3 pt-3 border-t border-border/50 space-y-1">
          <>
            <p className="text-xs text-muted-foreground">
              {data.totals.totalMessages.toLocaleString()} messages
            </p>
            <p className="text-xs text-muted-foreground">
              {data.totals.totalTokens.toLocaleString()} tokens
            </p>
            <p className="text-xs text-muted-foreground font-medium">
              ${data.totals.totalCostUsd.toFixed(2)} total cost
            </p>
          </>
        </div>
      </div>

      <Separator />

      <ScrollArea className="flex-1">
        <div role="listbox" aria-label="Conversation threads">
          {data.threads.map((thread) => (
            <ThreadListItem
              key={thread._id}
              thread={thread}
              isSelected={thread._id === selectedThreadId}
              onClick={() => onSelectThread(thread._id)}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
