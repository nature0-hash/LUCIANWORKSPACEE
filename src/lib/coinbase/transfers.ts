import "server-only";

import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { coinbaseFetch, isCoinbaseConfigured } from "@/lib/coinbase/client";

type CoinbaseMoney = { amount?: string; currency?: string };
type CoinbaseAccount = {
  id?: string;
  name?: string;
  primary?: boolean;
  type?: string;
  currency?: { code?: string; name?: string; color?: string; asset_id?: string };
  balance?: CoinbaseMoney;
  available_balance?: CoinbaseMoney;
};

type CoinbaseAddress = {
  id?: string;
  address?: string;
  name?: string | null;
  network?: string;
  created_at?: string;
};

const ACCOUNT_ID_RE = /^[a-zA-Z0-9_-]{8,128}$/;
const ADDRESS_RE = /^[a-zA-Z0-9:_-]{8,200}$/;
const TAG_RE = /^[a-zA-Z0-9._:-]{1,120}$/;
const NETWORK_RE = /^[a-z0-9_-]{2,40}$/;
const ASSET_RE = /^[A-Z0-9]{2,12}$/;

function csvSet(name: string, fallback: string): Set<string> {
  return new Set((process.env[name] ?? fallback).split(",").map((item) => item.trim().toLowerCase()).filter(Boolean));
}

function allowedAssets(): Set<string> {
  return csvSet("COINBASE_SEND_ALLOWED_ASSETS", "BTC,ETH,USDC,SOL");
}

function allowedNetworks(): Set<string> {
  return csvSet("COINBASE_SEND_ALLOWED_NETWORKS", "bitcoin,ethereum,base,solana");
}

function positiveDecimal(value: unknown): string {
  const text = typeof value === "number" || typeof value === "string" ? String(value).trim() : "";
  if (!/^\d+(\.\d{1,18})?$/.test(text) || Number(text) <= 0) throw new Error("Enter a valid positive crypto amount.");
  return text;
}

function accountAsset(account: CoinbaseAccount): string {
  return String(account.currency?.code ?? account.balance?.currency ?? account.available_balance?.currency ?? "").toUpperCase();
}

function accountAvailable(account: CoinbaseAccount): number {
  return Number(account.available_balance?.amount ?? account.balance?.amount ?? 0);
}

function assertAccountId(value: unknown): string {
  const id = typeof value === "string" ? value.trim() : "";
  if (!ACCOUNT_ID_RE.test(id)) throw new Error("Invalid Coinbase account.");
  return id;
}

function assertNetwork(value: unknown): string {
  const network = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!NETWORK_RE.test(network)) throw new Error("Select a valid blockchain network.");
  if (!allowedNetworks().has(network)) throw new Error(`The ${network} network is not enabled in LUCIAN.`);
  return network;
}

function assertAddress(value: unknown): string {
  const address = typeof value === "string" ? value.trim() : "";
  if (!ADDRESS_RE.test(address)) throw new Error("Enter a valid blockchain address. Email sends are intentionally disabled.");
  return address;
}

function assertTag(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const tag = String(value).trim();
  if (!TAG_RE.test(tag)) throw new Error("Destination tag or memo contains unsupported characters.");
  return tag;
}

async function jsonOrError(response: Response, fallback: string): Promise<Record<string, unknown>> {
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    const errors = Array.isArray(payload.errors) ? payload.errors : [];
    const first = errors[0] as { message?: string } | undefined;
    throw new Error(first?.message ?? fallback);
  }
  return payload;
}

export function coinbaseTransferSettings() {
  return {
    configured: isCoinbaseConfigured(),
    transfersEnabled: process.env.COINBASE_TRANSFERS_ENABLED === "true",
    maxSendUsd: Math.max(1, Number(process.env.COINBASE_MAX_SEND_USD ?? "50")),
    allowedAssets: [...allowedAssets()].map((asset) => asset.toUpperCase()),
    allowedNetworks: [...allowedNetworks()],
  };
}

export async function listWalletAccounts(userId: string): Promise<Array<{ id: string; name: string; asset: string; balance: string; available: string; primary: boolean; type: string }>> {
  const response = await coinbaseFetch(userId, "/v2/accounts?limit=100");
  const payload = await jsonOrError(response, "Coinbase could not return wallet accounts.");
  const data = Array.isArray(payload.data) ? payload.data as CoinbaseAccount[] : [];
  return data.flatMap((account) => {
    const id = String(account.id ?? "");
    const asset = accountAsset(account);
    if (!ACCOUNT_ID_RE.test(id) || !ASSET_RE.test(asset)) return [];
    return [{
      id,
      name: String(account.name ?? `${asset} Wallet`),
      asset,
      balance: String(account.balance?.amount ?? account.available_balance?.amount ?? "0"),
      available: String(account.available_balance?.amount ?? account.balance?.amount ?? "0"),
      primary: account.primary === true,
      type: String(account.type ?? "wallet"),
    }];
  });
}

