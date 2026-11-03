# Game ON Store

Player-facing Game ON marketplace. Local development: from the repository root, run `npm install` once and then `npm run dev:store` (port 3000).

Configure `.env.local` using `.env.example`. The browser uses only the Supabase publishable/anon key. The server-side signed-download, checkout, order-history, refund-request and payment-fulfilment routes also require `SUPABASE_SERVICE_ROLE_KEY`; this key must never enter client code or any `NEXT_PUBLIC_` variable.

## Player marketplace features

- Published game catalogue, player library and wishlist.
- Game details, reviews, notifications, player profile, and purchase history.
- Approved game release history and secure downloads.
- Paid checkout initialised server-side through Paystack for verified, published NGN-priced listings only.
- Provider verification and signed webhook fulfilment; a browser callback alone never grants a paid entitlement.
- Player refund requests reviewed by authorised Game ON administrators in Creator.

## Payment configuration

Configure server-only `PAYSTACK_SECRET_KEY`, `GAMEON_PLATFORM_FEE_BPS` (proposed default 1000 = 10%, not a final commercial rate), and `GAMEON_STORE_URL`. Configure the Paystack webhook URL as `https://YOUR_STORE_HOST/api/paystack/webhook`. Start in Paystack test mode and exercise successful, abandoned, failed, pending, duplicate and amount/currency-mismatch cases before considering live payment credentials.

MVP 0.9.1 includes safer refund-request claiming and manual reconciliation for ambiguous provider responses. No developer payout transfers are implemented. Never expose `PAYSTACK_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` in a `NEXT_PUBLIC_` variable or browser bundle.
