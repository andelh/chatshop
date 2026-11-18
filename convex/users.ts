import { ConvexError, v } from "convex/values";
import { components } from "./_generated/api";
import { env, internalMutation, query } from "./_generated/server";
import { getCurrentUserId } from "./lib/auth";
import { isEmailAllowed, SIGNUP_NOT_ALLOWED } from "./lib/signup";

/**
 * Convex Auth calls this when a new account finishes sign-up. Emails and
 * passwords live in the Convex Auth components; the app's `users` row only
 * holds app-specific fields (none yet).
 */
export const createUser = internalMutation({
  args: {
    method: v.object({
      name: v.literal("emailPassword"),
      profile: v.object({}),
    }),
  },
  returns: v.id("users"),
  handler: async (ctx) => {
    return await ctx.db.insert("users", {});
  },
});

/**
 * Convex Auth calls this on every sign-in, including the first one when a
 * new account validates its email. Shop members always get in; anyone else
 * needs a verified email listed in ALLOWED_SIGNUP_EMAILS. Throwing rolls back
 * the whole sign-in, so a refused sign-up stays unvalidated and gets no
 * session.
 */
export const onSignIn = internalMutation({
  args: {
    method: v.object({
      name: v.literal("emailPassword"),
      profile: v.object({}),
    }),
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, { userId }) => {
    const membership = await ctx.db
      .query("shopMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (membership) {
      return null;
    }
    const email = await ctx.runQuery(
      components.authEmail.verifiedEmails.getPrimaryEmail,
      { userId },
    );
    if (email && isEmailAllowed(email, env.ALLOWED_SIGNUP_EMAILS)) {
      return null;
    }
    throw new ConvexError(SIGNUP_NOT_ALLOWED);
  },
});

/**
 * The signed-in user's id and primary email, or null when signed out.
 */
export const viewer = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({ userId: v.string(), email: v.union(v.string(), v.null()) }),
  ),
  handler: async (ctx) => {
    const userId = await getCurrentUserId(ctx);
    if (!userId) {
      return null;
    }
    const email = await ctx.runQuery(
      components.authEmail.verifiedEmails.getPrimaryEmail,
      { userId },
    );
    return { userId, email };
  },
});
