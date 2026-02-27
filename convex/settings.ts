import { v } from "convex/values";
import type { ModelProvider } from "../lib/models/config";
import { mutation, query } from "./_generated/server";

/**
 * Get the global app settings
 * Returns default settings if none exist
 */
export const getSettings = query({
  args: {},
  handler: async (ctx) => {
    const settings = await ctx.db.query("app_settings").first();

    if (!settings) {
      // Return default settings if none exist
      return {
        aiProvider: "google" as ModelProvider,
        aiModel: "gemini-2.0-flash",
        providerOptions: {
          openaiReasoningEffort: "medium",
          googleThinkingLevel: "high",
        },
        updatedAt: Date.now(),
      };
    }

    return settings;
  },
});

/**
 * Update the AI model configuration
 */
export const updateModelConfig = mutation({
  args: {
    aiProvider: v.string(),
    aiModel: v.string(),
    providerOptions: v.optional(
      v.object({
        openaiReasoningEffort: v.optional(v.string()),
        googleThinkingLevel: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("app_settings").first();

    if (existing) {
      // Update existing settings
      await ctx.db.patch(existing._id, {
        aiProvider: args.aiProvider,
        aiModel: args.aiModel,
        providerOptions: args.providerOptions,
        updatedAt: Date.now(),
      });
    } else {
      // Create new settings
      await ctx.db.insert("app_settings", {
        aiProvider: args.aiProvider,
        aiModel: args.aiModel,
        providerOptions: args.providerOptions,
        updatedAt: Date.now(),
      });
    }

    return {
      success: true,
      provider: args.aiProvider,
      model: args.aiModel,
    };
  },
});
