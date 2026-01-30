import aggregate from "@convex-dev/aggregate/convex.config.js";
import { defineApp } from "convex/server";

const app = defineApp();
app.use(aggregate, { name: "messagesByThread" });
app.use(aggregate, { name: "tokensByThread" });
app.use(aggregate, { name: "costByThread" });

export default app;
