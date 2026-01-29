import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const listByThread = query({
  args: {
    threadId: v.id("threads"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .order("desc")
      .take(limit);

    return messages.reverse();
  },
});

export const addMessage = mutation({
  args: {
    threadId: v.id("threads"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    timestamp: v.number(),
    platformMessageId: v.optional(v.string()),
    toolCalls: v.optional(v.array(v.any())),
  },
  handler: async (ctx, args) => {
    const messageId = await ctx.db.insert("messages", {
      threadId: args.threadId,
      role: args.role,
      content: args.content,
      timestamp: args.timestamp,
      platformMessageId: args.platformMessageId,
      toolCalls: args.toolCalls,
    });

    const thread = await ctx.db.get(args.threadId);
    if (thread) {
      const unreadCount =
        args.role === "assistant" ? 0 : (thread.unreadCount ?? 0) + 1;
      await ctx.db.patch(args.threadId, {
        lastMessageAt: args.timestamp,
        unreadCount,
      });
    }

    return messageId;
  },
});
