"use client";

import { memo } from "react";
import type { Doc } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Now";
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d`;
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

const platformConfig = {
  instagram: { label: "Instagram", color: "#E1306C", bg: "#FEF0F5" },
  messenger: { label: "Messenger", color: "#0099FF", bg: "#EFF7FF" },
  whatsapp: { label: "WhatsApp", color: "#25D366", bg: "#F0FBF4" },
} as const;

function PlatformPill({ platform }: { platform: string }) {
  const config =
    platformConfig[platform.toLowerCase() as keyof typeof platformConfig] ??
    platformConfig.messenger;
  return (
    <span
      className="inline-flex items-center text-[11px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap"
      style={{ color: config.color, backgroundColor: config.bg }}
    >
      {config.label}
    </span>
  );
}

interface ThreadItemProps {
  thread: Doc<"threads">;
  isSelected?: boolean;
  onClick?: () => void;
}

export const ThreadItem = memo(function ThreadItem({
  thread,
  isSelected,
  onClick,
}: ThreadItemProps) {
  const displayName = thread.customerName || "Unknown Customer";
  const hasUnread = thread.unreadCount > 0;
  const agentStatus = thread.agentStatus ?? "active";
  const isPaused = agentStatus === "paused";
  const isHandoff = agentStatus === "handoff";
  const isPendingHuman = agentStatus === "pending_human";

  const previewText = () => {
    if (hasUnread)
      return `${thread.unreadCount} new message${thread.unreadCount > 1 ? "s" : ""}`;
    if (isHandoff) return "Handoff requested";
    if (isPaused || isPendingHuman) return "AI paused · Human responding";
    return "View conversation";
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left px-5 py-4 flex flex-col gap-1.5 transition-colors",
        "border-l-2 border-transparent focus:outline-none",
        "hover:bg-[#F7F7F5]",
        isSelected && "bg-[#F5F5F3] border-l-[#1A1A1A]",
        !isSelected && isPaused && "bg-amber-50/40",
        !isSelected && isHandoff && "bg-red-50/30",
      )}
      aria-selected={isSelected}
    >
      {/* Row 1: Name + time */}
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "text-[15px] truncate leading-snug",
            hasUnread || isSelected
              ? "font-bold text-[#1A1A1A]"
              : "font-semibold text-[#1A1A1A]",
          )}
        >
          {displayName}
        </span>
        <span className="text-[12px] text-[#AAA] whitespace-nowrap shrink-0">
          {formatRelativeTime(thread.lastMessageAt)}
        </span>
      </div>

      {/* Row 2: Preview */}
      <span
        className={cn(
          "text-[13px] truncate",
          hasUnread
            ? "font-semibold text-[#1A1A1A]"
            : "font-medium text-[#666]",
        )}
      >
        {previewText()}
      </span>

      {/* Row 3: Platform + status */}
      <div className="flex items-center gap-2 mt-0.5">
        <PlatformPill platform={thread.platform} />
        {isHandoff && (
          <span className="text-[11px] text-red-500 font-medium">· Handoff</span>
        )}
        {isPaused && (
          <span className="text-[11px] text-amber-600 font-medium">· AI paused</span>
        )}
      </div>
    </button>
  );
});
