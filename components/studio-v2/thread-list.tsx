"use client";

import { useQuery } from "convex/react";
import { Search } from "lucide-react";
import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { ThreadItem } from "./thread-item";

const FILTER_TABS = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "paused", label: "Paused" },
] as const;

type FilterTab = (typeof FILTER_TABS)[number]["id"];

interface ThreadListProps {
  shopId: Id<"shops">;
  selectedThreadId?: Id<"threads">;
  onSelectThread: (threadId: Id<"threads">) => void;
}

export function ThreadList({
  shopId,
  selectedThreadId,
  onSelectThread,
}: ThreadListProps) {
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const data = useQuery(api.threads.listByShopWithStats, {
    shopId,
    status: "active",
  });

  const threads = data?.threads ?? [];

  const filteredThreads = threads.filter((t) => {
    if (activeFilter === "unread") return t.unreadCount > 0;
    if (activeFilter === "paused")
      return t.agentStatus === "paused" || t.agentStatus === "handoff";
    return true;
  });

  return (
    <div className="flex flex-col h-full">
      {/* Filter tabs + search */}
      <div className="flex items-center gap-1 px-4 pt-5 pb-3 shrink-0">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveFilter(tab.id)}
            className={cn(
              "px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors whitespace-nowrap",
              activeFilter === tab.id
                ? "bg-[#1A1A1A] text-white"
                : "text-[#888] hover:bg-[#F0F0EE] hover:text-[#1A1A1A]",
            )}
          >
            {tab.label}
          </button>
        ))}
        <button
          type="button"
          className="ml-auto p-1.5 rounded-lg text-[#BBB] hover:text-[#555] transition-colors"
          aria-label="Search conversations"
        >
          <Search className="h-[15px] w-[15px]" />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-hidden">
        {data === undefined ? (
          <ThreadListSkeleton />
        ) : filteredThreads.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <p className="text-sm text-[#999]">
              {activeFilter === "all"
                ? "No active conversations"
                : `No ${activeFilter} conversations`}
            </p>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div>
              {filteredThreads.map((thread, i) => (
                <div key={thread._id}>
                  <ThreadItem
                    thread={thread}
                    isSelected={thread._id === selectedThreadId}
                    onClick={() => onSelectThread(thread._id)}
                  />
                  {i < filteredThreads.length - 1 && (
                    <div className="h-px bg-[#F0EFED]" />
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}

function ThreadListSkeleton() {
  return (
    <div className="px-5 pt-4 space-y-6">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-28 rounded" />
            <Skeleton className="h-3 w-8 rounded" />
          </div>
          <Skeleton className="h-3 w-44 rounded" />
          <Skeleton className="h-4 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}
