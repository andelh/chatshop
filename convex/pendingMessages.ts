import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Add a message to the pending queue for batching.
 * This is called by webhooks when receiving user messages.
 */
export const addPendingMessage = mutation({
  args: {
    threadId: v.id("threads"),
    content: v.string(),
    timestamp: v.number(),
    platformMessageId: v.optional(v.string()),
    sequenceNumber: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("pending_messages", {
      threadId: args.threadId,
      content: args.content,
      timestamp: args.timestamp,
      platformMessageId: args.platformMessageId,
      sequenceNumber: args.sequenceNumber,
    });
  },
});

/**
 * Get all pending messages for a thread, ordered by sequence number.
 * Used by the scheduled batch processor.
 */
export const getPendingMessages = query({
  args: {
    threadId: v.id("threads"),
  },
  handler: async (ctx, args) => {
    const pending = await ctx.db
      .query("pending_messages")
      .withIndex("by_thread_sequence", (q) => q.eq("threadId", args.threadId))
      .order("asc")
      .collect();

    return pending;
  },
});

/**
 * Clear all pending messages for a thread after processing.
 * Called after the AI response is sent.
 */
export const clearPendingMessages = mutation({
  args: {
    threadId: v.id("threads"),
  },
  handler: async (ctx, args) => {
    const pending = await ctx.db
      .query("pending_messages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .collect();

    await Promise.all(pending.map((msg) => ctx.db.delete(msg._id)));

    return pending.length;
  },
});

/**
 * Get the count of pending messages for a thread.
 * Useful for debugging and monitoring.
 */
export const getPendingCount = query({
  args: {
    threadId: v.id("threads"),
  },
  handler: async (ctx, args) => {
    const pending = await ctx.db
      .query("pending_messages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .collect();

    return pending.length;
  },
});
