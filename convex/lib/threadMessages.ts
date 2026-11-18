import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { costByThread, messagesByThread, tokensByThread } from "../aggregates";

type NewMessage = Omit<Doc<"messages">, "_id" | "_creationTime" | "threadId">;

/**
 * Insert a message and keep the thread's counters and aggregates in step.
 * Re-reads the thread each call, so it's safe to call several times in one
 * mutation.
 */
export async function insertThreadMessage(
  ctx: MutationCtx,
  threadId: Id<"threads">,
  message: NewMessage,
): Promise<Id<"messages">> {
  const thread = await ctx.db.get(threadId);
  if (!thread) {
    throw new Error(`Thread not found: ${threadId}`);
  }

  const messageId = await ctx.db.insert("messages", { threadId, ...message });
  const doc = await ctx.db.get(messageId);
  if (doc) {
    await Promise.all([
      messagesByThread.insert(ctx, doc),
      tokensByThread.insert(ctx, doc),
      costByThread.insert(ctx, doc),
    ]);
  }

  await ctx.db.patch(threadId, {
    lastMessageAt: Math.max(thread.lastMessageAt, message.timestamp),
    unreadCount: message.role === "user" ? (thread.unreadCount ?? 0) + 1 : 0,
    totalMessages: (thread.totalMessages ?? 0) + 1,
    totalTokens:
      (thread.totalTokens ?? 0) + (message.aiMetadata?.totalTokens ?? 0),
    totalCostUsd:
      (thread.totalCostUsd ?? 0) + (message.aiMetadata?.costUsd ?? 0),
  });

  return messageId;
}

/** True if a message with this Meta mid is already stored or queued. */
export async function isKnownPlatformMessage(
  ctx: MutationCtx,
  platformMessageId: string,
): Promise<boolean> {
  const stored = await ctx.db
    .query("messages")
    .withIndex("by_platform_message_id", (q) =>
      q.eq("platformMessageId", platformMessageId),
    )
    .first();
  if (stored) return true;

  const queued = await ctx.db
    .query("pending_messages")
    .withIndex("by_platform_message_id", (q) =>
      q.eq("platformMessageId", platformMessageId),
    )
    .first();
  return queued !== null;
}

/** Find the shop that owns a Messenger page or Instagram account. */
export async function findShopForPage(
  ctx: MutationCtx,
  platform: "messenger" | "instagram",
  pageId: string,
): Promise<Doc<"shops"> | null> {
  return platform === "messenger"
    ? await ctx.db
        .query("shops")
        .withIndex("by_meta_page", (q) => q.eq("metaPageId", pageId))
        .first()
    : await ctx.db
        .query("shops")
        .withIndex("by_instagram_account", (q) =>
          q.eq("instagramAccountId", pageId),
        )
        .first();
}

export async function getOrCreateThread(
  ctx: MutationCtx,
  args: { shopId: Id<"shops">; platform: string; platformUserId: string },
): Promise<Doc<"threads">> {
  const existing = await ctx.db
    .query("threads")
    .withIndex("by_shop_platform_user", (q) =>
      q
        .eq("shopId", args.shopId)
        .eq("platform", args.platform)
        .eq("platformUserId", args.platformUserId),
    )
    .first();
  if (existing) return existing;

  const threadId = await ctx.db.insert("threads", {
    shopId: args.shopId,
    platform: args.platform,
    platformUserId: args.platformUserId,
    status: "active",
    agentStatus: "active",
    lastMessageAt: Date.now(),
    unreadCount: 0,
  });
  const created = await ctx.db.get(threadId);
  if (!created) throw new Error("Failed to create thread");
  // Look up the customer's name in the background; Studio shows it once set.
  await ctx.scheduler.runAfter(0, internal.threads.fetchCustomerName, {
    threadId,
  });
  return created;
}

/**
 * Hand a thread to the shop's staff. Emails the members only on the
 * transition into handoff, not on a repeat request.
 */
export async function enterHandoff(
  ctx: MutationCtx,
  thread: Doc<"threads">,
  reason: string,
): Promise<void> {
  await ctx.db.patch(thread._id, {
    agentStatus: "handoff",
    agentPausedAt: Date.now(),
    agentPausedReason: reason,
  });
  if (thread.agentStatus !== "handoff") {
    await ctx.scheduler.runAfter(0, internal.notifications.sendHandoffEmail, {
      threadId: thread._id,
      reason,
    });
  }
}
