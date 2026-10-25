# Whop delivery

Share `https://byhyro.com/pago/` as the payment link. It requires a HYRO account, attaches a purchase intent to the fixed Whop plan, and returns the buyer to `/compra/`. Confirmed purchases unlock the existing library and encrypted activation key. Direct Whop links do not include the HYRO purchase intent and cannot deliver a HYRO license automatically.

Plan: `plan_Alosf0V6ZsprM`. Company: `biz_XOirHolBiKU66x`. Existing price and revenue split remain managed in Whop.

The `whop-webhook` Supabase function verifies Whop signatures, retrieves the authoritative payment, validates company/plan/intent, and calls service-only database functions. Duplicate deliveries are idempotent. Full refunds revoke the license and activations; refund tombstones prevent delayed success from restoring refunded purchases.

Server secrets: `WHOP_API_KEY`, `WHOP_WEBHOOK_SECRET`, existing `LICENSE_ENCRYPTION_KEY`, and Supabase's server credentials. Never place these in frontend variables. Subscribe the endpoint to `payment.succeeded`, `refund.created`, and `refund.updated`.

Run `npm run verify:whop`, `npm run check`, and `npm run build`. Unit/database checks cover signatures, payment verification, encrypted keys, duplicate events, refunds, and restricted permissions. Whop's dashboard test checks transport/signatures only; it does not prove a paid purchase or delivery. A real purchase remains the final end-to-end validation.

Currently the existing download library has a Windows installer. Delivery occurs in the HYRO library; this integration does not send a separate license email.

Rollback the frontend to the preceding production commit if needed. Keep the database migration and endpoint available for already initiated purchases and refunds.
