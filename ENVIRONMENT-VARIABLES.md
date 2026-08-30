# Environment Variables

Use `.env.example` as the complete source list. The variables below are the ones relevant to this delivery.

## Required for accounts, Vault, cloud projects, and persistent trading

```dotenv
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DB?sslmode=require"
AUTH_SECRET="GENERATE_A_LONG_RANDOM_SECRET"
AUTH_APP_URL="https://your-domain.example"

TRADING_MODE="sandbox"
NEXT_PUBLIC_TRADING_MODE="sandbox"
NEXT_PUBLIC_TRADING_CLOUD_SYNC_ENABLED="true"
NEXT_PUBLIC_WORKSPACE_CLOUD_SYNC_ENABLED="true"

WORKSPACE_MAX_PROJECT_BYTES="26214400"
WORKSPACE_MAX_FILE_BYTES="5242880"
```

Generate `AUTH_SECRET` with a secure password/secret generator. Do not commit its real value.

## Required for Coinbase-connected live balances and trading

```dotenv
VAULT_ENCRYPTION_KEY="BASE64_32_BYTE_KEY"
COINBASE_CLIENT_ID=""
COINBASE_CLIENT_SECRET=""
COINBASE_REDIRECT_URI="https://your-domain.example/api/integrations/coinbase/callback"
COINBASE_OAUTH_SCOPES="wallet:user:read,wallet:accounts:read,wallet:trades:read,wallet:trades:create,offline_access"

COINBASE_AUTHORIZE_URL="https://login.coinbase.com/oauth2/auth"
COINBASE_TOKEN_URL="https://login.coinbase.com/oauth2/token"
COINBASE_API_BASE_URL="https://api.coinbase.com"

TRADING_MODE="live"
NEXT_PUBLIC_TRADING_MODE="live"
LIVE_TRADING_ENABLED="false"
MAX_LIVE_ORDER_USD="250"
AI_TRADING_ENABLED="false"
ENABLE_SANDBOX_FUNDING="false"
```

Generate the encryption key locally:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Keep `LIVE_TRADING_ENABLED=false` through the first production OAuth test. Enable it only after order preview and a very small manually confirmed order work. Keep `AI_TRADING_ENABLED=false` until a separate risk and compliance rollout.

## AI features (optional; choose at least one)

```dotenv
OPENROUTER_API_KEY=""
OPENAI_API_KEY=""
ANTHROPIC_API_KEY=""
GEMINI_API_KEY=""
DEEPSEEK_API_KEY=""
CUSTOM_AI_BASE_URL=""
CUSTOM_AI_API_KEY=""
```

OpenRouter credits pay for model API usage. They are not deposited into the Vault and cannot be used as trading capital.

## Optional authentication and email

```dotenv
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
SMTP_HOST=""
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER=""
SMTP_PASS=""
SMTP_FROM="LUCIAN <no-reply@your-domain.example>"
```

## Vercel procedure

1. Add variables to Production, Preview, and Development as appropriate.
2. Do not add secret values with a `NEXT_PUBLIC_` prefix.
3. Run `npx prisma migrate deploy` against the same `DATABASE_URL` used by Vercel.
4. Redeploy after changing any `NEXT_PUBLIC_*` variable because those are compiled into the client bundle.
