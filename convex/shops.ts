import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";

/**
 * Get a shop by its ID.
 */
export const get = query({
  args: { shopId: v.id("shops") },
  handler: async (
    ctx,
    args,
  ): Promise<{
    _id: Id<"shops">;
    _creationTime: number;
    shopifyDomain: string;
    shopifyAccessToken: string;
    metaPageId: string;
    metaPageAccessToken: string;
    instagramAccountId?: string;
    settings: {
      autoReplyEnabled: boolean;
      businessHours?: any;
      agentPaused?: boolean;
      agentPausedAt?: number;
      agentPausedReason?: string;
    };
  } | null> => {
    return await ctx.db.get(args.shopId);
  },
});

export const getByMetaPageId = query({
  args: { metaPageId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("shops")
      .withIndex("by_meta_page", (q) => q.eq("metaPageId", args.metaPageId))
      .first();
  },
});

export const getByInstagramAccountId = query({
  args: { instagramAccountId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("shops")
      .withIndex("by_instagram_account", (q) =>
        q.eq("instagramAccountId", args.instagramAccountId),
      )
      .first();
  },
});

/**
 * Pause the AI agent for all conversations in a shop.
 * This is a shop-wide pause that prevents AI from responding to any thread.
 */
export const pauseShopAgent = mutation({
  args: {
    shopId: v.id("shops"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const shop = await ctx.db.get(args.shopId);
    if (!shop) {
      throw new Error(`Shop not found: ${args.shopId}`);
    }

    const currentSettings = shop.settings as any;

    await ctx.db.patch(args.shopId, {
      settings: {
        ...currentSettings,
        agentPaused: true,
        agentPausedAt: Date.now(),
        agentPausedReason: args.reason,
      },
    });

    return { success: true };
  },
});

/**
 * Resume the AI agent for all conversations in a shop.
 * This removes the shop-wide pause.
 */
export const resumeShopAgent = mutation({
  args: {
    shopId: v.id("shops"),
  },
  handler: async (ctx, args) => {
    const shop = await ctx.db.get(args.shopId);
    if (!shop) {
      throw new Error(`Shop not found: ${args.shopId}`);
    }

    const currentSettings = shop.settings as any;

    await ctx.db.patch(args.shopId, {
      settings: {
        ...currentSettings,
        agentPaused: false,
        agentPausedAt: undefined,
        agentPausedReason: undefined,
      },
    });

    return { success: true };
  },
});

/**
 * Get the current agent status for a shop.
 */
export const getShopAgentStatus = query({
  args: {
    shopId: v.id("shops"),
  },
  handler: async (ctx, args) => {
    const shop = await ctx.db.get(args.shopId);
    if (!shop) {
      return null;
    }

    const settings = shop.settings as any;

    return {
      isPaused: settings.agentPaused ?? false,
      pausedAt: settings.agentPausedAt,
      pausedReason: settings.agentPausedReason,
    };
  },
});
