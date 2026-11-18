# Shop onboarding: Meta login and Shopify install

Status: design note. Today an owner pastes a Storefront token, a Page ID, a Page access token and an optional Instagram account ID into **Shops → Add shop** (`shops.create`). This note sketches how to replace that with two "Connect" buttons. Nothing here is built yet.

## Goals

- An owner connects a Facebook Page (and its Instagram account) and a Shopify store without copying tokens.
- Tokens are created and stored server-side only. They never reach the browser, the same as today (`toPublicShop` strips them).
- A revoked or expired connection shows up in the Shops page instead of failing silently in the pipeline.

## Shared pieces

- **Where the callbacks run:** Convex HTTP actions (`convex/http.ts`), so the app secrets stay in the Convex deployment like `META_APP_SECRET` does now. Next.js only links to the start URL.
- **CSRF state:** a new `oauthStates` table `{ userId, shopId?, provider, nonce, expiresAt }`. A mutation creates the row and returns the provider's authorize URL. The callback looks up the nonce, checks it hasn't expired, deletes it, and acts as that user. Both providers need this.
- **Connection status on `shops`:** add `metaConnection` and `shopifyConnection`, each `{ status: "connected" | "needs_reconnect", connectedAt, lastError? }`. The pipeline sets `needs_reconnect` when Meta returns error code 190 or Shopify returns 401, and the Shops page shows a Reconnect button. Handoff emails could tell owners at the same time.
- **Create flow:** "Add shop" asks for the assistant profile first and creates the shop with no credentials and both connections at `needs_reconnect`. `claimBatch` would skip such shops, the same way it skips paused ones today. The two Connect buttons then fill the credentials in. `shops.create` keeps the manual fields as a fallback for development.

## Meta: Facebook Login for Business

The app already sends Instagram DMs through the Page (`graph.facebook.com`, Page token), so one Facebook login covers both channels.

1. **Start:** redirect to `https://www.facebook.com/v26.0/dialog/oauth` with `client_id`, `redirect_uri` (the Convex HTTP action), `state` and a Login for Business `config_id`. The configuration requests:
   - `pages_show_list`, `pages_manage_metadata`, `pages_messaging`;
   - `instagram_basic`, `instagram_manage_messages`;
   - `business_management` if the Page belongs to a business portfolio.
2. **Callback:** check `state`. Exchange `code` for a user token (`GET /oauth/access_token`), then for a long-lived user token (`grant_type=fb_exchange_token`).
3. **Pick a Page:** `GET /me/accounts?fields=id,name,access_token,instagram_business_account`. Page tokens obtained from a long-lived user token don't expire. If there's more than one Page, store the list briefly (keyed by the state row) and show a picker. Refuse a Page that another shop already uses; `shops.create` already enforces this with the `by_meta_page` index.
4. **Save and subscribe:** store `metaPageId`, `metaPageAccessToken` and `instagramAccountId` from `instagram_business_account.id`. Call `POST /{page-id}/subscribed_apps?subscribed_fields=messages,message_echoes` with the Page token, so webhooks start arriving without the manual step in the README.
5. **Lifecycle:**
   - Register the app's deauthorize and data-deletion callbacks. On deauthorize, mark the shop `needs_reconnect` and pause the agent.
   - A Page token stops working when the user changes their password, loses their Page role or removes the app. Each surfaces as error 190.

Before launch, `pages_messaging` and `instagram_manage_messages` need Advanced Access through App Review, and the business needs Business Verification. Until then, only people with a role on the Meta app can connect.

## Shopify: app install

1. **App:** a Shopify app using the authorization code grant. A non-embedded app is enough, since owners work in Chatshop rather than the Shopify admin. Use custom distribution while it serves a few stores; switch to a public listing later.
2. **Start:** the owner enters `<store>.myshopify.com`. Check it matches `^[a-z0-9][a-z0-9-]*\.myshopify\.com$`, then redirect to `https://{shop}/admin/oauth/authorize` with `client_id`, `scope`, `redirect_uri` and `state`. Scopes:
   - `unauthenticated_read_product_listings`, `unauthenticated_read_product_inventory` for the Storefront token;
   - `read_orders` only if order-status lookup is built (see below).
3. **Callback:** verify the `hmac` query parameter with the app secret, check `state`, and re-check the `shop` hostname. `POST https://{shop}/admin/oauth/access_token` returns an offline Admin API token.
4. **Mint a Storefront token:** call the Admin GraphQL `storefrontAccessTokenCreate` mutation. Store that token as `shopifyAccessToken`. Build `shopifyDomain` as `https://{shop}/api/{version}/graphql.json` with a pinned version, so the owner never types a URL.
5. **Keep the Admin token?** Only if a feature needs it. Today's tools use the Storefront API alone. If kept, store it in its own field, never returned by `toPublicShop`.
6. **Webhooks:**
   - `app/uninstalled`: clear the Shopify tokens and mark the shop `needs_reconnect`.
   - The mandatory privacy webhooks `customers/data_request`, `customers/redact` and `shop/redact`. Answer the first two from `threads` and `messages` for that customer, and delete the shop's data on `shop/redact`.

## Order-status lookup (not built)

The step 5 brief lists this as optional. It needs the Admin API with `read_orders`, which the manual Storefront token can't do. Customer identity is also weak in a DM: the agent should ask for the order number plus the email or phone on the order, and match both before reading anything out. It fits after the Shopify install above, as a `lookupOrder` tool next to the Storefront tools.

## Open questions

- **Proof of Page ownership:** `shops.create` takes the Page ID and Instagram account ID on trust. Webhooks are routed by those IDs, so a shop that claims another business's Page, before that business connects, would receive its DMs. A pasted token for a different Page wouldn't be able to reply, but the messages would still be stored. This is acceptable only while sign-up is allowlisted. The Facebook Login flow above fixes it, because the IDs come from `/me/accounts`. A cheaper interim check is for `create` to call `GET /me?fields=id` with the pasted Page token and require the result to match `metaPageId`.
- **Fixing credentials:** there's no edit screen for credentials yet. A mistyped token means editing the row in the Convex dashboard.
- **Model settings:** with self-serve shops, any owner can change the global model and its spend (`requireAnyShopOwner`). Model choice probably needs to become per-shop, or limited to a platform admin, before outside stores join.
- **Encryption at rest:** tokens are plain fields today. If we encrypt them, the key should live in a Convex env var, with decryption only in internal queries.
