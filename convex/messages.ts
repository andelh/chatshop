import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { costByThread, messagesByThread, tokensByThread } from "./aggregates";
import { requireShopAccess } from "./lib/auth";
import { sendMetaMessage } from "./lib/messaging";
import { STANDARD_MESSAGING_WINDOW_MS } from "./lib/pipeline";
import { insertThreadMessage } from "./lib/threadMessages";

export const get = query({
  args: {
    messageId: v.id("messages"),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) {
      return null;
    }
    const thread = await ctx.db.get(message.threadId);
    if (!thread) {
      return null;
    }
    await requireShopAccess(ctx, thread.shopId);
    return message;
  },
});

export const listByThread = query({
  args: {
    threadId: v.id("threads"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      return [];
    }
    await requireShopAccess(ctx, thread.shopId);

    const limit = args.limit ?? 20;
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .order("desc")
      .take(limit);

    return messages.reverse();
  },
});

export const internalGetByPlatformMessageId = internalQuery({
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
    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      throw new Error("Thread not found");
    }
    await requireShopAccess(ctx, thread.shopId);

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

    if (thread) {
      const unreadCount =
        args.role === "assistant" ? 0 : (thread.unreadCount ?? 0) + 1;

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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    const thread = await ctx.runQuery(api.threads.get, {
      threadId: args.threadId,
    });
    if (!thread) {
      throw new Error(`Thread not found: ${args.threadId}`);
    }

    // api.threads.get above enforced shop access; the token is read
    // internally because public shop reads never include credentials.
    const shop = await ctx.runQuery(internal.shops.internalGet, {
      shopId: thread.shopId,
    });
    if (!shop) {
      throw new Error(`Shop not found for thread: ${args.threadId}`);
    }

    // Outside Meta's 24h window, staff replies need the HUMAN_AGENT tag.
    const lastCustomerMessageAt = await ctx.runQuery(
      internal.messages.internalLastCustomerMessageAt,
      { threadId: args.threadId },
    );
    const humanAgentTag =
      lastCustomerMessageAt === null ||
      Date.now() - lastCustomerMessageAt > STANDARD_MESSAGING_WINDOW_MS;

    // Throws if Meta rejects the send, so failures reach Studio and nothing
    // is recorded as sent.
    const { messageId: platformMessageId } = await sendMetaMessage({
      recipientId: thread.platformUserId,
      text: args.content,
      accessToken: shop.metaPageAccessToken,
      humanAgentTag,
    });

    const result = await ctx.runMutation(
      internal.messages.saveHumanAgentMessage,
      {
        threadId: args.threadId,
        content: args.content,
        platformMessageId,
      },
    );
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
  handler: async (ctx, args): Promise<{ success: boolean; jobId: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    const thread = await ctx.runQuery(api.threads.get, {
      threadId: args.threadId,
    });
    if (!thread) {
      throw new Error(`Thread not found: ${args.threadId}`);
    }

    // api.threads.get above enforced shop access.
    const newJobId = await ctx.runMutation(
      internal.pendingMessages.enqueueSimulated,
      { threadId: args.threadId, content: args.content },
    );

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
    platformMessageId: v.optional(v.string()),
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
      platformMessageId: args.platformMessageId,
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
    // api.threads.get enforces shop access for the caller.
    const thread = await ctx.runQuery(api.threads.get, {
      threadId: args.threadId,
    });
    if (!thread) {
      throw new Error(`Thread not found: ${args.threadId}`);
    }
    const message = await ctx.runQuery(internal.messages.internalGetById, {
      messageId: args.messageId,
    });
    if (!message || message.threadId !== args.threadId) {
      throw new Error("Message does not belong to this thread");
    }

    // Call the internal action to regenerate the AI response
    const result: { success: boolean; messageIds: string[] } =
      await ctx.runAction(internal.scheduledActions.retryMessage, {
        threadId: args.threadId,
        messageId: args.messageId,
      });

    return result;
  },
});

// ─── Internal variants for use by scheduled actions (no user auth required) ───

export const internalGetById = internalQuery({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.messageId);
  },
});

export const internalListByThread = internalQuery({
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

export const internalAddMessage = internalMutation({
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
    const { threadId, ...message } = args;
    return await insertThreadMessage(ctx, threadId, message);
  },
});

/** Timestamp of the customer's most recent message, or null if none. */
export const internalLastCustomerMessageAt = internalQuery({
  args: { threadId: v.id("threads") },
  handler: async (ctx, args): Promise<number | null> => {
    const recent = ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .order("desc");
    for await (const message of recent) {
      if (message.role === "user") return message.timestamp;
    }
    return null;
  },
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maintenance: rebuild aggregates. Internal only; run from the dashboard or
 * `npx convex run messages:backfillMessageAggregates`.
 */
export const backfillMessageAggregates = internalMutation({
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
