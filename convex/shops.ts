import { v } from "convex/values";
import { query } from "./_generated/server";

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
