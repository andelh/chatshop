"use client";

import { Pause, UserCircle } from "lucide-react";
import { memo } from "react";
import { Badge } from "@/components/ui/badge";
import type { Doc } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { PlatformIcon } from "./platform-icon";

interface ThreadListItemProps {
  thread: Doc<"threads">;
  isSelected?: boolean;
  onClick?: () => void;
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export const ThreadListItem = memo(function ThreadListItem({
  thread,
  isSelected = false,
  onClick,
}: ThreadListItemProps) {
  const displayName = thread.customerName || "Unknown Customer";
  const hasUnread = thread.unreadCount > 0;
  const agentStatus = thread.agentStatus ?? "active";

  const getStatusBadge = () => {
    switch (agentStatus) {
      case "paused":
        return (
          <Badge variant="secondary" className="text-xs shrink-0">
            <Pause className="h-3 w-3 mr-1" />
            Paused
          </Badge>
        );
      case "handoff":
        return (
          <Badge variant="destructive" className="text-xs shrink-0">
            <UserCircle className="h-3 w-3 mr-1" />
            Handoff
          </Badge>
        );
      case "pending_human":
        return (
          <Badge variant="outline" className="text-xs shrink-0">
            <UserCircle className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left p-4 border-b border-border/50 transition-colors",
        "hover:bg-accent/50 focus:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isSelected && "bg-accent border-l-4 border-l-primary border-l-solid",
        agentStatus === "paused" && "bg-yellow-50/50",
        agentStatus === "handoff" && "bg-red-50/50",
      )}
      aria-selected={isSelected}
      role="option"
    >
      <div className="flex items-start gap-3">
        <PlatformIcon platform={thread.platform} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3
              className={cn(
                "font-medium text-sm truncate",
                hasUnread && "font-semibold",
              )}
            >
              {displayName}
            </h3>
            <div className="flex items-center gap-1">
              {getStatusBadge()}
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {formatRelativeTime(thread.lastMessageAt)}
              </span>
            </div>
          </div>

          <p
            className={cn(
              "text-sm text-muted-foreground truncate mt-1",
              hasUnread && "text-foreground font-medium",
            )}
          >
            {hasUnread ? "New messages" : "View conversation"}
          </p>

          {hasUnread && (
            <Badge variant="default" className="mt-2 text-xs">
              {thread.unreadCount} new
            </Badge>
          )}
        </div>
      </div>
    </button>
  );
});
