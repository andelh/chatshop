"use client";

import { useQuery } from "convex/react";
import { ArrowRight, MessageSquare } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";

export default function StudioPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shopIdParam = searchParams.get("shop");

  const userShops = useQuery(api.shopMembers.listUserShops);
  const currentShop =
    userShops?.find((s) => s._id === shopIdParam) ?? userShops?.[0];
  const currentShopId = currentShop?._id;

  const threads = useQuery(
    api.threads.listByShop,
    currentShopId ? { shopId: currentShopId, status: "active" } : "skip",
  );

  useEffect(() => {
    if (threads && threads.length > 0) {
      const url = new URL(window.location.href);
      url.pathname = `/studio/${threads[0]._id}`;
      router.push(url.pathname + "?" + url.searchParams.toString());
    }
  }, [threads, router]);

  if (userShops === undefined || threads === undefined) {
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

  if (!currentShopId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <MessageSquare className="h-16 w-16 text-muted-foreground mb-6" />
        <h1 className="text-2xl font-semibold mb-2">No Shop Access</h1>
        <p className="text-muted-foreground max-w-md">
          You don&apos;t have access to any shops yet. Please contact your shop
          administrator to get invited.
        </p>
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
          assistant or when you start a new chat from Studio.
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
        <Button
          onClick={() => {
            const url = new URL(window.location.href);
            url.pathname = `/studio/${threads[0]._id}`;
            router.push(url.pathname + "?" + url.searchParams.toString());
          }}
        >
          View Latest Conversation
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