async function getWalletAccount(userId: string, accountId: string): Promise<CoinbaseAccount> {
  const response = await coinbaseFetch(userId, `/v2/accounts/${encodeURIComponent(accountId)}`);
  const payload = await jsonOrError(response, "Coinbase could not verify the selected wallet account.");
  const account = payload.data as CoinbaseAccount | undefined;
  if (!account || account.id !== accountId) throw new Error("Coinbase account verification failed.");
  return account;
}

async function spotUsd(userId: string, asset: string): Promise<number> {
  if (asset === "USD" || asset === "USDC") return 1;
  const response = await coinbaseFetch(userId, `/v2/prices/${encodeURIComponent(asset)}-USD/spot`);
  const payload = await jsonOrError(response, `Coinbase could not price ${asset} in USD.`);
  const data = payload.data as CoinbaseMoney | undefined;
  const amount = Number(data?.amount ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error(`Coinbase returned an invalid ${asset} price.`);
  return amount;
}

export async function createReceiveAddress(userId: string, input: Record<string, unknown>) {
  const accountId = assertAccountId(input.accountId);
  const network = assertNetwork(input.network);
  const account = await getWalletAccount(userId, accountId);
  const asset = accountAsset(account);
  if (!allowedAssets().has(asset.toLowerCase())) throw new Error(`${asset} receive addresses are not enabled in LUCIAN.`);
  const label = typeof input.label === "string" ? input.label.trim().slice(0, 80) : "LUCIAN Vault deposit";
  const response = await coinbaseFetch(userId, `/v2/accounts/${encodeURIComponent(accountId)}/addresses`, {
    method: "POST",
    body: JSON.stringify({ name: label || "LUCIAN Vault deposit", network }),
  });
  const payload = await jsonOrError(response, "Coinbase could not generate a receive address.");
  const address = payload.data as CoinbaseAddress | undefined;
  if (!address?.id || !address.address || !address.network) throw new Error("Coinbase returned an incomplete receive address.");
  const saved = await db.coinbaseReceiveAddress.upsert({
    where: { userId_providerAddressId: { userId, providerAddressId: address.id } },
    create: {
      userId, coinbaseAccountId: accountId, providerAddressId: address.id,
      asset, network: address.network, address: address.address, label: address.name ?? label,
    },
    update: { network: address.network, address: address.address, label: address.name ?? label },
  });
  return { id: saved.id, asset, network: saved.network, address: saved.address, label: saved.label, createdAt: saved.createdAt };
}

export async function listReceiveAddresses(userId: string) {
  return db.coinbaseReceiveAddress.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 50 });
}

export async function previewCoinbaseSend(userId: string, input: Record<string, unknown>) {
  const accountId = assertAccountId(input.accountId);
  const network = assertNetwork(input.network);
  const destination = assertAddress(input.destination);
  const destinationTag = assertTag(input.destinationTag);
  const amount = positiveDecimal(input.amount);
  const account = await getWalletAccount(userId, accountId);
  const asset = accountAsset(account);
  if (!allowedAssets().has(asset.toLowerCase())) throw new Error(`${asset} sends are not enabled in LUCIAN.`);
  if (Number(amount) > accountAvailable(account)) throw new Error(`The selected Coinbase wallet has only ${accountAvailable(account)} ${asset} available.`);
  const price = await spotUsd(userId, asset);
  const estimatedUsd = Number(amount) * price;
  const settings = coinbaseTransferSettings();
  if (!Number.isFinite(estimatedUsd) || estimatedUsd <= 0) throw new Error("The transfer USD estimate is invalid.");
  if (estimatedUsd > settings.maxSendUsd + 0.000001) throw new Error(`This send exceeds LUCIAN's $${settings.maxSendUsd.toFixed(2)} server limit.`);
  const suffix = destination.slice(-6).toUpperCase();
  const confirmationText = `SEND ${amount} ${asset} TO ${suffix}`;
  const intent = await db.coinbaseTransferIntent.create({
    data: {
      userId, idempotencyKey: randomUUID(), coinbaseAccountId: accountId,
      asset, network, destination, destinationTag, amount, estimatedUsd,
      confirmationText, expiresAt: new Date(Date.now() + 5 * 60_000),
    },
  });
  return {
    intentId: intent.id,
    asset,
    network,
    amount,
    estimatedUsd,
    destinationMasked: `${destination.slice(0, 8)}…${destination.slice(-6)}`,
    destinationTag,
    confirmationText,
    expiresAt: intent.expiresAt,
    transfersEnabled: settings.transfersEnabled,
    warning: "Blockchain transfers are generally irreversible. Verify the asset, network, and complete destination outside LUCIAN before confirming.",
  };
}

