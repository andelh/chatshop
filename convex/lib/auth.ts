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

export async function requireAuth(ctx: AuthContext): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError("Unauthenticated");
  }
  return identity.subject;
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

export async function getOptionalShopAccess(
  ctx: AuthContext,
  shopId: Id<"shops">,
): Promise<ShopAccess | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }

  const membership = await ctx.db
    .query("shopMembers")
    .withIndex("by_user_shop", (q) =>
      q.eq("userId", identity.subject).eq("shopId", shopId),
    )
    .first();

  if (!membership) {
    return null;
  }

  return {
    userId: identity.subject,
    role: membership.role,
    membershipId: membership._id,
  };
}

export async function getUserShops(
  ctx: QueryCtx,
): Promise<Array<{ shopId: Id<"shops">; role: ShopRole }>> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return [];
  }

  const memberships = await ctx.db
    .query("shopMembers")
    .withIndex("by_user", (q) => q.eq("userId", identity.subject))
    .collect();

  return memberships.map((m) => ({
    shopId: m.shopId,
    role: m.role,
  }));
}
