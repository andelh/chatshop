import { v } from "convex/values";
import { components } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import {
  getOptionalShopAccess,
  requireAuth,
  requireShopOwner,
} from "./lib/auth";
import { toPublicShop } from "./lib/publicShop";

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
          ...toPublicShop(shop),
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
    const access = await getOptionalShopAccess(ctx, args.shopId);
    if (!access) {
      return { hasAccess: false, role: null };
    }
    return { hasAccess: true, role: access.role };
  },
});

/**
 * Bootstrap: give an existing account access to a shop. Internal only, so it
 * can be run before anyone owns the shop, e.g.
 *
 *   npx convex run shopMembers:linkUserByEmail \
 *     '{"email":"you@example.com","shopId":"<shop id>","role":"owner"}'
 *
 * The account must have finished sign-up (validated its email) first.
 */
export const linkUserByEmail = internalMutation({
  args: {
    email: v.string(),
    shopId: v.id("shops"),
    role: v.union(v.literal("owner"), v.literal("member")),
  },
  handler: async (ctx, args) => {
    const shop = await ctx.db.get(args.shopId);
    if (!shop) {
      throw new Error(`Shop not found: ${args.shopId}`);
    }

    const lookup = await ctx.runMutation(
      components.authEmail.verifiedEmails.lookupEmail,
      { email: args.email },
    );
    if (!lookup.success) {
      throw new Error(
        `No account with a verified email ${args.email} (${lookup.userError.error})`,
      );
    }

    const existing = await ctx.db
      .query("shopMembers")
      .withIndex("by_user_shop", (q) =>
        q.eq("userId", lookup.userId).eq("shopId", args.shopId),
      )
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { role: args.role });
      return { membershipId: existing._id, updated: true };
    }

    const membershipId = await ctx.db.insert("shopMembers", {
      shopId: args.shopId,
      userId: lookup.userId,
      role: args.role,
    });
    return { membershipId, updated: false };
  },
});
