"use client";

import { useMutation, useQuery } from "convex/react";
import {
  Instagram,
  MessageCircle,
  Pause,
  Phone,
  Play,
  UserCircle,
} from "lucide-react";
import { notFound, useParams, useRouter } from "next/navigation";
import { ConversationView } from "@/components/studio/conversation-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";

const platformConfig = {
  instagram: {
    label: "Instagram",
    icon: Instagram,
    color: "#E1306C",
    bg: "#FEF0F5",
  },
  messenger: {
    label: "Messenger",
    icon: MessageCircle,
    color: "#0099FF",
    bg: "#EFF7FF",
  },
  whatsapp: {
    label: "WhatsApp",
    icon: Phone,
    color: "#25D366",
    bg: "#F0FBF4",
  },
} as const;

function PlatformBadge({ platform }: { platform: string }) {
  const config =
    platformConfig[platform.toLowerCase() as keyof typeof platformConfig] ??
    platformConfig.messenger;
  const Icon = config.icon;
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full"
      style={{ color: config.color, backgroundColor: config.bg }}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}

function CustomerAvatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const colors = [
    { bg: "#F0ECF8", text: "#7C55C8" },
    { bg: "#EFF7FF", text: "#0099FF" },
    { bg: "#FEF0F5", text: "#E1306C" },
    { bg: "#F0FBF4", text: "#25D366" },
    { bg: "#FFF7ED", text: "#EA7C1E" },
  ];
  const color = colors[name.charCodeAt(0) % colors.length];

  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
      style={{ backgroundColor: color.bg }}
    >
      <span
        className="text-[11px] font-bold leading-none"
        style={{ color: color.text }}
      >
        {initials}
      </span>
    </div>
  );
}

export default function StudioV2ThreadPage() {
  const params = useParams();
  const threadId = params?.threadId as string | undefined;

  if (!threadId || typeof threadId !== "string") {
    notFound();
  }

  return <ThreadPageClient threadId={threadId as Id<"threads">} />;
}

function ThreadPageClient({ threadId }: { threadId: Id<"threads"> }) {
  const thread = useQuery(api.threads.get, { threadId });
  const pauseThread = useMutation(api.threads.pauseThread);
  const resumeThread = useMutation(api.threads.resumeThread);
  const updateStatus = useMutation(api.threads.updateStatus);
  const router = useRouter();

  if (thread === undefined) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-[#1A1A1A] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[#888]">Loading conversation...</p>
        </div>
      </div>
    );
  }

  if (thread === null) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full text-center p-8">
        <h1 className="text-xl font-semibold mb-2 text-[#1A1A1A]">
          Conversation not found
        </h1>
        <p className="text-sm text-[#888] mb-6">
          This conversation may have been deleted or moved.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push("/studio-v2")}
        >
          Back to inbox
        </Button>
      </div>
    );
  }

  const customerName = thread.customerName || "Unknown Customer";
  const agentStatus = thread.agentStatus ?? "active";
  const isPaused = agentStatus === "paused" || agentStatus === "handoff";
  const isResolved = thread.status === "resolved";

  const handlePause = async () => {
    try {
      await pauseThread({
        threadId,
        reason: "Manually paused by human agent",
      });
    } catch (error) {
      console.error("Failed to pause thread:", error);
    }
  };

  const handleResume = async () => {
    try {
      await resumeThread({ threadId });
    } catch (error) {
      console.error("Failed to resume thread:", error);
    }
  };

  const handleResolve = async () => {
    try {
      await updateStatus({ threadId, status: "resolved" });
      router.push(
        `/studio-v2?${new URLSearchParams(window.location.search).toString()}`,
      );
    } catch (error) {
      console.error("Failed to resolve thread:", error);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Thread top bar */}
      <header className="flex items-center justify-between px-6 h-14 border-b border-[#EDECEA] shrink-0 gap-4">
        {/* Left: customer info */}
        <div className="flex items-center gap-3 min-w-0">
          <CustomerAvatar name={customerName} />
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[14px] font-semibold text-[#1A1A1A] truncate">
              {customerName}
            </span>
            {thread.unreadCount > 0 && (
              <span className="text-[11px] font-bold bg-[#1A1A1A] text-white px-1.5 py-0.5 rounded-full shrink-0">
                {thread.unreadCount}
              </span>
            )}
          </div>
          <PlatformBadge platform={thread.platform} />

          {/* Agent status pill */}
          {agentStatus !== "active" && (
            <span
              className={cn(
                "text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0",
                agentStatus === "paused" &&
                  "bg-amber-50 text-amber-700 border border-amber-200",
                agentStatus === "handoff" &&
                  "bg-red-50 text-red-600 border border-red-200",
                agentStatus === "pending_human" &&
                  "bg-blue-50 text-blue-600 border border-blue-200",
              )}
            >
              {agentStatus === "paused" && "AI paused"}
              {agentStatus === "handoff" && "Handoff"}
              {agentStatus === "pending_human" && "Pending human"}
            </span>
          )}
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2 shrink-0">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={isPaused ? handleResume : handlePause}
                  className="h-8 px-3 text-[12px] border-[#E8E8E6] text-[#555] hover:text-[#1A1A1A] hover:border-[#1A1A1A]"
                >
                  {isPaused ? (
                    <>
                      <Play className="h-3 w-3 mr-1.5" />
                      Resume AI
                    </>
                  ) : (
                    <>
                      <Pause className="h-3 w-3 mr-1.5" />
                      Pause AI
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {isPaused
                  ? "Resume AI responses for this conversation"
                  : "Pause AI and take over manually"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Button
            size="sm"
            onClick={handleResolve}
            disabled={isResolved}
            className="h-8 px-3 text-[12px] bg-[#1A1A1A] hover:bg-[#333] text-white"
          >
            {isResolved ? "Resolved" : "Resolve"}
          </Button>
        </div>
      </header>

      {/* Conversation */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <ConversationView threadId={threadId} thread={thread} />
      </div>
    </div>
  );
}
