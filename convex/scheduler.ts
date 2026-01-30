import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action } from "./_generated/server";

const BATCH_DELAY_MS = 70000; // 1 minute and 10 seconds to collect messages

/**
 * Schedule the batch processing job to run after the delay.
 * Returns the job ID as a string for cancellation purposes.
 */
export const scheduleMessageProcessing = action({
  args: {
    threadId: v.id("threads"),
    senderId: v.string(),
    pageId: v.string(),
    platform: v.string(),
  },
  handler: async (ctx, args): Promise<string> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scheduledActions = (internal as any).scheduledActions;
    const jobId = await ctx.scheduler.runAfter(
      BATCH_DELAY_MS,
      scheduledActions.processPendingMessages,
      {
        threadId: args.threadId,
        senderId: args.senderId,
        pageId: args.pageId,
        platform: args.platform,
      },
    );

    // Return the job ID as a string
    return jobId as unknown as string;
  },
});

/**
 * Cancel a scheduled job.
 * Used when a new message arrives before the batch window closes.
 */
export const cancelScheduledJob = action({
  args: {
    jobId: v.string(),
  },
  handler: async (ctx, args): Promise<boolean> => {
    // Convert string back to the proper ID type
    await ctx.scheduler.cancel(
      args.jobId as unknown as Id<"_scheduled_functions">,
    );
    return true;
  },
});
