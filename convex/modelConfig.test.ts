import { describe, expect, it } from "vitest";
import {
  calculateModelCost,
  DEFAULT_MODEL_CONFIG,
  getAllModels,
} from "../lib/models/config";
import { api, internal } from "./_generated/api";
import { getProviderOptions, isValidModel } from "./lib/model_provider";
import { setupConvex, signInAs } from "./test.setup";

describe("default model", () => {
  it("is Claude Opus 5.5 at low effort when no settings row exists", async () => {
    const t = setupConvex();
    const settings = await t.query(internal.settings.internalGetSettings, {});
    expect(settings).toMatchObject({
      aiProvider: "anthropic",
      aiModel: "claude-opus-5-5",
      providerOptions: { anthropicEffort: "low" },
    });
  });

  it("resetModelConfig drops a stored row so the code default applies", async () => {
    const t = setupConvex();
    await t.run((ctx) =>
      ctx.db.insert("app_settings", {
        aiProvider: "google",
        aiModel: "gemini-2.0-flash",
        updatedAt: 0,
      }),
    );
    await t.mutation(internal.settings.resetModelConfig, {});
    const settings = await t.query(internal.settings.internalGetSettings, {});
    expect(settings.aiModel).toBe(DEFAULT_MODEL_CONFIG.model);
  });
});

describe("updateModelConfig", () => {
  async function seed() {
    const t = setupConvex();
    const { ownerId, memberId } = await t.run(async (ctx) => {
      const ownerId = await ctx.db.insert("users", {});
      const memberId = await ctx.db.insert("users", {});
      const shopId = await ctx.db.insert("shops", {
        shopifyDomain: "https://example.myshopify.com/api/graphql.json",
        shopifyAccessToken: "shopify_token",
        metaPageId: "page_1",
        metaPageAccessToken: "page_token",
        settings: { autoReplyEnabled: true },
        ownerId,
      });
      await ctx.db.insert("shopMembers", {
        userId: ownerId,
        shopId,
        role: "owner",
      });
      await ctx.db.insert("shopMembers", {
        userId: memberId,
        shopId,
        role: "member",
      });
      return { ownerId, memberId };
    });
    return {
      t,
      owner: t.withIdentity(await signInAs(t, ownerId)),
      member: t.withIdentity(await signInAs(t, memberId)),
    };
  }

  const opusHigh = {
    aiProvider: "anthropic",
    aiModel: "claude-opus-5-5",
    providerOptions: { anthropicEffort: "high" },
  };

  it("lets a shop owner set the effort, which then reaches the model options", async () => {
    const { t, owner } = await seed();
    await owner.mutation(api.settings.updateModelConfig, opusHigh);
    const settings = await t.query(internal.settings.internalGetSettings, {});
    expect(
      getProviderOptions("anthropic", settings.providerOptions).anthropic,
    ).toMatchObject({ effort: "high" });
  });

  it("refuses non-owners and anonymous callers", async () => {
    const { t, member } = await seed();
    await expect(
      member.mutation(api.settings.updateModelConfig, opusHigh),
    ).rejects.toThrow(/owner/i);
    await expect(
      t.mutation(api.settings.updateModelConfig, opusHigh),
    ).rejects.toThrow();
    const settings = await t.query(internal.settings.internalGetSettings, {});
    expect(settings.providerOptions?.anthropicEffort).toBe("low");
  });

  it("rejects a model the provider doesn't offer", async () => {
    const { owner } = await seed();
    await expect(
      owner.mutation(api.settings.updateModelConfig, {
        aiProvider: "anthropic",
        aiModel: "gpt-5.2",
      }),
    ).rejects.toThrow(/Unknown model/);
  });
});

describe("getProviderOptions", () => {
  it("sends adaptive thinking with the stored effort for Anthropic", () => {
    expect(
      getProviderOptions("anthropic", { anthropicEffort: "high" }),
    ).toEqual({
      anthropic: {
        effort: "high",
        thinking: { type: "adaptive", display: "summarized" },
      },
    });
  });

  it("falls back to low effort for a missing or unknown value", () => {
    expect(getProviderOptions("anthropic", {}).anthropic).toMatchObject({
      effort: "low",
    });
    expect(
      getProviderOptions("anthropic", { anthropicEffort: "turbo" }).anthropic,
    ).toMatchObject({ effort: "low" });
  });

  it("only includes the configured provider's options", () => {
    expect(Object.keys(getProviderOptions("openai", {}))).toEqual(["openai"]);
  });
});

describe("pricing", () => {
  it("prices every model the picker offers from the registry", () => {
    expect(calculateModelCost("claude-opus-5-5", 1_000_000, 1_000_000)).toBe(
      24,
    );
    expect(calculateModelCost("claude-sonnet-5-5", 1_000_000, 1_000_000)).toBe(
      12,
    );
    expect(calculateModelCost("claude-haiku-5-5", 1_000_000, 1_000_000)).toBe(
      0.6,
    );
    for (const model of getAllModels()) {
      expect(isValidModel(model.provider, model.id)).toBe(true);
    }
  });

  it("uses $2/$10 for an unknown model rather than hiding its cost", () => {
    expect(calculateModelCost("mystery-model", 1_000_000, 1_000_000)).toBe(12);
  });
});
