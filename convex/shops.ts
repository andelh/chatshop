import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalQuery, mutation, query } from "./_generated/server";
import { requireAuth, requireShopAccess } from "./lib/auth";

/**
 * Internal shop lookup for use by scheduled actions — no user auth required.
 */
export const internalGet = internalQuery({
  args: { shopId: v.id("shops") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.shopId);
  },
});

/**
 * Get a shop by its ID.
 * Requires user to be a member of the shop.
 */
export const get = query({
  args: { shopId: v.id("shops") },
  handler: async (ctx, args) => {
    await requireShopAccess(ctx, args.shopId);
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
 * Requires shop owner or member access.
 */
export const pauseShopAgent = mutation({
  args: {
    shopId: v.id("shops"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireShopAccess(ctx, args.shopId);

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
 * Requires shop owner or member access.
 */
export const resumeShopAgent = mutation({
  args: {
    shopId: v.id("shops"),
  },
  handler: async (ctx, args) => {
    await requireShopAccess(ctx, args.shopId);

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
 * Requires user to be a member of the shop.
 */
export const getShopAgentStatus = query({
  args: {
    shopId: v.id("shops"),
  },
  handler: async (ctx, args) => {
    await requireShopAccess(ctx, args.shopId);

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
