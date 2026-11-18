import aggregate from "@convex-dev/aggregate/convex.config.js";
import authEmail from "@convex-dev/auth/components/email/convex.config.js";
import authPassword from "@convex-dev/auth/components/password/convex.config.js";
import auth from "@convex-dev/auth/convex.config.js";
import resend from "@convex-dev/resend/convex.config.js";
import { defineApp } from "convex/server";
import { v } from "convex/values";

const app = defineApp({
  env: {
    // Convex Auth email + password: sign-up validation and password
    // recovery emails go through Resend.
    RESEND_API_KEY: v.string(),
    SENDER_EMAIL: v.string(), // must be on a domain verified in Resend
    SENDER_NAME: v.optional(v.string()),
    // Where the Next.js app is served; emailed links point here.
    SITE_URL: v.optional(v.string()),
  },
});

app.use(auth);
app.use(authPassword);
app.use(authEmail);
app.use(resend);
app.use(aggregate, { name: "messagesByThread" });
app.use(aggregate, { name: "tokensByThread" });
app.use(aggregate, { name: "costByThread" });

export default app;
