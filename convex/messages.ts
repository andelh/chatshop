import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { costByThread, messagesByThread, tokensByThread } from "./aggregates";

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
    reasoning: v.optional(v.string()),
    aiMetadata: v.optional(
      v.object({
        model: v.string(),
        totalTokens: v.number(),
        reasoningTokens: v.number(),
        inputTokens: v.number(),
        outputTokens: v.number(),
        costUsd: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const messageId = await ctx.db.insert("messages", {
      threadId: args.threadId,
      role: args.role,
      content: args.content,
      timestamp: args.timestamp,
      platformMessageId: args.platformMessageId,
      toolCalls: args.toolCalls,
      reasoning: args.reasoning,
      aiMetadata: args.aiMetadata,
    });

    const newMessage = await ctx.db.get(messageId);
    if (newMessage) {
      await Promise.all([
        messagesByThread.insert(ctx, newMessage),
        tokensByThread.insert(ctx, newMessage),
        costByThread.insert(ctx, newMessage),
      ]);
    }

    const thread = await ctx.db.get(args.threadId);
    if (thread) {
      const unreadCount =
        args.role === "assistant" ? 0 : (thread.unreadCount ?? 0) + 1;

      // Update thread aggregates
      const totalMessages = (thread.totalMessages ?? 0) + 1;
      const totalTokens =
        (thread.totalTokens ?? 0) + (args.aiMetadata?.totalTokens ?? 0);
      const totalCostUsd =
        (thread.totalCostUsd ?? 0) + (args.aiMetadata?.costUsd ?? 0);

      await ctx.db.patch(args.threadId, {
        lastMessageAt: args.timestamp,
        unreadCount,
        totalMessages,
        totalTokens,
        totalCostUsd,
      });
    }

    return messageId;
  },
});

export const backfillMessageAggregates = mutation({
  args: {},
  handler: async (ctx) => {
    const messages = await ctx.db.query("messages").collect();

    for (const message of messages) {
      await messagesByThread.insertIfDoesNotExist(ctx, message);
      await tokensByThread.insertIfDoesNotExist(ctx, message);
      await costByThread.insertIfDoesNotExist(ctx, message);
    }

    return { processed: messages.length };
  },
});
