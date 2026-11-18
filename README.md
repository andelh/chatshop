# Chatshop

Chatshop answers a store's Instagram and Messenger DMs with an AI agent. The agent looks up live products and stock through the Shopify Storefront API. Staff watch conversations in **Studio**, and can take over or hand back at any time.

- **App:** Next.js 16 (App Router), in `app/` and `components/`.
- **Backend:** [Convex](https://convex.dev), in `convex/`: database, webhooks, the reply pipeline and auth (Convex Auth, email + password).
- **AI:** the [AI SDK](https://ai-sdk.dev). The default model is Claude Opus 5.5 at effort `low`; Settings can switch to OpenAI or Google models.

## How a reply happens

```text
Meta webhook → app/api/webhooks/{messenger,instagram} → Convex /webhooks/meta
  verify the X-Hub-Signature-256 signature
  queue the DM in pending_messages and (re)start an 8s batch timer
  timer fires → processPendingMessages
    claim the batch → model call with Shopify tools → send each part to Meta
    on ||HANDOFF|| or any failure → hand the thread to a human in Studio
```

When staff reply in Studio, the AI pauses on that thread. If staff reply from Meta's own inbox, the echo also pauses it. Replies sent more than 24h after the customer's last message go out with the `HUMAN_AGENT` tag.

## Setup

You need Node 22 and pnpm 10 (`corepack enable`).

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Start Convex. The first run asks you to log in and pick or create a project. It then writes `CONVEX_DEPLOYMENT` and `NEXT_PUBLIC_CONVEX_URL` to `.env.local`:

   ```bash
   pnpm convex:dev
   ```

3. Fill in the environment variables. The two blocks of [`.env.example`](.env.example) go to different places:
   - The **Next.js** block goes in `.env.local`.
   - The **Convex deployment** block is set on the deployment:

     ```bash
     npx convex env set RESEND_API_KEY re_...
     npx convex env set SENDER_EMAIL auth@yourdomain.com
     npx convex env set SITE_URL http://localhost:3000
     npx convex env set ALLOWED_SIGNUP_EMAILS you@example.com
     npx convex env set ANTHROPIC_API_KEY sk-ant-...
     npx convex env set META_WEBHOOK_VERIFY_TOKEN some-random-string
     npx convex env set META_APP_SECRET ...
     ```

4. Run the app and Convex together:

   ```bash
   pnpm dev:all
   ```

5. Create your account at <http://localhost:3000/auth>. The email must be in `ALLOWED_SIGNUP_EMAILS`. Open the validation link from the email to finish sign-up.

6. Add a shop. There's no create-shop screen yet, so insert a row in the `shops` table from the Convex dashboard with:
   - `shopifyDomain`: the Storefront GraphQL endpoint, `https://<store>.myshopify.com/api/<version>/graphql.json`
   - `shopifyAccessToken`: the Storefront API token
   - `metaPageId` and `metaPageAccessToken` for Messenger, plus `instagramAccountId` for Instagram
   - `settings: { autoReplyEnabled: true }`

   Then make yourself its owner:

   ```bash
   npx convex run shopMembers:linkUserByEmail \
     '{"email":"you@example.com","shopId":"<shop id>","role":"owner"}'
   ```

7. Point the Meta app's webhooks at `https://<your app>/api/webhooks/messenger` and `/api/webhooks/instagram`. Use the same verify token as `META_WEBHOOK_VERIFY_TOKEN`.
   - Messenger: subscribe to `messages` and `message_echoes`.
   - Instagram: subscribe to `messages`.

   For local testing, expose port 3000 with a tunnel such as ngrok.

### Adding staff

1. Add their email to `ALLOWED_SIGNUP_EMAILS`.
2. Have them sign up.
3. Link them to the shop with `shopMembers:linkUserByEmail` and `"role": "member"`.

Shop members can always sign in, even after their email is removed from the list. Anyone else is refused at sign-in.

### Changing the model

Settings → Model picks the provider, model and effort for every shop. A saved setting overrides the code default in `lib/models/config.ts`. To go back to the default:

```bash
npx convex run settings:resetModelConfig
```

The provider's API key (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY` or `GOOGLE_GENERATIVE_AI_API_KEY`) must be set on the Convex deployment.

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev:all` | Next.js and `convex dev` together |
| `pnpm test` | Convex function tests (vitest + convex-test) |
| `pnpm lint` | Biome lint and format check |
| `npx tsc --noEmit -p .` | Typecheck the app |
| `npx tsc --noEmit -p convex` | Typecheck the Convex functions |
| `./test-webhook.sh` | Send a signed sample Messenger webhook to a local app (needs `META_APP_SECRET`) |

CI (`.github/workflows/ci.yml`) runs the typechecks, lint and tests on every PR. Vercel builds the app.

## Layout

```text
app/                 routes: landing, /auth, /studio, /settings, /shops, Meta webhook pass-throughs
components/          UI (components/ui is vendored shadcn)
convex/
  webhooks.ts        Meta webhook: signature check, echoes, enqueue
  pendingMessages.ts batching: enqueue, claim, finish
  scheduledActions.ts generate → split → send, handoff on failure
  lib/agent/         system prompt, Shopify tools, model call
  auth.ts, users.ts  Convex Auth and the sign-in allowlist
lib/models/config.ts model registry, prices, default model
```
