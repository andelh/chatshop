import { v } from "convex/values";
import { internal } from "./_generated/api";
import { httpAction, internalMutation } from "./_generated/server";
import { verifyMetaSignature } from "./lib/metaSignature";
import { ECHO_GRACE_MS } from "./lib/pipeline";
import {
  findShopForPage,
  getOrCreateThread,
  insertThreadMessage,
  isKnownPlatformMessage,
} from "./lib/threadMessages";

type Platform = "messenger" | "instagram";

type MetaWebhookMessage = {
  mid?: string;
  text?: unknown;
  is_echo?: boolean;
  app_id?: number | string;
  attachments?: unknown[];
};

/** The parts of a Meta webhook payload this handler reads. */
type MetaWebhookBody = {
  object?: unknown;
  entry?: Array<{
    id: string;
    messaging?: Array<{
      sender?: { id: string };
      recipient?: { id: string };
      timestamp?: number;
      message?: MetaWebhookMessage;
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
    // Logged so a wrong or rotated app secret shows up in the Convex logs
    // instead of silently dropping every inbound message.
    console.error(
      `Rejected ${platform} webhook: X-Hub-Signature-256 does not match the app secret`,
    );
    return new Response("Invalid signature", { status: 401 });
  }

  for (const entry of body.entry ?? []) {
    const pageId: string = entry.id;
    for (const event of entry.messaging ?? []) {
      const message = event.message;
      if (!message) continue;

      if (message.is_echo) {
        // Something the page sent: either our own reply or a staff member
        // writing from Meta Business Suite. Decide after a grace period, once
        // our own send has had time to store its mid.
        const customerId: unknown = event.recipient?.id;
        if (typeof customerId !== "string" || !message.mid) continue;
        await ctx.scheduler.runAfter(
          ECHO_GRACE_MS,
          internal.webhooks.recordPageEcho,
          {
            platform,
            pageId,
            customerId,
            platformMessageId: message.mid,
            content: echoContent(message),
            appId:
              message.app_id !== undefined ? String(message.app_id) : undefined,
            timestamp:
              typeof event.timestamp === "number" ? event.timestamp : undefined,
          },
        );
        continue;
      }

      const senderId = event.sender?.id;
      const text = message.text;
      if (
        !senderId ||
        senderId === pageId ||
        typeof text !== "string" ||
        text.length === 0
      ) {
        continue;
      }

      await ctx.runMutation(internal.pendingMessages.enqueue, {
        platform,
        pageId,
        senderId,
        content: text,
        platformMessageId: message.mid,
      });
    }
  }

  return new Response("EVENT_RECEIVED", { status: 200 });
});

function echoContent(message: MetaWebhookMessage): string {
  if (typeof message.text === "string" && message.text.length > 0) {
    return message.text;
  }
  const count = Array.isArray(message.attachments)
    ? message.attachments.length
    : 0;
  return count > 1 ? `[${count} attachments]` : "[attachment]";
}

/**
 * Handle a page echo. If the mid is one we sent and stored, ignore it.
 * Otherwise a person replied from the native inbox (Meta Business Suite):
 * record it as a human_agent message and pause the AI on that thread.
 */
export const recordPageEcho = internalMutation({
  args: {
    platform: v.union(v.literal("messenger"), v.literal("instagram")),
    pageId: v.string(),
    customerId: v.string(),
    platformMessageId: v.string(),
    content: v.string(),
    timestamp: v.optional(v.number()),
    // Meta app that sent the message, when the echo includes it. Logged so
    // automated senders (instant replies, other apps) can be told apart.
    appId: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<"ours" | "recorded" | "shop_not_found"> => {
    if (await isKnownPlatformMessage(ctx, args.platformMessageId)) {
      return "ours";
    }

    const shop = await findShopForPage(ctx, args.platform, args.pageId);
    if (!shop) return "shop_not_found";

    const thread = await getOrCreateThread(ctx, {
      shopId: shop._id,
      platform: args.platform,
      platformUserId: args.customerId,
    });

    console.log(
      `Recording page echo ${args.platformMessageId} as a staff reply ` +
        `(thread ${thread._id}, app_id ${args.appId ?? "none"})`,
    );
    const timestamp = args.timestamp ?? Date.now();
    await insertThreadMessage(ctx, thread._id, {
      role: "human_agent",
      content: args.content,
      timestamp,
      platformMessageId: args.platformMessageId,
    });
    await ctx.db.patch(thread._id, {
      agentStatus: "paused",
      agentPausedAt: Date.now(),
      agentPausedReason: "Staff replied from the Meta inbox",
      hasHumanIntervention: true,
      lastHumanMessageAt: timestamp,
    });
    return "recorded";
  },
});
