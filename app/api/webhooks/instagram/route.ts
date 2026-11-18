import {
  forwardMetaEvent,
  forwardMetaVerification,
} from "@/lib/meta/forward-webhook";

// Verification and processing happen in Convex (convex/webhooks.ts).
export const GET = forwardMetaVerification;
export const POST = forwardMetaEvent;
