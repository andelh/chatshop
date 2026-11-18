import { type Infer, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { isWithinBusinessHours } from "./lib/businessHours";
import { BATCH_DELAY_MS, BATCH_LOCK_STALE_MS } from "./lib/pipeline";
import {
  findShopForPage,
  getOrCreateThread,
  insertThreadMessage,
  isKnownPlatformMessage,
} from "./lib/threadMessages";

/**
 * Inbound message pipeline, step by step:
 *
 * 1. `enqueue` (webhook) / `enqueueSimulated` (Studio) insert a pending row
 *    and (re)start the thread's BATCH_DELAY_MS timer, all in one transaction.
 * 2. When the timer fires, scheduledActions.processPendingMessages calls
 *    `claimBatch`, which moves exactly the rows it saw into `messages` (one
 *    row per customer message, so every mid is stored) and takes the thread's
 *    batch lock.
 * 3. The action generates and sends the reply, then calls `finishBatch` to
 *    release the lock. Messages that arrived meanwhile are still pending and
 *    have their own job scheduled. If the action dies without finishing,
 *    `expireBatch` hands the thread off and releases the lock.
 */

/** Arguments of scheduledActions.processPendingMessages. */
const jobArgs = v.object({
  threadId: v.id("threads"),
  senderId: v.string(),
  pageId: v.string(),
  platform: v.string(),
  simulateOnly: v.optional(v.boolean()),
});
type JobArgs = Infer<typeof jobArgs>;

/** Job arguments plus the claim's lock token (its batchStartedAt). */
const lockArgs = { ...jobArgs.fields, lockToken: v.number() };

const platformValidator = v.union(
  v.literal("messenger"),
  v.literal("instagram"),
);

/** The thread's recorded job, if it is still waiting to run. */
async function pendingJobId(
  ctx: MutationCtx,
  thread: Doc<"threads">,
): Promise<Id<"_scheduled_functions"> | null> {
  if (!thread.scheduledJobId) return null;
  const jobId = ctx.db.system.normalizeId(
    "_scheduled_functions",
    thread.scheduledJobId,
  );
  if (!jobId) return null;
  const job = await ctx.db.system.get(jobId);
  return job?.state.kind === "pending" ? jobId : null;
}

async function hasPendingJob(
  ctx: MutationCtx,
  thread: Doc<"threads">,
): Promise<boolean> {
  return (await pendingJobId(ctx, thread)) !== null;
}

/** Cancel the thread's waiting job, if any, and schedule a fresh one. */
async function restartBatchTimer(
  ctx: MutationCtx,
  thread: Doc<"threads">,
  args: JobArgs,
): Promise<string> {
  const waitingJobId = await pendingJobId(ctx, thread);
  if (waitingJobId) {
    await ctx.scheduler.cancel(waitingJobId);
  }
  const newJobId = await ctx.scheduler.runAfter(
    BATCH_DELAY_MS,
    internal.scheduledActions.processPendingMessages,
    args,
  );
  await ctx.db.patch(thread._id, { scheduledJobId: newJobId });
  return newJobId;
}

async function addPendingRow(
  ctx: MutationCtx,
  thread: Doc<"threads">,
  row: { content: string; timestamp: number; platformMessageId?: string },
): Promise<void> {
  // The counter only ever grows, so ordering survives across batches.
  const sequenceNumber = (thread.pendingSequenceCounter ?? 0) + 1;
  await ctx.db.patch(thread._id, { pendingSequenceCounter: sequenceNumber });
  await ctx.db.insert("pending_messages", {
    threadId: thread._id,
    sequenceNumber,
    ...row,
  });
}

/**
 * Queue an inbound customer message from the Meta webhook.
 */
export const enqueue = internalMutation({
  args: {
    platform: platformValidator,
    pageId: v.string(),
    senderId: v.string(),
    content: v.string(),
    platformMessageId: v.optional(v.string()),
    timestamp: v.optional(v.number()),
  },
  returns: v.union(
    v.object({ status: v.literal("queued"), threadId: v.id("threads") }),
    v.object({ status: v.literal("duplicate") }),
    v.object({ status: v.literal("shop_not_found") }),
  ),
  handler: async (
    ctx,
    args,
  ): Promise<
    | { status: "queued"; threadId: Id<"threads"> }
    | { status: "duplicate" }
    | { status: "shop_not_found" }
  > => {
    if (
      args.platformMessageId &&
      (await isKnownPlatformMessage(ctx, args.platformMessageId))
    ) {
      return { status: "duplicate" };
    }

    const shop = await findShopForPage(ctx, args.platform, args.pageId);
    if (!shop) {
      console.error(
        `Shop not found for ${args.platform} pageId: ${args.pageId}`,
      );
      return { status: "shop_not_found" };
    }

    const thread = await getOrCreateThread(ctx, {
      shopId: shop._id,
      platform: args.platform,
      platformUserId: args.senderId,
    });

    await addPendingRow(ctx, thread, {
      content: args.content,
      timestamp: args.timestamp ?? Date.now(),
      platformMessageId: args.platformMessageId,
    });
    await restartBatchTimer(ctx, thread, {
      threadId: thread._id,
      senderId: args.senderId,
      pageId: args.pageId,
      platform: args.platform,
    });

    return { status: "queued", threadId: thread._id };
  },
});

/**
 * Queue a simulated customer message from Studio. Runs the same pipeline as
 * real messages, but the reply is stored without being sent to Meta.
 * Callers must check shop access first.
 */
export const enqueueSimulated = internalMutation({
  args: { threadId: v.id("threads"), content: v.string() },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    const thread = await ctx.db.get(args.threadId);
    if (!thread) throw new Error(`Thread not found: ${args.threadId}`);
    const shop = await ctx.db.get(thread.shopId);
    if (!shop) throw new Error(`Shop not found for thread: ${args.threadId}`);

    await addPendingRow(ctx, thread, {
      content: args.content,
      timestamp: Date.now(),
    });

    const pageId =
      thread.platform === "instagram"
        ? (shop.instagramAccountId ?? shop.metaPageId)
        : shop.metaPageId;

    return await restartBatchTimer(ctx, thread, {
      threadId: thread._id,
      senderId: thread.platformUserId,
      pageId,
      platform: thread.platform,
      simulateOnly: true,
    });
  },
});

