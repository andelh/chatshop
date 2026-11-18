import { httpRouter } from "convex/server";
import { metaWebhook, metaWebhookVerify } from "./webhooks";

const http = httpRouter();

http.route({
  path: "/webhooks/meta",
  method: "GET",
  handler: metaWebhookVerify,
});
http.route({ path: "/webhooks/meta", method: "POST", handler: metaWebhook });

export default http;
