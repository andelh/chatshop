import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalQuery, mutation, query } from "./_generated/server";
import { requireAuth, requireShopAccess, requireShopOwner } from "./lib/auth";
import { businessHoursError } from "./lib/businessHours";
import { toPublicShop } from "./lib/publicShop";
import { storefrontEndpointError } from "./lib/storefront";

const agentProfileValidator = v.object({
  storeName: v.string(),
  assistantName: v.string(),
  persona: v.optional(v.string()),
  policies: v.optional(v.string()),
});

/** Trimmed profile; throws when a required field is blank. */
function cleanProfile(profile: {
  storeName: string;
  assistantName: string;
  persona?: string;
  policies?: string;
}) {
  const storeName = profile.storeName.trim();
  const assistantName = profile.assistantName.trim();
  if (!storeName) throw new ConvexError("Store name is required");
  if (!assistantName) throw new ConvexError("Assistant name is required");
  return {
    storeName,
    assistantName,
    persona: profile.persona?.trim() || undefined,
    policies: profile.policies?.trim() || undefined,
  };
}

/**
 * Create a shop with manually entered credentials. The caller becomes its
 * owner. See docs/shop-onboarding.md for the planned OAuth/install flow.
 */
export const create = mutation({
  args: {
    profile: agentProfileValidator,
    shopifyDomain: v.string(),
    shopifyAccessToken: v.string(),
    metaPageId: v.string(),
    metaPageAccessToken: v.string(),
    instagramAccountId: v.optional(v.string()),
  },
  returns: v.id("shops"),
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const agentProfile = cleanProfile(args.profile);

    const shopifyDomain = args.shopifyDomain.trim();
    const endpointError = storefrontEndpointError(shopifyDomain);
    if (endpointError) throw new ConvexError(endpointError);
    const shopifyAccessToken = args.shopifyAccessToken.trim();
    const metaPageId = args.metaPageId.trim();
    const metaPageAccessToken = args.metaPageAccessToken.trim();
    const instagramAccountId = args.instagramAccountId?.trim() || undefined;
    if (!shopifyAccessToken || !metaPageId || !metaPageAccessToken) {
      throw new ConvexError(
        "Storefront token, Page ID and Page access token are required",
      );
    }

    // Webhooks route to the first shop with a matching page or account, so
    // each may belong to one shop only.
    const pageTaken = await ctx.db
      .query("shops")
      .withIndex("by_meta_page", (q) => q.eq("metaPageId", metaPageId))
      .first();
    if (pageTaken) {
      throw new ConvexError("Another shop already uses this Facebook Page");
    }
    if (instagramAccountId) {
      const accountTaken = await ctx.db
        .query("shops")
        .withIndex("by_instagram_account", (q) =>
          q.eq("instagramAccountId", instagramAccountId),
        )
        .first();
      if (accountTaken) {
        throw new ConvexError(
          "Another shop already uses this Instagram account",
        );
      }
    }

    const shopId = await ctx.db.insert("shops", {
      shopifyDomain,
      shopifyAccessToken,
      metaPageId,
      metaPageAccessToken,
      instagramAccountId,
      agentProfile,
      settings: { autoReplyEnabled: true },
    });
    await ctx.db.insert("shopMembers", { userId, shopId, role: "owner" });
    return shopId;
  },
});

/** Change who the assistant is for a shop. Owners only. */
export const updateAgentProfile = mutation({
  args: { shopId: v.id("shops"), profile: agentProfileValidator },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireShopOwner(ctx, args.shopId);
    await ctx.db.patch(args.shopId, {
      agentProfile: cleanProfile(args.profile),
    });
    return null;
  },
});

const dayHours = v.optional(v.object({ open: v.string(), close: v.string() }));
const businessHoursValidator = v.object({
  timezone: v.string(),
  days: v.object({
    mon: dayHours,
    tue: dayHours,
    wed: dayHours,
    thu: dayHours,
    fri: dayHours,
    sat: dayHours,
    sun: dayHours,
  }),
});

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
    const shop = await ctx.db.get(args.shopId);
    return shop ? toPublicShop(shop) : null;
  },
});

export const internalGetByMetaPageId = internalQuery({
  args: { metaPageId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("shops")
      .withIndex("by_meta_page", (q) => q.eq("metaPageId", args.metaPageId))
      .first();
  },
});

export const internalGetByInstagramAccountId = internalQuery({
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
 * Update shop-level settings (autoReplyEnabled, etc.)
 * Requires shop access.
 */
export const updateShopSettings = mutation({
  args: {
    shopId: v.id("shops"),
    autoReplyEnabled: v.optional(v.boolean()),
    /** null clears the hours, so the AI replies at any time. */
    businessHours: v.optional(v.union(v.null(), businessHoursValidator)),
  },
  handler: async (ctx, args) => {
    await requireShopAccess(ctx, args.shopId);

    const shop = await ctx.db.get(args.shopId);
    if (!shop) throw new Error("Shop not found");

    const patch: Record<string, unknown> = {};
    if (args.autoReplyEnabled !== undefined) {
      patch.autoReplyEnabled = args.autoReplyEnabled;
    }
    if (args.businessHours !== undefined) {
      const error = args.businessHours
        ? businessHoursError(args.businessHours)
        : null;
      if (error) throw new ConvexError(error);
      patch.businessHours = args.businessHours ?? undefined;
    }

    await ctx.db.patch(args.shopId, {
      settings: { ...shop.settings, ...patch },
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
