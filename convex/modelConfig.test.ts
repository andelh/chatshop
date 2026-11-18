import { describe, expect, it } from "vitest";
import {
  calculateModelCost,
  DEFAULT_MODEL_CONFIG,
  getAllModels,
} from "../lib/models/config";
import { internal } from "./_generated/api";
import { getProviderOptions, isValidModel } from "./lib/model_provider";
import { setupConvex } from "./test.setup";

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
