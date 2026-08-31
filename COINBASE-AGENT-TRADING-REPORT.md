# LUCIAN Coinbase Agent Trading Report

Date: 2026-08-30

## Delivered

- Coinbase owner-account authentication without an OAuth Client ID.
- Short-lived ES256 JWT signing for every Coinbase Advanced Trade request.
- Owner-email restriction so another LUCIAN account cannot use the server's Coinbase key.
- Live USD/USDC balance synchronization from Coinbase.
- Postgres-backed Agent Capital that persists across tabs and devices.
- Server-enforced Agent Capital, per-order maximum, permission mode, and emergency stop.
- Coinbase order preview followed by a separate confirmation step.
- Database audit records for previews, submitted orders, failures, and provider order IDs.
- Coinbase fill reconciliation for deployed cash, sellable agent positions, fees, and returned sale proceeds.
- Per-user Postgres advisory locking so simultaneous confirmations cannot spend the same allocation twice.
- Vault controls for Agent Capital, permission mode, and emergency stop.
- Economic Agent commands for allocation, buy, sell, and confirmation.

## Economic Agent commands

Examples:

```text
allocate $50 to agent capital
buy BTC with $10
buy $10 of ETH
sell 0.001 BTC
confirm trade <intent-id-returned-by-lucian>
```

The first buy/sell command only creates a Coinbase preview. No real order is sent until the exact confirmation command is received. Questions such as `should I buy BTC?` never trigger trading.

## Required Vercel environment variables

```dotenv
DATABASE_URL="your-production-postgres-url"
AUTH_SECRET="your-long-random-auth-secret"
AUTH_APP_URL="https://your-production-domain"
LUCIAN_OWNER_EMAIL="the-exact-email-used-by-your-lucian-owner-login"

COINBASE_AUTH_MODE="api-key"
COINBASE_API_KEY_NAME="organizations/ORG_ID/apiKeys/KEY_ID"
COINBASE_API_PRIVATE_KEY="-----BEGIN EC PRIVATE KEY-----\n...\n-----END EC PRIVATE KEY-----"
COINBASE_API_KEY_ALGORITHM="ES256"
COINBASE_API_BASE_URL="https://api.coinbase.com"

TRADING_MODE="live"
NEXT_PUBLIC_TRADING_MODE="live"
LIVE_TRADING_ENABLED="true"
AI_TRADING_ENABLED="true"
MAX_LIVE_ORDER_USD="50"

NEXT_PUBLIC_TRADING_CLOUD_SYNC_ENABLED="true"
NEXT_PUBLIC_WORKSPACE_CLOUD_SYNC_ENABLED="true"
WORKSPACE_MAX_PROJECT_BYTES="26214400"
WORKSPACE_MAX_FILE_BYTES="5242880"
```

Use a Coinbase **ECDSA/ES256** secret API key with **View + Trade** permissions. Do not grant Transfer permission. Do not put Coinbase secrets in a `NEXT_PUBLIC_` variable.

Keep `LIVE_TRADING_ENABLED=false` and `AI_TRADING_ENABLED=false` until the migration and first balance test succeed. Then enable live trading, test the smallest Coinbase-supported manually confirmed order, and only afterward enable AI trading.

## Production deployment

1. Add the variables to Vercel Production.
2. Apply all migrations to the same database used by Vercel:

   ```powershell
   npx prisma migrate deploy
   ```

3. Redeploy the latest commit/package.
4. Sign in using the account whose email exactly matches `LUCIAN_OWNER_EMAIL`.
5. Open Vault → Transfers → Live Agent Capital.
6. Confirm Coinbase available balance appears.
7. Set Agent Capital to a small amount.
8. Keep the agent in Assisted mode for the first test.
9. Ask the Economic Agent to preview a very small buy and review Coinbase's fee.
10. Confirm only when the preview is correct.

The new migration is:

```text
prisma/migrations/20260830020000_agent_capital_api_key/migration.sql
```

## Security boundary

- Full balance visibility does not equal permission to spend it.
- Buys are limited by Agent Capital, Coinbase's actual available USD/USDC, and `MAX_LIVE_ORDER_USD`.
- Sells are limited to quantities acquired through LUCIAN-tracked, Coinbase-filled agent orders.
- Withdrawals and external transfers are not available to the Economic Agent.
- Preview IDs expire and are single-use.
- The emergency stop blocks new previews and executions.
- Concurrent confirmations are serialized in Postgres.

## Verification completed locally

- Prisma schema formatting: passed.
- Prisma schema validation: passed.
- Prisma Client generation: passed.
- TypeScript typecheck: passed.
- ESLint on all changed trading files: passed with zero findings.
- Next.js 16.3.3 production build: passed.
- `npm install` security audit: 0 vulnerabilities.

## Verification still requiring your infrastructure

- Applying the production Postgres migration.
- Authenticating against your real Coinbase key.
- Confirming the key has View + Trade and no Transfer permission.
- Live balance, preview, order, fill, fee, profit/loss, and sell reconciliation using very small amounts.
- Cross-device confirmation using your deployed Vercel app.

No real trade was placed during development because production credentials were not supplied to the local build.