async function verifyCurrentPassword(userId: string, password: unknown): Promise<void> {
  if (typeof password !== "string" || password.length < 1 || password.length > 1024) throw new Error("Your current LUCIAN password is required.");
  const user = await db.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash))) throw new Error("Current LUCIAN password verification failed.");
}

export async function executeCoinbaseSend(userId: string, input: Record<string, unknown>) {
  if (process.env.COINBASE_TRANSFERS_ENABLED !== "true") throw new Error("Coinbase transfers are locked by COINBASE_TRANSFERS_ENABLED.");
  const intentId = typeof input.intentId === "string" ? input.intentId : "";
  const typed = typeof input.confirmationText === "string" ? input.confirmationText.trim() : "";
  await verifyCurrentPassword(userId, input.password);
  const intent = await db.coinbaseTransferIntent.findFirst({ where: { id: intentId, userId } });
  if (!intent || intent.state !== "previewed") throw new Error("This transfer preview is missing or has already been used.");
  if (intent.expiresAt.getTime() < Date.now()) {
    await db.coinbaseTransferIntent.update({ where: { id: intent.id }, data: { state: "expired" } });
    throw new Error("This transfer preview expired. Create a new preview.");
  }
  if (typed !== intent.confirmationText) throw new Error("The confirmation phrase does not match exactly.");

  const account = await getWalletAccount(userId, intent.coinbaseAccountId);
  if (accountAsset(account) !== intent.asset || Number(intent.amount) > accountAvailable(account)) throw new Error("The Coinbase wallet balance changed and no longer covers this transfer.");
  const estimatedUsd = Number(intent.amount) * await spotUsd(userId, intent.asset);
  const maxSendUsd = coinbaseTransferSettings().maxSendUsd;
  if (estimatedUsd > maxSendUsd + 0.000001) throw new Error(`The current value exceeds LUCIAN's $${maxSendUsd.toFixed(2)} server limit.`);

  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
    const fresh = await tx.coinbaseTransferIntent.findFirst({ where: { id: intent.id, userId, state: "previewed" } });
    if (!fresh) throw new Error("This transfer was already submitted from another tab.");
    await tx.coinbaseTransferIntent.update({ where: { id: fresh.id }, data: { state: "submitting", confirmedAt: new Date(), estimatedUsd } });
  });

  const requestBody: Record<string, unknown> = {
    type: "send",
    to: intent.destination,
    amount: intent.amount.toString(),
    currency: intent.asset,
    idem: intent.idempotencyKey,
    network: intent.network,
  };
  if (intent.destinationTag) requestBody.destination_tag = intent.destinationTag;

  try {
    const response = await coinbaseFetch(userId, `/v2/accounts/${encodeURIComponent(intent.coinbaseAccountId)}/transactions`, {
      method: "POST",
      body: JSON.stringify(requestBody),
    });
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
    const data = payload.data as { id?: string; status?: string } | undefined;
    const state = response.ok ? (data?.status === "completed" ? "completed" : "pending") : "rejected";
    await db.coinbaseTransferIntent.update({
      where: { id: intent.id },
      data: { state, providerTransactionId: data?.id, providerResponse: payload as object },
    });
    if (!response.ok || !data?.id) throw new Error("Coinbase rejected the transfer. Review the saved audit record before trying again.");
    return { intentId: intent.id, providerTransactionId: data.id, state, status: data.status ?? "pending" };
  } catch (error) {
    await db.coinbaseTransferIntent.updateMany({
      where: { id: intent.id, state: "submitting" },
      data: { state: "submission_unknown", providerResponse: { error: error instanceof Error ? error.message : "Network failure" } },
    });
    throw error;
  }
}

function maskDestination(destination: string): string {
  return destination.length <= 14 ? destination : `${destination.slice(0, 8)}…${destination.slice(-6)}`;
}

export async function listCoinbaseTransfers(userId: string) {
  const rows = await db.coinbaseTransferIntent.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 50 });
  return rows.map((row) => ({
    id: row.id,
    asset: row.asset,
    network: row.network,
    destinationMasked: maskDestination(row.destination),
    destinationTag: row.destinationTag,
    amount: row.amount.toString(),
    estimatedUsd: row.estimatedUsd.toString(),
    state: row.state,
    providerTransactionId: row.providerTransactionId,
    expiresAt: row.expiresAt,
    confirmedAt: row.confirmedAt,
    createdAt: row.createdAt,
  }));
}
