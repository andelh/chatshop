import { v } from "convex/values";
import type { ModelProvider } from "../lib/models/config";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { type ActionCtx, internalAction } from "./_generated/server";
import {
  buildAiMetadata,
  extractToolCalls,
  logAssistantResult,
  type ModelSettings,
  runShopAssistant,
} from "./lib/agent/assistant";
import type { StorefrontConfig } from "./lib/agent/shopifyTools";
import { sendMetaMessage, sendTypingIndicator } from "./lib/messaging";
import {
  FALLBACK_REPLY,
  parseAssistantReply,
  SPLIT_PART_DELAY_MS,
} from "./lib/pipeline";
import type { ClaimResult } from "./pendingMessages";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** How many earlier messages the model sees besides the current batch. */
const HISTORY_CONTEXT_MESSAGES = 11;

type ReplyTarget = {
  threadId: Id<"threads">;
  recipientId: string;
  accessToken: string | undefined;
  storefront: StorefrontConfig;
  /** Store the reply without sending it to Meta (Studio simulation). */
  simulateOnly: boolean;
};

/**
 * Generate a reply to `history` and deliver it: send each ||SPLIT|| part to
 * Meta, store it once Meta accepts it, then hand off if the model asked to.
 * `progress.partsDelivered` is updated as parts go out, so a caller can tell
 * whether the customer already got something when this throws.
 */
async function generateAndDeliverReply(
  ctx: ActionCtx,
  target: ReplyTarget,
  history: Doc<"messages">[],
  progress: { partsDelivered: number },
): Promise<{ messageIds: Id<"messages">[]; handoffReason: string | null }> {
  if (!target.simulateOnly) {
    await sendTypingIndicator({
      recipientId: target.recipientId,
      accessToken: target.accessToken,
      action: "typing_on",
    });
  }

  const dbSettings = await ctx.runQuery(internal.settings.internalGetSettings);
  const settings: ModelSettings = {
    aiProvider: dbSettings.aiProvider as ModelProvider,
    aiModel: dbSettings.aiModel,
    providerOptions: dbSettings.providerOptions,
  };

  const result = await runShopAssistant({
    history: history.map((message) => ({
      // The model sees staff replies as its own turns.
      role: message.role === "human_agent" ? "assistant" : message.role,
      content: message.content,
    })),
    storefront: target.storefront,
    settings,
  });
  logAssistantResult(result);

  const { parts, handoffReason } = parseAssistantReply(result.text);
  const messageIds: Id<"messages">[] = [];
  const baseTimestamp = Date.now();

  for (let i = 0; i < parts.length; i++) {
    const isFirstPart = i === 0;
    if (!isFirstPart) {
      await sleep(SPLIT_PART_DELAY_MS);
    }

    let platformMessageId: string | undefined;
    if (!target.simulateOnly) {
      // Throws if Meta rejects the send, so nothing is stored as sent.
      ({ messageId: platformMessageId } = await sendMetaMessage({
        recipientId: target.recipientId,
        text: parts[i],
        accessToken: target.accessToken,
      }));
    }
    progress.partsDelivered++;

    messageIds.push(
      await ctx.runMutation(internal.messages.internalAddMessage, {
        threadId: target.threadId,
        role: "assistant",
        content: parts[i],
        timestamp: baseTimestamp + i * 100, // keep parts ordered
        platformMessageId,
        // Reply metadata goes on the first part only.
        reasoning:
          isFirstPart && result.reasoning
            ? JSON.stringify(result.reasoning)
            : undefined,
        toolCalls: isFirstPart ? extractToolCalls(result.steps) : undefined,
        aiMetadata: isFirstPart
          ? buildAiMetadata(settings.aiModel, result)
          : undefined,
      }),
    );
  }

  if (handoffReason) {
    console.log(
      `Handoff requested for thread ${target.threadId}: ${handoffReason}`,
    );
    await ctx.runMutation(internal.threads.internalRequestHandoff, {
      threadId: target.threadId,
      reason: handoffReason,
    });
  }

  if (!target.simulateOnly) {
    await sendTypingIndicator({
      recipientId: target.recipientId,
      accessToken: target.accessToken,
      action: "typing_off",
    });
  }

  return { messageIds, handoffReason };
}

/** Load a thread and the shop credentials needed to reply on it. */
async function loadReplyContext(ctx: ActionCtx, threadId: Id<"threads">) {
  const thread = await ctx.runQuery(internal.threads.internalGet, {
    threadId,
  });
  if (!thread) {
    throw new Error(`Thread not found: ${threadId}`);
  }
  const shop = await ctx.runQuery(internal.shops.internalGet, {
    shopId: thread.shopId,
  });
  if (!shop) {
    throw new Error(`Shop not found for thread: ${threadId}`);
  }
  const storefront: StorefrontConfig = {
    endpoint: shop.shopifyDomain,
    accessToken: shop.shopifyAccessToken,
  };
  return { thread, accessToken: shop.metaPageAccessToken, storefront };
}

/**
 * Reply to a thread's batched customer messages. Scheduled by
 * pendingMessages.enqueue BATCH_DELAY_MS after the customer's latest message.
 */
