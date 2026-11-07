# Game ON Creator

Developer publishing portal and internal Game ON moderation console.

- Local development: from the repository root, run `npm install` once and then `npm run dev:creator` (port 3001).
- Creator workspace: `/`.
- Internal moderation console: `/admin` (requires a Supabase Auth account UUID listed in `GAMEON_ADMIN_USER_IDS`).
- Admin API: `/api/admin/moderation` (server-side auth verification; never exposes the service-role key to the browser).

Configure `.env.local` using `.env.example`. The `SUPABASE_SERVICE_ROLE_KEY` and `GAMEON_ADMIN_USER_IDS` are server-only environment variables. Never prefix secrets with `NEXT_PUBLIC_`.

Apply all shared Supabase migrations in order. Full build, live integration, security and manual moderation tests are still required before production use.

## MVP 0.9 sales and refund review

- `Sales & earnings` is an authenticated, per-studio summary. It counts only server-verified paid orders.
- `/admin/refunds` is an administrator-only refund queue. Set `GAMEON_ADMIN_USER_IDS` to authorised Supabase Auth UUIDs before using it.
- Refund processing submits a full refund request to Paystack. A `processed` provider status, not an admin button click, is what marks the order refunded and removes its entitlement.
- Developer net is the order amount less the proposed Game ON commission snapshot; it excludes provider processing fees, taxes, chargebacks and payouts. No automatic developer transfer is enabled in MVP 0.9.

## MVP 0.9.1 refund safety

The `/admin/refunds` processing endpoint atomically claims a request before calling Paystack. If the provider times out or returns an ambiguous response, the request moves to `needs_attention`; an operator must reconcile the Paystack Dashboard before retrying. This avoids blindly issuing a duplicate full refund. Developer net shown in Sales & earnings is an estimate, not a payable wallet balance, and no automated payout is available.
