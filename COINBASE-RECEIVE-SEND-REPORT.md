# LUCIAN Coinbase Receive/Send Update

## Implemented

- Owner-scoped Coinbase wallet account listing from Advanced Trade, with
  `/v2/accounts` retained as a compatibility fallback. This handles CDP
  portfolio keys whose legacy account list is empty.
- Coinbase deposit-address generation using
  `POST /v2/accounts/:account_id/addresses`.
- Cross-device database history for generated receive addresses.
- A two-step outbound crypto flow:
  1. server preview and balance/USD-limit validation;
  2. password re-verification plus exact typed confirmation before submission.
- Coinbase sends through `POST /v2/accounts/:account_id/transactions` with a
  unique provider idempotency value.
- Cross-device transfer-intent audit records, including pending, completed,
  rejected, expired, and submission-unknown states.
- Server kill switch, asset allowlist, network allowlist, and maximum USD value.
- Vault Money UI for wallet balances, receive addresses, send confirmation,
  and recent send audit history.

## Security boundaries

- Every route obtains the user ID from the authenticated server session.
- Coinbase API-key mode also checks the session email against
  `LUCIAN_OWNER_EMAIL`.
- The current LUCIAN password must be verified for every outbound send.
- Preview records expire after five minutes and may be submitted only once.
- A PostgreSQL advisory lock prevents two browser tabs from confirming the
  same available funds concurrently.
- The Economic Agent cannot confirm or invoke a transfer: it has no transfer
  tool, no password, and no relationship to `CoinbaseTransferIntent`.
- `COINBASE_TRANSFERS_ENABLED` defaults to false.
- If a provider response is lost after submission, the record becomes
  `submission_unknown`; LUCIAN does not automatically retry an ambiguous send.

## Deployment

Vercel Build Command remains:

```text
npx prisma migrate deploy && npm run build
```

The migration `20260830030000_coinbase_receive_transfers` creates the receive
address and outbound transfer-intent tables.

Keep these values disabled during the first connection test:

```text
TRADING_MODE=sandbox
NEXT_PUBLIC_TRADING_MODE=sandbox
LIVE_TRADING_ENABLED=false
AI_TRADING_ENABLED=false
COINBASE_TRANSFERS_ENABLED=false
```

After the deployment shows the correct Coinbase wallets and a small receive
test succeeds, set `COINBASE_TRANSFERS_ENABLED=true` and redeploy. Start with a
small send well below `COINBASE_MAX_SEND_USD`.
