// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  shops: defineTable({
    shopifyDomain: v.string(),
    shopifyAccessToken: v.string(),

    // Meta/Messenger credentials
    metaPageId: v.string(),
    metaPageAccessToken: v.string(),

    // Instagram Business Account ID (for IG webhooks)
    instagramAccountId: v.optional(v.string()),

    settings: v.object({
      autoReplyEnabled: v.boolean(),
      businessHours: v.optional(v.any()),
    }),
  })
    .index("by_shopify_domain", ["shopifyDomain"])
    .index("by_meta_page", ["metaPageId"])
    .index("by_instagram_account", ["instagramAccountId"]),

  // Conversation threads
  threads: defineTable({
    shopId: v.id("shops"),
    platform: v.string(), // "messenger", "instagram", "whatsapp"
    platformUserId: v.string(), // The customer's ID on that platform

    status: v.string(), // "active", "resolved", "archived"
    lastMessageAt: v.number(), // Timestamp for sorting

    // Optional metadata
    customerName: v.optional(v.string()),
    unreadCount: v.number(),

    // Thread aggregates (updated on each message)
    totalMessages: v.optional(v.number()),
    totalTokens: v.optional(v.number()),
    totalCostUsd: v.optional(v.number()),
  })
    .index("by_shop_and_user", ["shopId", "platformUserId"])
    .index("by_shop_platform_user", ["shopId", "platform", "platformUserId"])
    .index("by_shop_status", ["shopId", "status", "lastMessageAt"]),

  // Individual messages within threads
  messages: defineTable({
    threadId: v.id("threads"),

    role: v.union(v.literal("user"), v.literal("assistant")), // "user" or "assistant"
    content: v.string(),
    timestamp: v.number(),

    // Meta-specific
    platformMessageId: v.optional(v.string()), // Meta's message ID

    // Optional: track tool usage
    toolCalls: v.optional(v.array(v.any())),

    // Optional: track reasoning/thinking process
    reasoning: v.optional(v.string()),

    // AI metadata for assistant messages
    aiMetadata: v.optional(
      v.object({
        model: v.string(), // e.g., "gpt-5.2"
        totalTokens: v.number(),
        reasoningTokens: v.number(),
        inputTokens: v.number(),
        outputTokens: v.number(),
        costUsd: v.number(), // Calculated cost in USD
      }),
    ),
  }).index("by_thread", ["threadId", "timestamp"]),
});
