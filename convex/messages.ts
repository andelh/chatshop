import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, internalMutation, mutation, query } from "./_generated/server";
import { costByThread, messagesByThread, tokensByThread } from "./aggregates";
import { sendMetaMessage } from "./lib/messaging";

export const get = query({
  args: {
    messageId: v.id("messages"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.messageId);
  },
});

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

export const getByPlatformMessageId = query({
  args: {
    platformMessageId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_platform_message_id", (q) =>
        q.eq("platformMessageId", args.platformMessageId),
      )
      .first();
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

/**
 * Send a message as a human agent.
 * This action sends the message to the customer via Meta API, then persists
 * the outbound message via an internal mutation.
 */
export const sendHumanAgentMessage = action({
  args: {
    threadId: v.id("threads"),
    content: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    messageId: v.id("messages"),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ success: boolean; messageId: Id<"messages"> }> => {
    const thread = await ctx.runQuery(api.threads.get, {
      threadId: args.threadId,
    });
    if (!thread) {
      throw new Error(`Thread not found: ${args.threadId}`);
    }

    const shop = await ctx.runQuery(api.shops.get, {
      shopId: thread.shopId,
    });
    if (!shop) {
      throw new Error(`Shop not found for thread: ${args.threadId}`);
    }

    const accessToken = shop.metaPageAccessToken;
    await sendMetaMessage({
      recipientId: thread.platformUserId,
      text: args.content,
      accessToken,
    });

    const result = await ctx.runMutation(internal.messages.saveHumanAgentMessage, {
      threadId: args.threadId,
      content: args.content,
    });
    return result;
  },
});

/**
 * Simulate an inbound customer message from Studio.
 * This uses the same batching + scheduled processing pipeline as webhooks.
 */
export const simulateCustomerMessage = action({
  args: {
    threadId: v.id("threads"),
    content: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    jobId: v.string(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ success: boolean; jobId: string }> => {
    const thread = await ctx.runQuery(api.threads.get, {
      threadId: args.threadId,
    });
    if (!thread) {
      throw new Error(`Thread not found: ${args.threadId}`);
    }

    const shop = await ctx.runQuery(api.shops.get, {
      shopId: thread.shopId,
    });
    if (!shop) {
      throw new Error(`Shop not found for thread: ${args.threadId}`);
    }

    const existingJobId = thread.scheduledJobId;
    if (existingJobId) {
      try {
        await ctx.runAction(api.scheduler.cancelScheduledJob, {
          jobId: existingJobId,
        });
      } catch (error) {
        console.error("Error cancelling existing scheduled job:", error);
      }
    }

    const sequenceNumber = await ctx.runMutation(api.threads.getNextSequenceNumber, {
      threadId: args.threadId,
    });

    await ctx.runMutation(api.pendingMessages.addPendingMessage, {
      threadId: args.threadId,
      content: args.content,
      timestamp: Date.now(),
      sequenceNumber,
    });

    const pageId =
      thread.platform === "instagram"
        ? (shop.instagramAccountId ?? shop.metaPageId)
        : shop.metaPageId;

    const newJobId = await ctx.runAction(api.scheduler.scheduleMessageProcessing, {
      threadId: args.threadId,
      senderId: thread.platformUserId,
      pageId,
      platform: thread.platform,
      simulateOnly: true,
    });

    await ctx.runMutation(api.threads.updateScheduledJob, {
      threadId: args.threadId,
      jobId: newJobId,
    });

    return { success: true, jobId: newJobId };
  },
});

/**
 * Internal mutation used by sendHumanAgentMessage action.
 */
export const saveHumanAgentMessage = internalMutation({
  args: {
    threadId: v.id("threads"),
    content: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    messageId: v.id("messages"),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ success: boolean; messageId: Id<"messages"> }> => {
    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      throw new Error(`Thread not found: ${args.threadId}`);
    }

    const now = Date.now();
    const messageId = await ctx.db.insert("messages", {
      threadId: args.threadId,
      role: "human_agent",
      content: args.content,
      timestamp: now,
    });

    const totalMessages = (thread.totalMessages ?? 0) + 1;

    await ctx.db.patch(args.threadId, {
      lastHumanMessageAt: now,
      hasHumanIntervention: true,
      agentStatus: "paused",
      lastMessageAt: now,
      unreadCount: 0,
      totalMessages,
    });

    const newMessage = await ctx.db.get(messageId);
    if (newMessage) {
      await messagesByThread.insert(ctx, newMessage);
    }

    return { success: true, messageId };
  },
});

/**
 * Retry generating an AI response for a given message.
 * This is a public action wrapper that calls the internal retry action.
 */
export const retryAIResponse = action({
  args: {
    threadId: v.id("threads"),
    messageId: v.id("messages"),
  },
  returns: v.object({
    success: v.boolean(),
    messageIds: v.array(v.string()),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ success: boolean; messageIds: string[] }> => {
    // Call the internal action to regenerate the AI response
    const result: { success: boolean; messageIds: string[] } =
      await ctx.runAction(internal.scheduledActions.retryMessage, {
        threadId: args.threadId,
        messageId: args.messageId,
      });

    return result;
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
