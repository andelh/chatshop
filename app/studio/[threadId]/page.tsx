"use client";

import { useQuery } from "convex/react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { ConversationView } from "@/components/studio/conversation-view";
import { PlatformIcon } from "@/components/studio/platform-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export default function ThreadPage() {
  const params = useParams();
  const threadId = params?.threadId as string | undefined;

  // Validate threadId format
  if (!threadId || typeof threadId !== "string") {
    notFound();
  }

  return <ThreadPageClient threadId={threadId as Id<"threads">} />;
}

function ThreadPageClient({ threadId }: { threadId: Id<"threads"> }) {
  const thread = useQuery(api.threads.get, { threadId });

  if (thread === undefined) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground">Loading conversation...</p>
      </div>
    );
  }

  if (thread === null) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <h1 className="text-2xl font-semibold mb-2">Conversation Not Found</h1>
        <p className="text-muted-foreground mb-4">
          The conversation you&apos;re looking for doesn&apos;t exist or has
          been deleted.
        </p>
        <Link href="/studio">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Studio
          </Button>
        </Link>
      </div>
    );
  }

  const customerName = thread.customerName || "Unknown Customer";

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center gap-4 px-4 py-3 border-b border-border bg-card">
        <Link href="/studio" className="lg:hidden">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>

        <PlatformIcon platform={thread.platform} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="font-semibold truncate">{customerName}</h1>
            {thread.unreadCount > 0 && (
              <Badge variant="default">{thread.unreadCount} new</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Platform ID: {thread.platformUserId}
          </p>
        </div>

        <Badge variant="outline" className="capitalize shrink-0">
          {thread.status}
        </Badge>
      </header>

      {/* Conversation */}
      <ConversationView threadId={threadId} />
    </div>
  );
}
