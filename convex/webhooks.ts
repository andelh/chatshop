import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { api, internal } from "./_generated/api";
import { action } from "./_generated/server";

type QueueResult =
  | { success: true; threadId: Id<"threads"> }
  | { success: false; reason: "shop_not_found" };

/**
 * Queue an incoming webhook message for batch processing.
 * Called by Next.js webhook routes — no user auth required.
 * All DB operations use internal mutations to bypass user auth checks.
 */
export const queueIncomingMessage = action({
  args: {
    platform: v.union(v.literal("messenger"), v.literal("instagram")),
    pageId: v.string(),
    senderId: v.string(),
    messageText: v.string(),
    platformMessageId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<QueueResult> => {
    console.log("here");
    // Find shop by platform identifier
    let shop;
    if (args.platform === "messenger") {
      shop = await ctx.runQuery(api.shops.getByMetaPageId, {
        metaPageId: args.pageId,
      });
    } else {
      shop = await ctx.runQuery(api.shops.getByInstagramAccountId, {
        instagramAccountId: args.pageId,
      });
    }

    if (!shop) {
      console.error(
        `Shop not found for ${args.platform} pageId: ${args.pageId}`,
      );
      return { success: false, reason: "shop_not_found" };
    }
    console.log("about to call threads");

    // Get or create thread (internal — no user auth needed)
    const threadId: Id<"threads"> = await ctx.runMutation(
      internal.threads.internalGetOrCreate,
      {
        shopId: shop._id,
        platform: args.platform,
        platformUserId: args.senderId,
      },
    );

    // Check for existing scheduled batch job
    const thread = await ctx.runQuery(internal.threads.internalGet, {
      threadId,
    });
    const existingJobId = thread?.scheduledJobId;

    if (existingJobId) {
      try {
        await ctx.runAction(api.scheduler.cancelScheduledJob, {
          jobId: existingJobId,
        });
      } catch (error) {
        console.error("Error cancelling existing scheduled job:", error);
      }
    }

    // Get next sequence number for ordered batching
    const sequenceNumber = await ctx.runMutation(
      internal.threads.internalGetNextSequenceNumber,
      { threadId },
    );

    // Add message to pending queue
    await ctx.runMutation(api.pendingMessages.addPendingMessage, {
      threadId,
      content: args.messageText,
      timestamp: Date.now(),
      platformMessageId: args.platformMessageId,
      sequenceNumber,
    });

    console.log(
      `Queued message #${sequenceNumber} for thread ${threadId}. Scheduling batch processing...`,
    );

    // Schedule batch processing
    const newJobId = await ctx.runAction(
      api.scheduler.scheduleMessageProcessing,
      {
        threadId,
        senderId: args.senderId,
        pageId: args.pageId,
        platform: args.platform,
      },
    );

    // Update thread with new job ID
    await ctx.runMutation(internal.threads.internalUpdateScheduledJob, {
      threadId,
      jobId: newJobId,
    });

    console.log("Scheduled batch processing job:", newJobId);
    return { success: true, threadId };
  },
});