export const processPendingMessages = internalAction({
  args: {
    threadId: v.id("threads"),
    senderId: v.string(),
    pageId: v.string(),
    platform: v.string(),
    simulateOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<ClaimResult["status"]> => {
    // Moves the pending rows into `messages` and takes the batch lock.
    const claim: ClaimResult = await ctx.runMutation(
      internal.pendingMessages.claimBatch,
      args,
    );
    if (claim.status !== "claimed") {
      console.log(`Batch for thread ${args.threadId}: ${claim.status}`);
      return claim.status;
    }

    const simulateOnly = args.simulateOnly ?? false;
    let accessToken: string | undefined;
    const progress = { partsDelivered: 0 };
    try {
      const replyContext = await loadReplyContext(ctx, args.threadId);
      accessToken = replyContext.accessToken;

      // This whole batch plus the messages before it.
      const history: Doc<"messages">[] = await ctx.runQuery(
        internal.messages.internalListByThread,
        {
          threadId: args.threadId,
          limit: HISTORY_CONTEXT_MESSAGES + claim.messageCount,
        },
      );

      const { messageIds } = await generateAndDeliverReply(
        ctx,
        {
          threadId: args.threadId,
          recipientId: args.senderId,
          accessToken,
          storefront: replyContext.storefront,
          simulateOnly,
        },
        history,
        progress,
      );

      console.log(
        `Replied to ${claim.messageCount} message(s) on thread ${args.threadId} in ${messageIds.length} part(s)`,
      );
      return claim.status;
    } catch (error) {
      console.error(
        `Reply failed for thread ${args.threadId}; handing off:`,
        error,
      );
      await handleReplyFailure(ctx, {
        threadId: args.threadId,
        recipientId: args.senderId,
        accessToken,
        simulateOnly,
        partsDelivered: progress.partsDelivered,
        error,
      });
      throw error;
    } finally {
      await ctx.runMutation(internal.pendingMessages.finishBatch, {
        ...args,
        lockToken: claim.lockToken,
      });
    }
  },
});

/**
 * The customer's messages are already stored (claimBatch). Hand the thread to
 * a human first, so it's flagged even if Meta is down, then tell the customer
 * someone will follow up, unless part of a reply already reached them.
 */
async function handleReplyFailure(
  ctx: ActionCtx,
  args: {
    threadId: Id<"threads">;
    recipientId: string;
    accessToken: string | undefined;
    simulateOnly: boolean;
    partsDelivered: number;
    error: unknown;
  },
): Promise<void> {
  const detail =
    args.error instanceof Error ? args.error.message : String(args.error);
  try {
    await ctx.runMutation(internal.threads.internalRequestHandoff, {
      threadId: args.threadId,
      reason: `AI reply failed: ${detail}`.slice(0, 500),
    });
  } catch (handoffError) {
    console.error("Failed to hand off thread after error:", handoffError);
  }

  if (args.partsDelivered > 0) return;

  try {
    let platformMessageId: string | undefined;
    if (!args.simulateOnly) {
      ({ messageId: platformMessageId } = await sendMetaMessage({
        recipientId: args.recipientId,
        text: FALLBACK_REPLY,
        accessToken: args.accessToken,
      }));
    }
    await ctx.runMutation(internal.messages.internalAddMessage, {
      threadId: args.threadId,
      role: "assistant",
      content: FALLBACK_REPLY,
      timestamp: Date.now(),
      platformMessageId,
    });
  } catch (fallbackError) {
    console.error("Failed to send fallback reply:", fallbackError);
  }
}

/** Index of the last customer message at or before `upTo`, or -1. */
function lastUserIndexAtOrBefore(
  messages: Doc<"messages">[],
  upTo: number,
): number {
  for (let i = upTo; i >= 0; i--) {
    if (messages[i].role === "user") return i;
  }
  return -1;
}

/**
 * Regenerate the AI reply to the last customer message at or before
 * `messageId`, and send it. Errors propagate to Studio.
 */
export const retryMessage = internalAction({
  args: {
    threadId: v.id("threads"),
    messageId: v.id("messages"),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ success: boolean; messageIds: string[] }> => {
    const { thread, accessToken, storefront } = await loadReplyContext(
      ctx,
      args.threadId,
    );

    const recent: Doc<"messages">[] = await ctx.runQuery(
      internal.messages.internalListByThread,
      { threadId: args.threadId, limit: 50 },
    );
    const cutoffIndex = recent.findIndex((m) => m._id === args.messageId);
    if (cutoffIndex === -1) {
      throw new Error("Target message not found in thread history");
    }
    const lastUserIndex = lastUserIndexAtOrBefore(recent, cutoffIndex);
    if (lastUserIndex === -1) {
      throw new Error("No user message found to retry from");
    }
    // Same context window as a normal reply, ending on that customer turn.
    const history = recent.slice(
      Math.max(0, lastUserIndex - HISTORY_CONTEXT_MESSAGES),
      lastUserIndex + 1,
    );

    const { messageIds } = await generateAndDeliverReply(
      ctx,
      {
        threadId: args.threadId,
        recipientId: thread.platformUserId,
        accessToken,
        storefront,
        simulateOnly: false,
      },
      history,
      { partsDelivered: 0 },
    );

    console.log(
      `Retried reply on thread ${args.threadId}: ${messageIds.length} part(s)`,
    );
    return { success: true, messageIds };
  },
});
