import { v } from "convex/values";
import { components } from "./_generated/api";
import { internalMutation, query } from "./_generated/server";
import { getCurrentUserId } from "./lib/auth";

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
