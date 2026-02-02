// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Global application settings (single row)
  app_settings: defineTable({
    // AI Model Configuration
    aiProvider: v.string(), // "openai" | "google"
    aiModel: v.string(), // e.g., "gpt-5.2", "gemini-2.0-flash"
    providerOptions: v.optional(
      v.object({
        openaiReasoningEffort: v.optional(v.string()), // "low" | "medium" | "high"
        googleThinkingLevel: v.optional(v.string()), // "low" | "medium" | "high"
      }),
    ),
    updatedAt: v.number(),
  }),

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
      // Shop-wide agent pause controls
      agentPaused: v.optional(v.boolean()),
      agentPausedAt: v.optional(v.number()),
      agentPausedReason: v.optional(v.string()),
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

    // Scheduling state for message batching
    scheduledJobId: v.optional(v.string()),
    pendingSequenceCounter: v.optional(v.number()),

    // Agent status for human-in-the-loop
    agentStatus: v.optional(
      v.union(
        v.literal("active"), // AI responding normally
        v.literal("paused"), // Human has taken over
        v.literal("handoff"), // AI requested handoff
        v.literal("pending_human"), // Waiting for human response
      ),
    ),
    agentPausedAt: v.optional(v.number()),
    agentPausedReason: v.optional(v.string()),
    lastHumanMessageAt: v.optional(v.number()),
    hasHumanIntervention: v.optional(v.boolean()),
  })
    .index("by_shop_and_user", ["shopId", "platformUserId"])
    .index("by_shop_platform_user", ["shopId", "platform", "platformUserId"])
    .index("by_shop_status", ["shopId", "status", "lastMessageAt"]),

  // Pending messages queue for batching rapid user messages
  pending_messages: defineTable({
    threadId: v.id("threads"),
    content: v.string(),
    timestamp: v.number(),
    platformMessageId: v.optional(v.string()),
    // Sequence number for preserving message order when batching
    sequenceNumber: v.number(),
  })
    .index("by_thread", ["threadId"])
    .index("by_thread_sequence", ["threadId", "sequenceNumber"]),

  // Individual messages within threads
  messages: defineTable({
    threadId: v.id("threads"),

    role: v.union(
      v.literal("user"), // Customer
      v.literal("assistant"), // AI Agent
      v.literal("human_agent"), // Human agent via dashboard
    ),
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
  })
    .index("by_thread", ["threadId", "timestamp"])
    .index("by_platform_message_id", ["platformMessageId"]),
});
