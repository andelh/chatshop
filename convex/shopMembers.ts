import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuth, requireShopOwner } from "./lib/auth";

export const listByUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);

    return await ctx.db
      .query("shopMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const listUserShops = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);

    const memberships = await ctx.db
      .query("shopMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const shops = await Promise.all(
      memberships.map(async (membership) => {
        const shop = await ctx.db.get(membership.shopId);
        if (!shop) return null;
        return {
          ...shop,
          role: membership.role,
          membershipId: membership._id,
        };
      }),
    );

    return shops.filter((s): s is NonNullable<typeof s> => s !== null);
  },
});

export const listByShop = query({
  args: {
    shopId: v.id("shops"),
  },
  handler: async (ctx, args) => {
    await requireShopOwner(ctx, args.shopId);

    return await ctx.db
      .query("shopMembers")
      .withIndex("by_shop", (q) => q.eq("shopId", args.shopId))
      .collect();
  },
});

export const addMember = mutation({
  args: {
    shopId: v.id("shops"),
    userId: v.string(),
    role: v.union(v.literal("owner"), v.literal("member")),
  },
  handler: async (ctx, args) => {
    await requireShopOwner(ctx, args.shopId);

    const existing = await ctx.db
      .query("shopMembers")
      .withIndex("by_user_shop", (q) =>
        q.eq("userId", args.userId).eq("shopId", args.shopId),
      )
      .first();

    if (existing) {
      throw new Error("User is already a member of this shop");
    }

    return await ctx.db.insert("shopMembers", {
      shopId: args.shopId,
      userId: args.userId,
      role: args.role,
    });
  },
});

export const updateMemberRole = mutation({
  args: {
    membershipId: v.id("shopMembers"),
    role: v.union(v.literal("owner"), v.literal("member")),
  },
  handler: async (ctx, args) => {
    const membership = await ctx.db.get(args.membershipId);
    if (!membership) {
      throw new Error("Membership not found");
    }

    await requireShopOwner(ctx, membership.shopId);

    if (membership.role === "owner" && args.role !== "owner") {
      const allMembers = await ctx.db
        .query("shopMembers")
        .withIndex("by_shop", (q) => q.eq("shopId", membership.shopId))
        .collect();
      const owners = allMembers.filter((m) => m.role === "owner");

      if (owners.length <= 1) {
        throw new Error("Cannot demote the last owner of a shop");
      }
    }

    await ctx.db.patch(args.membershipId, { role: args.role });

    return { success: true };
  },
});

export const removeMember = mutation({
  args: {
    membershipId: v.id("shopMembers"),
  },
  handler: async (ctx, args) => {
    const membership = await ctx.db.get(args.membershipId);
    if (!membership) {
      throw new Error("Membership not found");
    }

    await requireShopOwner(ctx, membership.shopId);

    if (membership.role === "owner") {
      const allMembers = await ctx.db
        .query("shopMembers")
        .withIndex("by_shop", (q) => q.eq("shopId", membership.shopId))
        .collect();
      const owners = allMembers.filter((m) => m.role === "owner");

      if (owners.length <= 1) {
        throw new Error("Cannot remove the last owner of a shop");
      }
    }

    await ctx.db.delete(args.membershipId);

    return { success: true };
  },
});

export const checkAccess = query({
  args: {
    shopId: v.id("shops"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { hasAccess: false, role: null };
    }

    const membership = await ctx.db
      .query("shopMembers")
      .withIndex("by_user_shop", (q) =>
        q.eq("userId", identity.subject).eq("shopId", args.shopId),
      )
      .first();

    if (!membership) {
      return { hasAccess: false, role: null };
    }

    return { hasAccess: true, role: membership.role };
  },
});
