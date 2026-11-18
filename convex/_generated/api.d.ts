/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as aggregates from "../aggregates.js";
import type * as auth from "../auth.js";
import type * as http from "../http.js";
import type * as lib_agent_assistant from "../lib/agent/assistant.js";
import type * as lib_agent_shopPrompt from "../lib/agent/shopPrompt.js";
import type * as lib_agent_shopifyTools from "../lib/agent/shopifyTools.js";
import type * as lib_agent_systemPrompt from "../lib/agent/systemPrompt.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_businessHours from "../lib/businessHours.js";
import type * as lib_messaging from "../lib/messaging.js";
import type * as lib_metaGraph from "../lib/metaGraph.js";
import type * as lib_metaProfile from "../lib/metaProfile.js";
import type * as lib_metaSignature from "../lib/metaSignature.js";
import type * as lib_model_provider from "../lib/model_provider.js";
import type * as lib_pipeline from "../lib/pipeline.js";
import type * as lib_publicShop from "../lib/publicShop.js";
import type * as lib_signup from "../lib/signup.js";
import type * as lib_storefront from "../lib/storefront.js";
import type * as lib_threadMessages from "../lib/threadMessages.js";
import type * as messages from "../messages.js";
import type * as notifications from "../notifications.js";
import type * as pendingMessages from "../pendingMessages.js";
import type * as scheduledActions from "../scheduledActions.js";
import type * as settings from "../settings.js";
import type * as shopMembers from "../shopMembers.js";
import type * as shops from "../shops.js";
import type * as threads from "../threads.js";
import type * as users from "../users.js";
import type * as webhooks from "../webhooks.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  aggregates: typeof aggregates;
  auth: typeof auth;
  http: typeof http;
  "lib/agent/assistant": typeof lib_agent_assistant;
  "lib/agent/shopPrompt": typeof lib_agent_shopPrompt;
  "lib/agent/shopifyTools": typeof lib_agent_shopifyTools;
  "lib/agent/systemPrompt": typeof lib_agent_systemPrompt;
  "lib/auth": typeof lib_auth;
  "lib/businessHours": typeof lib_businessHours;
  "lib/messaging": typeof lib_messaging;
  "lib/metaGraph": typeof lib_metaGraph;
  "lib/metaProfile": typeof lib_metaProfile;
  "lib/metaSignature": typeof lib_metaSignature;
  "lib/model_provider": typeof lib_model_provider;
  "lib/pipeline": typeof lib_pipeline;
  "lib/publicShop": typeof lib_publicShop;
  "lib/signup": typeof lib_signup;
  "lib/storefront": typeof lib_storefront;
  "lib/threadMessages": typeof lib_threadMessages;
  messages: typeof messages;
  notifications: typeof notifications;
  pendingMessages: typeof pendingMessages;
  scheduledActions: typeof scheduledActions;
  settings: typeof settings;
  shopMembers: typeof shopMembers;
  shops: typeof shops;
  threads: typeof threads;
  users: typeof users;
  webhooks: typeof webhooks;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  auth: import("@convex-dev/auth/_generated/component.js").ComponentApi<"auth">;
  authPassword: import("@convex-dev/auth/components/password/_generated/component.js").ComponentApi<"authPassword">;
  authEmail: import("@convex-dev/auth/components/email/_generated/component.js").ComponentApi<"authEmail">;
  resend: import("@convex-dev/resend/_generated/component.js").ComponentApi<"resend">;
  messagesByThread: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"messagesByThread">;
  tokensByThread: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"tokensByThread">;
  costByThread: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"costByThread">;
};
