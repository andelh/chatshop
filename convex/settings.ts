import { ConvexError, v } from "convex/values";
import { DEFAULT_MODEL_CONFIG, type ModelProvider } from "../lib/models/config";
import {
  internalMutation,
  internalQuery,
  mutation,
  type QueryCtx,
  query,
} from "./_generated/server";
import { requireAnyShopOwner, requireAuth } from "./lib/auth";
import { isValidModel } from "./lib/model_provider";

function defaultSettings() {
  return {
    aiProvider: DEFAULT_MODEL_CONFIG.provider as string,
    aiModel: DEFAULT_MODEL_CONFIG.model,
    providerOptions: { ...DEFAULT_MODEL_CONFIG.providerOptions } as {
      anthropicEffort?: string;
      openaiReasoningEffort?: string;
      googleThinkingLevel?: string;
    },
    updatedAt: Date.now(),
  };
}

/**
 * Get the global app settings
 * Returns default settings if none exist
 */
async function readSettings(ctx: QueryCtx) {
  const settings = await ctx.db.query("app_settings").first();

  if (!settings) {
    return defaultSettings();
  }

  return settings;
}

export const getSettings = query({
  args: {},
  handler: async (ctx) => {
    await requireAuth(ctx);
    return await readSettings(ctx);
  },
});

/**
 * Settings read for the message pipeline (scheduled actions have no user).
 */
export const internalGetSettings = internalQuery({
  args: {},
  handler: async (ctx) => readSettings(ctx),
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
        anthropicEffort: v.optional(v.string()),
        openaiReasoningEffort: v.optional(v.string()),
        googleThinkingLevel: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    // Settings are global (they apply to every shop), so only shop owners
    // may change them.
    await requireAnyShopOwner(ctx);
    if (!isValidModel(args.aiProvider as ModelProvider, args.aiModel)) {
      throw new ConvexError(
        `Unknown model "${args.aiModel}" for provider "${args.aiProvider}"`,
      );
    }
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

/**
 * Reset the model configuration to the code default (DEFAULT_MODEL_CONFIG in
 * lib/models/config.ts) by deleting the stored row. Run with
 * `npx convex run settings:resetModelConfig`.
 */
export const resetModelConfig = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("app_settings").collect();
    for (const row of rows) {
      await ctx.db.delete(row._id);
    }
    return { deleted: rows.length, now: defaultSettings() };
  },
});
