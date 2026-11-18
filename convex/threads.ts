import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { costByThread, messagesByThread, tokensByThread } from "./aggregates";
import { requireShopAccess } from "./lib/auth";
import { fetchCustomerName as fetchNameFromMeta } from "./lib/metaProfile";
import { enterHandoff } from "./lib/threadMessages";

export const getOrCreate = mutation({
  args: {
    shopId: v.id("shops"),
    platform: v.string(),
    platformUserId: v.string(),
    customerName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireShopAccess(ctx, args.shopId);

    const existing = await ctx.db
      .query("threads")
      .withIndex("by_shop_platform_user", (q) =>
        q
          .eq("shopId", args.shopId)
          .eq("platform", args.platform)
          .eq("platformUserId", args.platformUserId),
      )
      .first();

    if (existing) {
      if (args.customerName && args.customerName !== existing.customerName) {
        await ctx.db.patch(existing._id, { customerName: args.customerName });
      }
      return existing._id;
    }

    return await ctx.db.insert("threads", {
      shopId: args.shopId,
      platform: args.platform,
      platformUserId: args.platformUserId,
      status: "active",
      agentStatus: "active",
      lastMessageAt: Date.now(),
      customerName: args.customerName,
      unreadCount: 0,
    });
  },
});

export const listByShop = query({
  args: {
    shopId: v.id("shops"),
    limit: v.optional(v.number()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireShopAccess(ctx, args.shopId);

    const limit = args.limit ?? 50;
    const status = args.status ?? "active";

    const threads = await ctx.db
      .query("threads")
      .withIndex("by_shop_status", (q) =>
        q.eq("shopId", args.shopId).eq("status", status),
      )
      .order("desc")
      .take(limit);

    return threads;
  },
});

export const listByShopWithStats = query({
  args: {
    shopId: v.id("shops"),
    limit: v.optional(v.number()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireShopAccess(ctx, args.shopId);

    const limit = args.limit ?? 50;
    const status = args.status ?? "active";

    const threads = await ctx.db
      .query("threads")
      .withIndex("by_shop_status", (q) =>
        q.eq("shopId", args.shopId).eq("status", status),
      )
      .order("desc")
      .take(limit);

    const threadsWithStats = await Promise.all(
      threads.map(async (thread) => {
        const namespace = thread._id;
        const [messageCount, tokenCount, costUsd] = await Promise.all([
          messagesByThread.count(ctx, { namespace }),
          tokensByThread.sum(ctx, { namespace }),
          costByThread.sum(ctx, { namespace }),
        ]);

        return {
          ...thread,
          stats: {
            messageCount: messageCount ?? 0,
            tokenCount: tokenCount ?? 0,
            costUsd: costUsd ?? 0,
          },
        };
      }),
    );

    const totals = threadsWithStats.reduce(
      (acc, thread) => {
        acc.totalMessages += thread.stats.messageCount;
        acc.totalTokens += thread.stats.tokenCount;
        acc.totalCostUsd += thread.stats.costUsd;
        return acc;
      },
      { totalMessages: 0, totalTokens: 0, totalCostUsd: 0 },
    );

    return { threads: threadsWithStats, totals };
  },
});

export const get = query({
  args: {
    threadId: v.id("threads"),
  },
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      return null;
    }
    await requireShopAccess(ctx, thread.shopId);
    return thread;
  },
});

export const getByShopPlatformUser = query({
  args: {
    shopId: v.id("shops"),
    platform: v.string(),
    platformUserId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireShopAccess(ctx, args.shopId);
    return await ctx.db
      .query("threads")
      .withIndex("by_shop_platform_user", (q) =>
        q
          .eq("shopId", args.shopId)
          .eq("platform", args.platform)
          .eq("platformUserId", args.platformUserId),
      )
      .first();
  },
});

/**
 * Pause the AI agent for a thread.
 * Human agent takes over the conversation.
 */
