// Model registry with all supported AI models and their configurations
// Prices are per 1M tokens in USD (input/output)

export type ModelProvider = "openai" | "google";

export interface AIModel {
  id: string;
  name: string;
  provider: ModelProvider;
  description: string;
  pricing: {
    input: number;
    output: number;
  };
  recommended?: boolean;
  maxTokens?: number;
  features?: string[];
}

export interface ProviderConfig {
  id: ModelProvider;
  name: string;
  logo: string;
  models: AIModel[];
}

export const AI_PROVIDERS: ProviderConfig[] = [
  {
    id: "openai",
    name: "OpenAI",
    logo: "openai",
    models: [
      {
        id: "gpt-5.4",
        name: "GPT-5.4",
        provider: "openai",
        description:
          "Frontier model with native computer use and 1M token context. Best for complex professional work. Pricing: $2.50/$15 per 1M tokens.",
        pricing: { input: 2.5, output: 15.0 },
        recommended: true,
        maxTokens: 128000,
        features: ["reasoning", "tools", "computer-use", "high-quality"],
      },
      {
        id: "gpt-5.4-mini",
        name: "GPT-5.4 Mini",
        provider: "openai",
        description:
          "Efficient mini model for coding, computer use, and subagents. Pricing: $0.75/$4.50 per 1M tokens.",
        pricing: { input: 0.75, output: 4.5 },
        maxTokens: 128000,
        features: ["reasoning", "coding", "cost-effective"],
      },
      {
        id: "gpt-5.2",
        name: "GPT-5.2",
        provider: "openai",
        description:
          "Latest frontier model for professional work and long-running agents. Best overall performance. Pricing: $1.75/$14 per 1M tokens.",
        pricing: { input: 1.75, output: 14.0 },
        maxTokens: 128000,
        features: ["reasoning", "tools", "high-quality"],
      },
      {
        id: "gpt-5.1",
        name: "GPT-5.1",
        provider: "openai",
        description:
          "Strong reasoning with excellent instruction following. Great for complex tasks. Pricing: $1.25/$10 per 1M tokens.",
        pricing: { input: 1.25, output: 10.0 },
        maxTokens: 128000,
        features: ["reasoning", "instruction-following"],
      },
      {
        id: "gpt-5",
        name: "GPT-5",
        provider: "openai",
        description:
          "Latest generation model. Good balance of performance and cost. Pricing: $1.25/$10 per 1M tokens.",
        pricing: { input: 1.25, output: 10.0 },
        maxTokens: 128000,
        features: ["reasoning", "balanced"],
      },
      {
        id: "gpt-5-mini",
        name: "GPT-5 Mini",
        provider: "openai",
        description:
          "Faster, cost-efficient version of GPT-5. Pricing: $0.75/$3 per 1M tokens.",
        pricing: { input: 0.75, output: 3.0 },
        maxTokens: 128000,
        features: ["fast", "cost-effective"],
      },
      {
        id: "gpt-5-nano",
        name: "GPT-5 Nano",
        provider: "openai",
        description:
          "Most economical GPT-5 variant for simple tasks. Pricing: $0.15/$0.6 per 1M tokens.",
        pricing: { input: 0.15, output: 0.6 },
        maxTokens: 128000,
        features: ["fastest", "cheapest"],
      },
      {
        id: "gpt-4.1",
        name: "GPT-4.1",
        provider: "openai",
        description:
          "High-performance model with strong reasoning capabilities. Great for complex tasks requiring precision. Pricing: $2.0/$8.0 per 1M tokens.",
        pricing: { input: 2.0, output: 8.0 },
        maxTokens: 128000,
        features: ["reasoning", "precision"],
      },
      {
        id: "gpt-4.1-mini",
        name: "GPT-4.1 Mini",
        provider: "openai",
        description:
          "Compact and efficient version of GPT-4.1. Balanced performance at lower cost. Pricing: $0.4/$1.6 per 1M tokens.",
        pricing: { input: 0.4, output: 1.6 },
        maxTokens: 128000,
        features: ["efficient", "cost-effective"],
      },
      {
        id: "gpt-4.1-nano",
        name: "GPT-4.1 Nano",
        provider: "openai",
        description:
          "Ultra-lightweight GPT-4.1 variant optimized for speed and minimal cost. Pricing: $0.1/$0.4 per 1M tokens.",
        pricing: { input: 0.1, output: 0.4 },
        maxTokens: 128000,
        features: ["fastest", "ultra-cheap"],
      },
      {
        id: "gpt-4o",
        name: "GPT-4o",
        provider: "openai",
        description:
          "Legacy multimodal model. Warm conversational style. Pricing: $2.5/$10 per 1M tokens.",
        pricing: { input: 2.5, output: 10.0 },
        maxTokens: 128000,
        features: ["legacy", "warm-tone"],
      },
      {
        id: "gpt-4o-mini",
        name: "GPT-4o Mini",
        provider: "openai",
        description:
          "Smaller, faster GPT-4o. Great for everyday tasks. Pricing: $0.15/$0.6 per 1M tokens.",
        pricing: { input: 0.15, output: 0.6 },
        maxTokens: 128000,
        features: ["fast", "cost-effective", "multimodal"],
      },
      {
        id: "o3-mini",
        name: "o3 Mini",
        provider: "openai",
        description:
          "Reasoning model for STEM tasks and coding. Pricing: $1.1/$4.4 per 1M tokens.",
        pricing: { input: 1.1, output: 4.4 },
        maxTokens: 128000,
        features: ["reasoning", "coding", "math"],
      },
      {
        id: "o4-mini",
        name: "o4 Mini",
        provider: "openai",
        description:
          "Advanced reasoning with tool use capabilities. Pricing: $1.1/$4.4 per 1M tokens.",
        pricing: { input: 1.1, output: 4.4 },
        maxTokens: 128000,
        features: ["reasoning", "tools", "coding"],
      },
    ],
  },
  {
    id: "google",
    name: "Google",
    logo: "google",
    models: [
      {
        id: "gemini-2.0-flash",
        name: "Gemini 2.0 Flash",
        provider: "google",
        description:
          "Latest flagship model. Fast, capable, and cost-effective. Pricing: $0.35/$0.70 per 1M tokens.",
        pricing: { input: 0.35, output: 0.7 },
        recommended: true,
        maxTokens: 1048576,
        features: ["fast", "multimodal", "cost-effective"],
      },
      {
        id: "gemini-2.0-flash-lite",
        name: "Gemini 2.0 Flash Lite",
        provider: "google",
        description:
          "Ultra cost-effective for high-volume applications. Pricing: $0.075/$0.30 per 1M tokens.",
        pricing: { input: 0.075, output: 0.3 },
        maxTokens: 1048576,
        features: ["cheapest", "high-volume"],
      },
      {
        id: "gemini-1.5-pro",
        name: "Gemini 1.5 Pro",
        provider: "google",
        description:
          "Best for complex reasoning with longest context (2M tokens). Pricing: $3.5/$10.5 per 1M tokens.",
        pricing: { input: 3.5, output: 10.5 },
        maxTokens: 2097152,
        features: ["reasoning", "long-context", "detailed"],
      },
      {
        id: "gemini-1.5-flash",
        name: "Gemini 1.5 Flash",
        provider: "google",
        description:
          "Speed and cost balance for everyday tasks. Pricing: $0.35/$0.70 per 1M tokens.",
        pricing: { input: 0.35, output: 0.7 },
        maxTokens: 1048576,
        features: ["balanced", "fast"],
      },
      {
        id: "gemini-2.5-pro-exp-03-25",
        name: "Gemini 2.5 Pro (Exp)",
        provider: "google",
        description:
          "Experimental cutting-edge model with advanced reasoning. Pricing: $3.5/$10.5 per 1M tokens.",
        pricing: { input: 3.5, output: 10.5 },
        maxTokens: 1048576,
        features: ["experimental", "reasoning", "coding"],
      },
    ],
  },
];

