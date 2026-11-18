import { Resend } from "@convex-dev/resend";
import { v } from "convex/values";
import { components } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { env, internalMutation, type MutationCtx } from "./_generated/server";

// testMode defaults to true, which only delivers to Resend's test inboxes.
const resend = new Resend(components.resend, {
  apiKey: env.RESEND_API_KEY,
  testMode: false,
});

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Verified emails of everyone on the shop. Rows from before Convex Auth hold
 * ids that match no account; those (and any lookup error) are skipped.
 */
async function memberEmails(
  ctx: MutationCtx,
  shopId: Id<"shops">,
): Promise<string[]> {
  const members = await ctx.db
    .query("shopMembers")
    .withIndex("by_shop", (q) => q.eq("shopId", shopId))
    .collect();
  const emails = new Set<string>();
  for (const member of members) {
    try {
      const email = await ctx.runQuery(
        components.authEmail.verifiedEmails.getPrimaryEmail,
        { userId: member.userId },
      );
      if (email) emails.add(email);
    } catch (error) {
      console.warn(`No email for shop member ${member.userId}:`, error);
    }
  }
  return [...emails];
}

/**
 * Tell a shop's members that the AI handed a conversation to them.
 * Scheduled by threads.internalRequestHandoff when a thread enters handoff,
 * so a failure here can never undo the handoff itself.
 */
export const sendHandoffEmail = internalMutation({
  args: { threadId: v.id("threads"), reason: v.string() },
  returns: v.number(),
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId);
    if (!thread) return 0;
    const recipients = await memberEmails(ctx, thread.shopId);
    if (recipients.length === 0) {
      console.warn(`Handoff on ${args.threadId}: no member emails to notify`);
      return 0;
    }

    const customer = thread.customerName || "A customer";
    const platform =
      thread.platform === "instagram" ? "Instagram" : "Messenger";
    const link = `${env.SITE_URL}/studio-v2/${args.threadId}?shop=${thread.shopId}`;
    const subject = `${customer} needs a reply on ${platform}`;
    const text = [
      `The AI assistant handed this ${platform} conversation to your team.`,
      `Reason: ${args.reason}`,
      `Reply in Studio: ${link}`,
    ].join("\n\n");
    const html = [
      `<p>The AI assistant handed this ${platform} conversation with <strong>${escapeHtml(customer)}</strong> to your team.</p>`,
      `<p><strong>Reason:</strong> ${escapeHtml(args.reason)}</p>`,
      `<p><a href="${escapeHtml(link)}">Reply in Studio</a></p>`,
    ].join("\n");

    for (const to of recipients) {
      await resend.sendEmail(ctx, {
        from: `${env.SENDER_NAME ?? "Chatshop"} <${env.SENDER_EMAIL}>`,
        to,
        subject,
        html,
        text,
      });
    }
    return recipients.length;
  },
});