export type ClaimResult =
  | { status: "claimed"; messageCount: number; lockToken: number }
  | { status: "empty" }
  | { status: "busy" }
  | {
      status: "skipped";
      reason:
        | "shop_paused"
        | "auto_reply_off"
        | "outside_hours"
        | "thread_paused";
    };

/**
 * Start processing a thread's batch. Moves the pending rows into `messages`
 * and deletes exactly those rows, in one transaction, then takes the batch
 * lock. If another run holds the lock, re-schedules this one instead.
 */
export const claimBatch = internalMutation({
  args: jobArgs.fields,
  handler: async (ctx, args): Promise<ClaimResult> => {
    const thread = await ctx.db.get(args.threadId);
    if (!thread) throw new Error(`Thread not found: ${args.threadId}`);

    if (thread.batchStartedAt !== undefined) {
      // Another run is mid-reply. Try again once it has (probably) finished,
      // unless a newer message has already scheduled a run.
      if (!(await hasPendingJob(ctx, thread))) {
        await restartBatchTimer(ctx, thread, args);
      }
      return { status: "busy" };
    }

    // The recorded job is this run (or a dead one); forget it so new
    // messages schedule a fresh run instead of cancelling this one.
    if (!(await hasPendingJob(ctx, thread))) {
      await ctx.db.patch(thread._id, { scheduledJobId: undefined });
    }

    const rows = await ctx.db
      .query("pending_messages")
      .withIndex("by_thread_sequence", (q) => q.eq("threadId", args.threadId))
      .order("asc")
      .collect();
    if (rows.length === 0) {
      return { status: "empty" };
    }

    // Stored order must be conversation order. A message that arrived while
    // the previous reply was generating is older than that reply, so stamp
    // it just after the latest stored message.
    let latest = thread.lastMessageAt;
    for (const row of rows) {
      const timestamp = Math.max(row.timestamp, latest + 1);
      latest = timestamp;
      await insertThreadMessage(ctx, args.threadId, {
        role: "user",
        content: row.content,
        timestamp,
        platformMessageId: row.platformMessageId,
      });
      await ctx.db.delete(row._id);
    }

    const shop = await ctx.db.get(thread.shopId);
    if (shop?.settings.agentPaused) {
      return { status: "skipped", reason: "shop_paused" };
    }
    // The messages above stay stored for staff either way.
    if (shop && !shop.settings.autoReplyEnabled) {
      return { status: "skipped", reason: "auto_reply_off" };
    }
    if (
      shop &&
      !isWithinBusinessHours(shop.settings.businessHours, Date.now())
    ) {
      return { status: "skipped", reason: "outside_hours" };
    }
    const agentStatus = thread.agentStatus ?? "active";
    if (agentStatus === "paused" || agentStatus === "handoff") {
      return { status: "skipped", reason: "thread_paused" };
    }

    const lockToken = Date.now();
    await ctx.db.patch(thread._id, { batchStartedAt: lockToken });
    await ctx.scheduler.runAfter(
      BATCH_LOCK_STALE_MS,
      internal.pendingMessages.expireBatch,
      { ...args, lockToken },
    );
    return { status: "claimed", messageCount: rows.length, lockToken };
  },
});

/**
 * Release the batch lock if this claim still holds it. Defensive: if rows are
 * pending with no run scheduled for them, schedule one.
 */
async function releaseBatch(
  ctx: MutationCtx,
  { lockToken, ...args }: JobArgs & { lockToken: number },
): Promise<void> {
  const thread = await ctx.db.get(args.threadId);
  if (!thread || thread.batchStartedAt !== lockToken) return;
  await ctx.db.patch(thread._id, { batchStartedAt: undefined });

  const stillPending = await ctx.db
    .query("pending_messages")
    .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
    .first();
  if (stillPending && !(await hasPendingJob(ctx, thread))) {
    await restartBatchTimer(ctx, thread, args);
  }
}

/** Called by the batch action when it's done, whether it replied or failed. */
export const finishBatch = internalMutation({
  args: lockArgs,
  handler: async (ctx, args): Promise<void> => {
    await releaseBatch(ctx, args);
  },
});

/**
 * Scheduled by claimBatch. If the claim's lock is still held, the action died
 * (crash or timeout) after storing the customer's messages but before
 * replying: hand the thread to a human so they aren't left unanswered.
 */
export const expireBatch = internalMutation({
  args: lockArgs,
  handler: async (ctx, args): Promise<void> => {
    const thread = await ctx.db.get(args.threadId);
    if (thread?.batchStartedAt !== args.lockToken) return;
    console.error(
      `Batch for thread ${args.threadId} never finished; handing off`,
    );
    await ctx.db.patch(args.threadId, {
      agentStatus: "handoff",
      agentPausedAt: Date.now(),
      agentPausedReason: "AI reply did not finish",
    });
    await releaseBatch(ctx, args);
  },
});
