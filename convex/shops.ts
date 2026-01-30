import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { query } from "./_generated/server";

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
