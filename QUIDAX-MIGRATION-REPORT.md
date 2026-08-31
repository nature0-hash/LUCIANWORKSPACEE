# Quidax Migration Report

## What changed

LUCIAN's active Vault Money flow now uses Quidax instead of Coinbase for:

- reading the authenticated owner's Quidax wallets and balances;
- requesting a crypto receive address for a selected supported wallet/network;
- preparing an owner-only crypto-send request with password re-verification,
  exact confirmation text, an expiry, a server-side amount limit, and a kill
  switch; and
- preparing Quidax market-order previews for the Economic Agent.

The old Coinbase files are retained temporarily only as inactive legacy code.
They are not used by the Quidax Money view. No database migration is required
for this change; Quidax records are isolated from the old provider records.

## Required Vercel variables

Add these to **Production**. Keep every value quoted below exactly as shown
except for the SecretKey.

```text
QUIDAX_API_SECRET=<paste the Quidax SecretKey directly here>
QUIDAX_API_BASE_URL=https://openapi.quidax.io/exchange-open-api/api/v1
QUIDAX_TRANSFERS_ENABLED=false
QUIDAX_MAX_SEND_USD=50
QUIDAX_SEND_ALLOWED_ASSETS=BTC,ETH,USDT,USDC,SOL
QUIDAX_SEND_ALLOWED_NETWORKS=btc,erc20,trc20,bep20,solana,polygon
QUIDAX_TRADING_QUOTE_CURRENCY=NGN
MAX_LIVE_ORDER_QUOTE=50
```

Keep the existing values below unchanged for the first test:

```text
TRADING_MODE=sandbox
NEXT_PUBLIC_TRADING_MODE=sandbox
LIVE_TRADING_ENABLED=false
AI_TRADING_ENABLED=false
```

`QUIDAX_API_SECRET` is the only Quidax credential LUCIAN needs at runtime.
Do not put it in source code, a `NEXT_PUBLIC_*` variable, a screenshot, or a
chat message.

## First production test

1. Add the variables above and redeploy.
2. Open `/vault` and choose **Money**.
3. Select one crypto wallet and a network that shows as enabled, then click
   **Generate receive address**.
4. If Quidax returns an address, send only a tiny test amount on the exact
   asset/network shown.
5. Refresh and confirm the wallet balance updates before considering any other
   capability.

External sends, live trading, and AI trading remain server-locked during this
test. Do not turn any of their switches on.
