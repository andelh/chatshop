import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { httpAction, internalAction } from "./_generated/server";
import { verifyMetaSignature } from "./lib/metaSignature";

type Platform = "messenger" | "instagram";

type QueueResult =
  | { success: true; threadId: Id<"threads"> }
  | { success: false; reason: "shop_not_found" | "duplicate" };

/** The parts of a Meta webhook payload this handler reads. */
type MetaWebhookBody = {
  object?: unknown;
  entry?: Array<{
    id: string;
    messaging?: Array<{
      sender?: { id: string };
      message?: { mid?: string; text?: unknown; is_echo?: boolean };
    }>;
  }>;
};

function platformForObject(object: unknown): Platform | null {
  switch (object) {
    case "page":
      return "messenger";
    case "instagram":
      return "instagram";
    default:
      return null;
  }
}

/**
 * GET /webhooks/meta — Meta's subscription handshake.
 * The verify token comes from the META_WEBHOOK_VERIFY_TOKEN env var; if it is
 * unset every handshake is rejected.
 */
export const metaWebhookVerify = httpAction(async (_ctx, request) => {
  const params = new URL(request.url).searchParams;
  const expectedToken = process.env.META_WEBHOOK_VERIFY_TOKEN;

  if (
    expectedToken &&
    params.get("hub.mode") === "subscribe" &&
    params.get("hub.verify_token") === expectedToken
  ) {
    return new Response(params.get("hub.challenge") ?? "", { status: 200 });
  }

  return new Response("Forbidden", { status: 403 });
});

/**
 * POST /webhooks/meta — inbound Messenger and Instagram events.
 * Rejects any request whose X-Hub-Signature-256 does not match the app secret.
 * Fails closed when the secret is not configured.
 */
export const metaWebhook = httpAction(async (ctx, request) => {
  const rawBody = await request.arrayBuffer();
  const bodyText = new TextDecoder().decode(rawBody);

  let body: MetaWebhookBody;
  try {
    body = JSON.parse(bodyText) as MetaWebhookBody;
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const platform = platformForObject(body?.object);
  if (!platform) {
    // Not an object type we handle; acknowledge so Meta doesn't retry.
    return new Response("EVENT_RECEIVED", { status: 200 });
  }

  // Instagram Login apps sign with the Instagram app secret; Instagram
  // messaging through a Facebook Page uses the Meta app secret.
  const appSecret =
    platform === "instagram"
      ? (process.env.INSTAGRAM_APP_SECRET ?? process.env.META_APP_SECRET)
      : process.env.META_APP_SECRET;
  if (!appSecret) {
    console.error("META_APP_SECRET is not set; rejecting webhook");
    return new Response("Server misconfigured", { status: 500 });
  }

  const validSignature = await verifyMetaSignature({
    rawBody,
    signatureHeader: request.headers.get("x-hub-signature-256"),
    appSecret,
  });
  if (!validSignature) {
    return new Response("Invalid signature", { status: 401 });
  }

  for (const entry of body.entry ?? []) {
    const pageId: string = entry.id;
    for (const event of entry.messaging ?? []) {
      // Skip echoes of our own outbound messages and anything the page sent.
      if (event.message?.is_echo || event.sender?.id === pageId) {
        continue;
      }
      const senderId = event.sender?.id;
      const text = event.message?.text;
      if (!senderId || typeof text !== "string" || text.length === 0) {
        continue;
      }

      await ctx.runAction(internal.webhooks.queueIncomingMessage, {
        platform,
        pageId,
        senderId,
        messageText: text,
        platformMessageId: event.message?.mid,
      });
    }
  }

  return new Response("EVENT_RECEIVED", { status: 200 });
});

/**
 * Queue an incoming message for batch processing. Internal only: reached from
 * the signed webhook handler above, never directly from a client.
 */
export const queueIncomingMessage = internalAction({
  args: {
    platform: v.union(v.literal("messenger"), v.literal("instagram")),
    pageId: v.string(),
    senderId: v.string(),
    messageText: v.string(),
    platformMessageId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<QueueResult> => {
    if (args.platformMessageId) {
      const existing = await ctx.runQuery(
        internal.messages.internalGetByPlatformMessageId,
        { platformMessageId: args.platformMessageId },
      );
      if (existing) {
        console.log("Skipping duplicate message:", args.platformMessageId);
        return { success: false, reason: "duplicate" };
      }
    }

    const shop: Doc<"shops"> | null =
      args.platform === "messenger"
        ? await ctx.runQuery(internal.shops.internalGetByMetaPageId, {
            metaPageId: args.pageId,
          })
        : await ctx.runQuery(internal.shops.internalGetByInstagramAccountId, {
            instagramAccountId: args.pageId,
          });

    if (!shop) {
      console.error(
        `Shop not found for ${args.platform} pageId: ${args.pageId}`,
      );
      return { success: false, reason: "shop_not_found" };
    }

    const threadId: Id<"threads"> = await ctx.runMutation(
      internal.threads.internalGetOrCreate,
      {
        shopId: shop._id,
        platform: args.platform,
        platformUserId: args.senderId,
      },
    );

    const thread = await ctx.runQuery(internal.threads.internalGet, {
      threadId,
    });
    if (thread?.scheduledJobId) {
      try {
        await ctx.runAction(internal.scheduler.cancelScheduledJob, {
          jobId: thread.scheduledJobId,
        });
      } catch (error) {
        console.error("Error cancelling existing scheduled job:", error);
      }
    }

    const sequenceNumber = await ctx.runMutation(
      internal.threads.internalGetNextSequenceNumber,
      { threadId },
    );

    await ctx.runMutation(internal.pendingMessages.addPendingMessage, {
      threadId,
      content: args.messageText,
      timestamp: Date.now(),
      platformMessageId: args.platformMessageId,
      sequenceNumber,
    });

    const newJobId = await ctx.runAction(
      internal.scheduler.scheduleMessageProcessing,
      {
        threadId,
        senderId: args.senderId,
        pageId: args.pageId,
        platform: args.platform,
      },
    );

    await ctx.runMutation(internal.threads.internalUpdateScheduledJob, {
      threadId,
      jobId: newJobId,
    });

    return { success: true, threadId };
  },
});
