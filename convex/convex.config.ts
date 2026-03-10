import aggregate from "@convex-dev/aggregate/convex.config.js";
import { defineApp } from "convex/server";
import betterAuth from "./betterAuth/convex.config";

const app = defineApp();
app.use(betterAuth);
app.use(aggregate, { name: "messagesByThread" });
app.use(aggregate, { name: "tokensByThread" });
app.use(aggregate, { name: "costByThread" });

export default app;
