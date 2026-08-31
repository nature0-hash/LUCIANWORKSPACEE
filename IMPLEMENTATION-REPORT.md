# LUCIAN Vault, Crypto Markets, and Cloud Projects — Implementation Report

Date: 2026-08-30

## Delivered

- DevWorkspace projects now have authenticated Postgres cloud snapshots. IndexedDB remains the offline cache, while project metadata and file contents synchronize on load, focus, and edits.
- Cloud project writes are user-scoped, size-limited, revisioned, and reject cross-user ID collisions. Conflicts are pulled instead of silently overwriting newer work.
- Virtual Markets accounts, orders, positions, history, profit, and loss now synchronize to each signed-in user's Postgres record instead of existing only in `localStorage`.
- Markets now exposes only crypto instruments and keeps live public crypto price/chart data.
- Vault has a persistent LUCIAN sandbox-funding option. Sandbox cash is stored in a separate ledger account, shown in the balance, and excluded from withdrawable real cash.
- A per-user Coinbase OAuth integration was added with PKCE, CSRF state validation, short-lived secure cookies, AES-256-GCM token encryption, rotating refresh-token support, connection status, and account-balance reads.
- Coinbase live spot order APIs were added. They accept only USD/USDC crypto products, enforce a maximum live order value, require a Coinbase portfolio, and always require preview plus explicit confirmation before execution.
- Live trading and AI live trading have independent server-side kill switches and default to disabled.
- The previous Settings/sidebar cleanup remains intact. Other LUCIAN modules were not redesigned.
- Coinbase owner-account API-key mode now works without an OAuth Client ID. Requests use short-lived, per-request ES256 JWTs and the key is restricted to the configured LUCIAN owner email.
- Real Agent Capital is stored in Postgres and enforced on the server. The agent can read the full Coinbase balance but buys cannot exceed its allocation or per-order ceiling; sells cannot exceed Coinbase-filled positions acquired through tracked agent orders.
- The Economic Agent understands explicit allocation, buy, sell, and confirmation commands. It always creates a Coinbase preview first and requires a separate confirmation message before submission.
- Every live preview/submission is persisted in `LiveTradeIntent` for cross-device audit and fill reconciliation. An emergency stop and permission mode live in `TradingAgentProfile`.

## Important operating modes

### Sandbox (recommended first deployment)

Set `TRADING_MODE=sandbox` and `NEXT_PUBLIC_TRADING_MODE=sandbox`. Users can add non-withdrawable test funds, keep a persistent balance, place virtual crypto trades, and see the account from another signed-in tab/device.

### Live

Live mode requires an approved Coinbase OAuth client, production Postgres, a strong encryption key, completed Coinbase account/KYC setup, and compliance review for every jurisdiction in which the app will be offered. Set `LIVE_TRADING_ENABLED=true` only after Coinbase OAuth connection, preview, order, fill, and reconciliation tests succeed with very small values.

OpenRouter remains an AI-credit provider only; it is not used as a wallet or investment-funding rail. Octa is not used as the trading backend. Card custody was intentionally not implemented through a generic Stripe charge because an investment/trading wallet requires provider approval and regulated money-flow design.

## Database deployment

1. Set `DATABASE_URL` to the production Postgres database.
2. Run `npm ci`.
3. Run `npx prisma migrate deploy`.
4. Run `npx prisma generate`.
5. Configure the environment variables in `ENVIRONMENT-VARIABLES.md` in Vercel.
6. Redeploy.

The migrations include `prisma/migrations/20260830010000_cloud_projects_trading/migration.sql` and `prisma/migrations/20260830020000_agent_capital_api_key/migration.sql`.

## Verification completed

- Prisma client generation: passed.
- Prisma schema validation: passed.
- TypeScript `tsc --noEmit`: passed.
- ESLint on all changed files: passed with zero warnings/errors.
- Production Next.js build: passed.
- Production dependency audit (`npm audit --omit=dev`): 0 vulnerabilities after pinning patched Nodemailer and DOMPurify releases and the patched Prisma CLI merge dependency.
- Vault architecture suite: 52/52 passed.
- Local browser smoke test: unauthenticated `/markets` correctly routes to the sign-in page.

## Vercel cached-Prisma fix

The production build script now runs `prisma generate` before `next build`, and `postinstall` also regenerates the client. This prevents Vercel dependency-cache restores from compiling against an older Prisma Client that does not contain the new cloud-project, sandbox-trading, and exchange-connection models.

## Verification requiring your infrastructure

These cannot be truthfully completed without your production credentials and database:

- Applying the migration to the live Postgres database.
- Cross-device sync using two real signed-in devices.
- Coinbase OAuth approval and callback on the production domain.
- Real Coinbase funding, preview, order, fill, cancellation, profit/loss, and balance reconciliation.
- AI-initiated live trading. Keep it disabled until you approve an exact risk policy and complete legal/compliance review.

## Main files added or changed

- `prisma/schema.prisma`
- `prisma/migrations/20260830010000_cloud_projects_trading/migration.sql`
- `app/api/workspace/projects/*`
- `app/api/trading/sandbox/route.ts`
- `app/api/trading/orders/route.ts`
- `app/api/integrations/coinbase/*`
- `app/api/vault/sandbox-funds/route.ts`
- `src/lib/coinbase/client.ts`
- `src/lib/security/encryption.ts`
- `src/lib/workspace/db.ts`
- `src/lib/markets/paper-trading.ts`
- `src/lib/markets/catalog.ts`
- `src/components/markets/*`
- `src/components/vault/add-money-modal.tsx`

## Security notes

- Never place Coinbase client secrets, OAuth tokens, the encryption key, database credentials, or AI keys in `NEXT_PUBLIC_*` variables.
- Rotate `VAULT_ENCRYPTION_KEY` only with a token re-encryption migration; replacing it directly makes stored exchange tokens unreadable.
- Keep sandbox and live Vercel projects/databases separate where possible.
- Never enable `AI_TRADING_ENABLED` as a substitute for user consent, suitability, jurisdiction checks, position limits, or emergency-stop controls.
