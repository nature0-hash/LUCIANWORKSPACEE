-- Owner-scoped Coinbase receive-address history and outbound-send intents.
CREATE TABLE "CoinbaseReceiveAddress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "coinbaseAccountId" TEXT NOT NULL,
    "providerAddressId" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CoinbaseReceiveAddress_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CoinbaseTransferIntent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "coinbaseAccountId" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "destinationTag" TEXT,
    "amount" DECIMAL(36,18) NOT NULL,
    "estimatedUsd" DECIMAL(24,8) NOT NULL,
    "confirmationText" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'previewed',
    "providerTransactionId" TEXT,
    "providerResponse" JSONB,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CoinbaseTransferIntent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CoinbaseReceiveAddress_userId_providerAddressId_key" ON "CoinbaseReceiveAddress"("userId", "providerAddressId");
CREATE INDEX "CoinbaseReceiveAddress_userId_asset_network_createdAt_idx" ON "CoinbaseReceiveAddress"("userId", "asset", "network", "createdAt");
CREATE UNIQUE INDEX "CoinbaseTransferIntent_idempotencyKey_key" ON "CoinbaseTransferIntent"("idempotencyKey");
CREATE INDEX "CoinbaseTransferIntent_userId_state_createdAt_idx" ON "CoinbaseTransferIntent"("userId", "state", "createdAt");
CREATE INDEX "CoinbaseTransferIntent_userId_providerTransactionId_idx" ON "CoinbaseTransferIntent"("userId", "providerTransactionId");

ALTER TABLE "CoinbaseReceiveAddress" ADD CONSTRAINT "CoinbaseReceiveAddress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CoinbaseTransferIntent" ADD CONSTRAINT "CoinbaseTransferIntent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
