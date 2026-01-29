import { v } from "convex/values";
import { mutation } from "./_generated/server";

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