export const pauseThread = mutation({
  args: {
    threadId: v.id("threads"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      throw new Error(`Thread not found: ${args.threadId}`);
    }
    await requireShopAccess(ctx, thread.shopId);

    await ctx.db.patch(args.threadId, {
      agentStatus: "paused",
      agentPausedAt: Date.now(),
      agentPausedReason: args.reason,
      hasHumanIntervention: true,
    });

    return { success: true };
  },
});

/**
 * Resume the AI agent for a thread.
 * AI will start responding again.
 */
export const resumeThread = mutation({
  args: {
    threadId: v.id("threads"),
  },
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      throw new Error(`Thread not found: ${args.threadId}`);
    }
    await requireShopAccess(ctx, thread.shopId);

    await ctx.db.patch(args.threadId, {
      agentStatus: "active",
      agentPausedAt: undefined,
      agentPausedReason: undefined,
    });

    return { success: true };
  },
});

/**
 * Request handoff to human agent.
 * Called when AI detects it cannot handle the query.
 */
export const requestHandoff = mutation({
  args: {
    threadId: v.id("threads"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      throw new Error(`Thread not found: ${args.threadId}`);
    }
    await requireShopAccess(ctx, thread.shopId);

    await ctx.db.patch(args.threadId, {
      agentStatus: "handoff",
      agentPausedAt: Date.now(),
      agentPausedReason: args.reason,
    });

    return { success: true };
  },
});

/**
 * Mark thread as waiting for human response.
 * Used when AI has responded but is waiting for human to take over.
 */
export const markPendingHuman = mutation({
  args: {
    threadId: v.id("threads"),
  },
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      throw new Error(`Thread not found: ${args.threadId}`);
    }
    await requireShopAccess(ctx, thread.shopId);

    await ctx.db.patch(args.threadId, {
      agentStatus: "pending_human",
    });

    return { success: true };
  },
});

// ─── Internal variants for use by scheduled actions / webhooks (no user auth required) ───

export const internalGet = internalQuery({
  args: { threadId: v.id("threads") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.threadId);
  },
});

export const internalRequestHandoff = internalMutation({
  args: {
    threadId: v.id("threads"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId);
    if (!thread) throw new Error(`Thread not found: ${args.threadId}`);
    await enterHandoff(ctx, thread, args.reason);
    return { success: true };
  },
});

/**
 * Fill in a new thread's customer name from the Graph API. Scheduled by
 * getOrCreateThread; does nothing if Meta won't share the name.
 */
export const fetchCustomerName = internalAction({
  args: { threadId: v.id("threads") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const thread = await ctx.runQuery(internal.threads.internalGet, {
      threadId: args.threadId,
    });
    if (!thread || thread.customerName) return null;
    const shop = await ctx.runQuery(internal.shops.internalGet, {
      shopId: thread.shopId,
    });
    if (!shop) return null;
    const name = await fetchNameFromMeta({
      platform: thread.platform,
      userId: thread.platformUserId,
      accessToken: shop.metaPageAccessToken,
    });
    if (name) {
      await ctx.runMutation(internal.threads.internalSetCustomerName, {
        threadId: args.threadId,
        customerName: name,
      });
    }
    return null;
  },
});

/** Set the customer name unless staff or an earlier lookup already did. */
export const internalSetCustomerName = internalMutation({
  args: { threadId: v.id("threads"), customerName: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId);
    if (thread && !thread.customerName) {
      await ctx.db.patch(args.threadId, { customerName: args.customerName });
    }
    return null;
  },
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Update thread status (active, resolved, archived).
 */
export const updateStatus = mutation({
  args: {
    threadId: v.id("threads"),
    status: v.union(
      v.literal("active"),
      v.literal("resolved"),
      v.literal("archived"),
    ),
  },
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      throw new Error(`Thread not found: ${args.threadId}`);
    }
    await requireShopAccess(ctx, thread.shopId);

    await ctx.db.patch(args.threadId, {
      status: args.status,
    });

    return { success: true };
  },
});
