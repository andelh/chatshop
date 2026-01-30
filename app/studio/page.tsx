"use client";

import { useQuery } from "convex/react";
import { ArrowRight, MessageSquare } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const DEMO_SHOP_ID = "j971661b007fktwgrkh3zxd3p9804eej" as Id<"shops">;

export default function StudioPage() {
  const router = useRouter();
  const threads = useQuery(api.threads.listByShop, {
    shopId: DEMO_SHOP_ID,
    status: "active",
  });

  // Redirect to the first thread if available
  useEffect(() => {
    if (threads && threads.length > 0) {
      router.push(`/studio/${threads[0]._id}`);
    }
  }, [threads, router]);

  if (threads === undefined) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse">
            <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          </div>
          <p className="text-muted-foreground">Loading conversations...</p>
        </div>
      </div>
    );
  }

  if (threads.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <MessageSquare className="h-16 w-16 text-muted-foreground mb-6" />
        <h1 className="text-2xl font-semibold mb-2">No Conversations</h1>
        <p className="text-muted-foreground max-w-md mb-8">
          There are no active conversations in your shop right now.
          Conversations will appear here when customers message your AI
          assistant.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
      <MessageSquare className="h-16 w-16 text-muted-foreground mb-6" />
      <h1 className="text-2xl font-semibold mb-2">Select a Conversation</h1>
      <p className="text-muted-foreground max-w-md mb-8">
        Choose a conversation from the sidebar to view the chat history between
        your customers and the AI assistant.
      </p>
      {threads[0] && (
        <Button onClick={() => router.push(`/studio/${threads[0]._id}`)}>
          View Latest Conversation
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
