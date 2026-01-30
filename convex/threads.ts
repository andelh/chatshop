import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { costByThread, messagesByThread, tokensByThread } from "./aggregates";

export const getOrCreate = mutation({
  args: {
    shopId: v.id("shops"),
    platform: v.string(),
    platformUserId: v.string(),
    customerName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
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
    return await ctx.db.get(args.threadId);
  },
});

export const getByShopPlatformUser = query({
  args: {
    shopId: v.id("shops"),
    platform: v.string(),
    platformUserId: v.string(),
  },
  handler: async (ctx, args) => {
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
