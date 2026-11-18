import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export type ShopRole = "owner" | "member";

export type ShopAccess = {
  userId: string;
  role: ShopRole;
  membershipId: string;
};

type AuthContext = QueryCtx | MutationCtx;

/**
 * The signed-in user's id, or null. Use this rather than
 * `identity.subject`: under Convex Auth the subject is not the bare user id.
 * Ids are returned as strings because `shopMembers.userId` is a string column.
 */
export async function getCurrentUserId(
  ctx: AuthContext,
): Promise<string | null> {
  return await getAuthUserId(ctx);
}

export async function requireAuth(ctx: AuthContext): Promise<string> {
  const userId = await getCurrentUserId(ctx);
  if (!userId) {
    throw new ConvexError("Unauthenticated");
  }
  return userId;
}

export async function requireShopAccess(
  ctx: AuthContext,
  shopId: Id<"shops">,
): Promise<ShopAccess> {
  const userId = await requireAuth(ctx);

  const membership = await ctx.db
    .query("shopMembers")
    .withIndex("by_user_shop", (q) =>
      q.eq("userId", userId).eq("shopId", shopId),
    )
    .first();

  if (!membership) {
    throw new ConvexError("Forbidden: No access to this shop");
  }

  return {
    userId,
    role: membership.role,
    membershipId: membership._id,
  };
}

export async function requireShopOwner(
  ctx: AuthContext,
  shopId: Id<"shops">,
): Promise<ShopAccess> {
  const access = await requireShopAccess(ctx, shopId);
  if (access.role !== "owner") {
    throw new ConvexError("Forbidden: Owner access required");
  }
  return access;
}

/**
 * Require the caller to own at least one shop. Used for global settings,
 * which affect every shop.
 */
export async function requireAnyShopOwner(ctx: AuthContext): Promise<string> {
  const userId = await requireAuth(ctx);
  const memberships = await ctx.db
    .query("shopMembers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  if (!memberships.some((m) => m.role === "owner")) {
    throw new ConvexError("Forbidden: Shop owner access required");
  }
  return userId;
}

export async function getOptionalShopAccess(
  ctx: AuthContext,
  shopId: Id<"shops">,
): Promise<ShopAccess | null> {
  const userId = await getCurrentUserId(ctx);
  if (!userId) {
    return null;
  }

  const membership = await ctx.db
    .query("shopMembers")
    .withIndex("by_user_shop", (q) =>
      q.eq("userId", userId).eq("shopId", shopId),
    )
    .first();

  if (!membership) {
    return null;
  }

  return {
    userId,
    role: membership.role,
    membershipId: membership._id,
  };
}

export async function getUserShops(
  ctx: QueryCtx,
): Promise<Array<{ shopId: Id<"shops">; role: ShopRole }>> {
  const userId = await getCurrentUserId(ctx);
  if (!userId) {
    return [];
  }

  const memberships = await ctx.db
    .query("shopMembers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();

  return memberships.map((m) => ({
    shopId: m.shopId,
    role: m.role,
  }));
}
