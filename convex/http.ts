import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./betterAuth/auth";
import { metaWebhook, metaWebhookVerify } from "./webhooks";

const http = httpRouter();

authComponent.registerRoutes(http, createAuth);

http.route({ path: "/webhooks/meta", method: "GET", handler: metaWebhookVerify });
http.route({ path: "/webhooks/meta", method: "POST", handler: metaWebhook });

export default http;