// Default model configuration
export const DEFAULT_MODEL_CONFIG = {
  provider: "google" as ModelProvider,
  model: "gemini-2.0-flash",
  providerOptions: {
    openaiReasoningEffort: "medium" as const,
    googleThinkingLevel: "high" as const,
  },
};

// Helper functions
export function getAllModels(): AIModel[] {
  return AI_PROVIDERS.flatMap((provider) => provider.models);
}

export function getModelsByProvider(provider: ModelProvider): AIModel[] {
  const providerConfig = AI_PROVIDERS.find((p) => p.id === provider);
  return providerConfig?.models || [];
}

export function getModelById(modelId: string): AIModel | undefined {
  return getAllModels().find((model) => model.id === modelId);
}

export function getProviderById(
  providerId: ModelProvider,
): ProviderConfig | undefined {
  return AI_PROVIDERS.find((p) => p.id === providerId);
}

export function getRecommendedModel(provider?: ModelProvider): AIModel {
  if (provider) {
    const models = getModelsByProvider(provider);
    return models.find((m) => m.recommended) || models[0];
  }
  return getAllModels().find((m) => m.recommended) || AI_PROVIDERS[0].models[0];
}

export function formatPrice(price: number): string {
  if (price < 1) {
    return `${(price * 100).toFixed(1)}¢`;
  }
  return `$${price.toFixed(2)}`;
}

export function calculateModelCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const model = getModelById(modelId);
  if (!model) return 0;

  const inputCost = (inputTokens / 1_000_000) * model.pricing.input;
  const outputCost = (outputTokens / 1_000_000) * model.pricing.output;
  return inputCost + outputCost;
}
