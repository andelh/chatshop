"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { MessageSquare, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ThreadListItem } from "./thread-list-item";

interface ThreadSidebarProps {
  shopId: Id<"shops">;
  selectedThreadId?: Id<"threads">;
  onSelectThread: (threadId: Id<"threads">) => void;
}

function NewChatDialog({
  shopId,
  onSelectThread,
}: {
  shopId: Id<"shops">;
  onSelectThread: (threadId: Id<"threads">) => void;
}) {
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState("messenger");
  const [platformUserId, setPlatformUserId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [initialMessage, setInitialMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const getOrCreateThread = useMutation(api.threads.getOrCreate);
  const sendHumanAgentMessage = useAction(api.messages.sendHumanAgentMessage);

  const resetForm = () => {
    setPlatform("messenger");
    setPlatformUserId("");
    setCustomerName("");
    setInitialMessage("");
  };

  const handleCreate = async () => {
    if (!platformUserId.trim()) {
      alert("Platform user ID is required.");
      return;
    }

    setIsSubmitting(true);
    try {
      const threadId = await getOrCreateThread({
        shopId,
        platform,
        platformUserId: platformUserId.trim(),
        customerName: customerName.trim() || undefined,
      });

      if (initialMessage.trim()) {
        await sendHumanAgentMessage({
          threadId,
          content: initialMessage.trim(),
        });
      }

      setOpen(false);
      resetForm();
      onSelectThread(threadId);
    } catch (error) {
      console.error("Failed to create conversation:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to create conversation. Please try again.";
      alert(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="w-full mt-3"
        onClick={() => setOpen(true)}
      >
        <Plus className="h-4 w-4 mr-2" />
        New Chat
      </Button>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) {
            resetForm();
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Start New Conversation</DialogTitle>
            <DialogDescription>
              Create a conversation manually from Studio. Add an initial message
              to proactively start the chat.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="platform">Platform</Label>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger id="platform" className="w-full">
                  <SelectValue placeholder="Select platform" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="messenger">Messenger</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="platform-user-id">Platform User ID</Label>
              <Input
                id="platform-user-id"
                value={platformUserId}
                onChange={(e) => setPlatformUserId(e.target.value)}
                placeholder="e.g. 1234567890"
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer-name">Customer Name (optional)</Label>
              <Input
                id="customer-name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. Jane Doe"
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="initial-message">Initial Message (optional)</Label>
              <Textarea
                id="initial-message"
                value={initialMessage}
                onChange={(e) => setInitialMessage(e.target.value)}
                placeholder="Write the first outbound message..."
                className="min-h-[96px] resize-none"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Chat"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
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
          <NewChatDialog shopId={shopId} onSelectThread={onSelectThread} />
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
        <NewChatDialog shopId={shopId} onSelectThread={onSelectThread} />
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
