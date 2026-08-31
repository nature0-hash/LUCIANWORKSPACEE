import "server-only";

import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { isQuidaxConfigured, quidaxFetch, quidaxPublicFetch } from "@/lib/quidax/client";

type QuidaxNetwork = { id?: string; name?: string; deposits_enabled?: boolean; withdraws_enabled?: boolean };
type QuidaxWallet = {
  id?: string; name?: string; currency?: string; balance?: string | number; locked?: string | number;
  converted_balance?: string | number; reference_currency?: string; is_crypto?: boolean | string;
  blockchain_enabled?: boolean; default_network?: string | null; networks?: QuidaxNetwork[];
  deposit_address?: string | null; destination_tag?: string | null;
};
type QuidaxAddress = { id?: string; currency?: string; address?: string | null; network?: string; destination_tag?: string | null; created_at?: string };

type WalletAccount = {
  id: string; name: string; asset: string; balance: string; available: string; primary: boolean; type: string;
  referenceCurrency: string; convertedBalance: string;
  networks: Array<{ id: string; name: string; depositsEnabled: boolean; withdrawsEnabled: boolean }>;
};

const ADDRESS_RE = /^[a-zA-Z0-9:_-]{8,200}$/;
const TAG_RE = /^[a-zA-Z0-9._:-]{1,120}$/;
const NETWORK_RE = /^[a-z0-9_-]{2,40}$/;
const ASSET_RE = /^[A-Z0-9]{2,12}$/;

function csvSet(name: string, fallback: string): Set<string> {
  return new Set((process.env[name] ?? fallback).split(",").map((item) => item.trim().toLowerCase()).filter(Boolean));
}

function allowedAssets(): Set<string> {
  return csvSet("QUIDAX_SEND_ALLOWED_ASSETS", "BTC,ETH,USDT,USDC,SOL");
}

function allowedNetworks(): Set<string> {
  return csvSet("QUIDAX_SEND_ALLOWED_NETWORKS", "btc,erc20,trc20,bep20,solana,polygon");
}

function positiveDecimal(value: unknown): string {
  const text = typeof value === "number" || typeof value === "string" ? String(value).trim() : "";
  if (!/^\d+(\.\d{1,18})?$/.test(text) || Number(text) <= 0) throw new Error("Enter a valid positive crypto amount.");
  return text;
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

function apiMessage(payload: Record<string, unknown>, fallback: string): string {
  if (typeof payload.message === "string" && payload.message.trim()) return payload.message;
  const data = payload.data;
  if (data && typeof data === "object" && typeof (data as { message?: unknown }).message === "string") return (data as { message: string }).message;
  return fallback;
}

async function jsonOrError(response: Response, fallback: string): Promise<Record<string, unknown>> {
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok || payload.status === "error") throw new Error(apiMessage(payload, fallback));
  return payload;
}

function walletNetwork(network: QuidaxNetwork): { id: string; name: string; depositsEnabled: boolean; withdrawsEnabled: boolean } | null {
  const id = String(network.id ?? "").trim().toLowerCase();
  if (!NETWORK_RE.test(id)) return null;
  return { id, name: String(network.name ?? id), depositsEnabled: network.deposits_enabled === true, withdrawsEnabled: network.withdraws_enabled === true };
}

function toWalletAccount(wallet: QuidaxWallet): WalletAccount | null {
  const id = String(wallet.id ?? "").trim();
  const asset = String(wallet.currency ?? "").trim().toUpperCase();
  if (!id || !ASSET_RE.test(asset)) return null;
  const balance = Number(wallet.balance ?? 0);
  const locked = Number(wallet.locked ?? 0);
  const networks = (Array.isArray(wallet.networks) ? wallet.networks : []).flatMap((network) => {
    const mapped = walletNetwork(network);
    return mapped ? [mapped] : [];
  });
  return {
    id,
    name: String(wallet.name ?? `${asset} Wallet`),
    asset,
    balance: String(wallet.balance ?? "0"),
    available: String(Math.max(0, balance - locked)),
    primary: false,
    type: wallet.is_crypto === true || wallet.is_crypto === "1" ? "crypto" : "fiat",
    referenceCurrency: String(wallet.reference_currency ?? "NGN").toUpperCase(),
    convertedBalance: String(wallet.converted_balance ?? wallet.balance ?? "0"),
    networks,
  };
}

export function quidaxTransferSettings() {
  return {
    configured: isQuidaxConfigured(),
    transfersEnabled: process.env.QUIDAX_TRANSFERS_ENABLED === "true",
    maxSendUsd: Math.max(1, Number(process.env.QUIDAX_MAX_SEND_USD ?? "50")),
    allowedAssets: [...allowedAssets()].map((asset) => asset.toUpperCase()),
    allowedNetworks: [...allowedNetworks()],
  };
}

export async function listWalletAccounts(): Promise<WalletAccount[]> {
  const response = await quidaxFetch("/users/me/wallets");
  const payload = await jsonOrError(response, "Quidax could not return wallet accounts.");
  const rows = Array.isArray(payload.data) ? payload.data as QuidaxWallet[] : [];
  return rows.flatMap((wallet) => {
    const mapped = toWalletAccount(wallet);
    return mapped ? [mapped] : [];
  });
}

async function getWalletAccount(walletId: unknown): Promise<WalletAccount> {
  const id = typeof walletId === "string" ? walletId.trim() : "";
  if (!id) throw new Error("Select a Quidax wallet.");
  const wallet = (await listWalletAccounts()).find((item) => item.id === id);
  if (!wallet) throw new Error("The selected Quidax wallet was not found.");
  return wallet;
}

function assertNetwork(wallet: WalletAccount, value: unknown, capability: "depositsEnabled" | "withdrawsEnabled"): string {
  const network = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!NETWORK_RE.test(network)) throw new Error("Select a valid blockchain network.");
  if (!allowedNetworks().has(network)) throw new Error(`The ${network} network is not enabled in LUCIAN.`);
  if (!wallet.networks.some((item) => item.id === network && item[capability])) {
    throw new Error(`Quidax does not currently allow this ${capability === "depositsEnabled" ? "deposit" : "withdrawal"} network for ${wallet.asset}.`);
  }
  return network;
}

async function spotUsd(asset: string): Promise<number> {
  if (asset === "USD" || asset === "USDT" || asset === "USDC") return 1;
  const market = `${asset.toLowerCase()}usdt`;
  const response = await quidaxPublicFetch(`/markets/tickers/${encodeURIComponent(market)}`);
  const payload = await jsonOrError(response, `Quidax could not price ${asset} in USDT.`);
  const data = payload.data as Record<string, { ticker?: { last?: string | number; buy?: string | number; sell?: string | number } }> | undefined;
  const ticker = data?.[market]?.ticker;
  const price = Number(ticker?.last ?? ticker?.sell ?? ticker?.buy ?? 0);
  if (!Number.isFinite(price) || price <= 0) throw new Error(`Quidax returned an invalid ${asset} price.`);
  return price;
}

export async function createReceiveAddress(userId: string, input: Record<string, unknown>) {
  const wallet = await getWalletAccount(input.accountId);
  if (wallet.type !== "crypto") throw new Error("Only crypto wallets can receive a blockchain address.");
  if (!allowedAssets().has(wallet.asset.toLowerCase())) throw new Error(`${wallet.asset} receive addresses are not enabled in LUCIAN.`);
  const network = assertNetwork(wallet, input.network, "depositsEnabled");
  const response = await quidaxFetch(`/users/me/wallets/${encodeURIComponent(wallet.asset.toLowerCase())}/addresses?network=${encodeURIComponent(network)}`, { method: "POST" });
  const payload = await jsonOrError(response, "Quidax could not generate a receive address.");
  const address = payload.data as QuidaxAddress | undefined;
  if (!address?.id || !address.address || !address.network) {
    throw new Error("Quidax did not return a usable receive address for this wallet/network.");
  }
  const providerAddressId = `quidax:${address.id}`;
  const saved = await db.coinbaseReceiveAddress.upsert({
    where: { userId_providerAddressId: { userId, providerAddressId } },
    create: {
      userId, coinbaseAccountId: wallet.id, providerAddressId, asset: wallet.asset,
      network: address.network, address: address.address, label: "Quidax Vault deposit",
    },
    update: { network: address.network, address: address.address, label: "Quidax Vault deposit" },
  });
  return { id: saved.id, asset: wallet.asset, network: saved.network, address: saved.address, label: saved.label, createdAt: saved.createdAt };
}

export async function listReceiveAddresses(userId: string) {
  return db.coinbaseReceiveAddress.findMany({
    where: { userId, providerAddressId: { startsWith: "quidax:" } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function previewQuidaxSend(userId: string, input: Record<string, unknown>) {
  const wallet = await getWalletAccount(input.accountId);
  if (wallet.type !== "crypto") throw new Error("Only crypto wallets can send a blockchain transfer.");
  const asset = wallet.asset;
  if (!allowedAssets().has(asset.toLowerCase())) throw new Error(`${asset} sends are not enabled in LUCIAN.`);
  const network = assertNetwork(wallet, input.network, "withdrawsEnabled");
  const destination = assertAddress(input.destination);
  const destinationTag = assertTag(input.destinationTag);
  const amount = positiveDecimal(input.amount);
  if (Number(amount) > Number(wallet.available)) throw new Error(`The selected Quidax wallet has only ${wallet.available} ${asset} available.`);
  const estimatedUsd = Number(amount) * await spotUsd(asset);
  const settings = quidaxTransferSettings();
  if (!Number.isFinite(estimatedUsd) || estimatedUsd <= 0) throw new Error("The transfer USD estimate is invalid.");
  if (estimatedUsd > settings.maxSendUsd + 0.000001) throw new Error(`This send exceeds LUCIAN's $${settings.maxSendUsd.toFixed(2)} server limit.`);
  const confirmationText = `SEND ${amount} ${asset} TO ${destination.slice(-6).toUpperCase()}`;
  const intent = await db.coinbaseTransferIntent.create({
    data: {
      userId, idempotencyKey: `quidax:${randomUUID()}`, coinbaseAccountId: wallet.id,
      asset, network, destination, destinationTag, amount, estimatedUsd, confirmationText,
      expiresAt: new Date(Date.now() + 5 * 60_000),
    },
  });
  return {
    intentId: intent.id, asset, network, amount, estimatedUsd,
    destinationMasked: `${destination.slice(0, 8)}…${destination.slice(-6)}`,
    destinationTag, confirmationText, expiresAt: intent.expiresAt, transfersEnabled: settings.transfersEnabled,
    warning: "Blockchain transfers are generally irreversible. Verify the full destination and network in Quidax before confirming.",
  };
}

async function verifyCurrentPassword(userId: string, password: unknown): Promise<void> {
  if (typeof password !== "string" || password.length < 1 || password.length > 1024) throw new Error("Your current LUCIAN password is required.");
  const user = await db.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash))) throw new Error("Current LUCIAN password verification failed.");
}

export async function executeQuidaxSend(userId: string, input: Record<string, unknown>) {
  if (process.env.QUIDAX_TRANSFERS_ENABLED !== "true") throw new Error("Quidax transfers are locked by QUIDAX_TRANSFERS_ENABLED.");
  const intentId = typeof input.intentId === "string" ? input.intentId : "";
  const typed = typeof input.confirmationText === "string" ? input.confirmationText.trim() : "";
  await verifyCurrentPassword(userId, input.password);
  const intent = await db.coinbaseTransferIntent.findFirst({ where: { id: intentId, userId, idempotencyKey: { startsWith: "quidax:" } } });
  if (!intent || intent.state !== "previewed") throw new Error("This transfer preview is missing or has already been used.");
  if (intent.expiresAt.getTime() < Date.now()) {
    await db.coinbaseTransferIntent.update({ where: { id: intent.id }, data: { state: "expired" } });
    throw new Error("This transfer preview expired. Create a new preview.");
  }
  if (typed !== intent.confirmationText) throw new Error("The confirmation phrase does not match exactly.");
  const wallet = await getWalletAccount(intent.coinbaseAccountId);
  if (wallet.asset !== intent.asset || Number(intent.amount) > Number(wallet.available)) throw new Error("The Quidax wallet balance changed and no longer covers this transfer.");
  const currentEstimatedUsd = Number(intent.amount) * await spotUsd(intent.asset);
  const maxSendUsd = quidaxTransferSettings().maxSendUsd;
  if (currentEstimatedUsd > maxSendUsd + 0.000001) throw new Error(`The current value exceeds LUCIAN's $${maxSendUsd.toFixed(2)} server limit.`);

  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
    const fresh = await tx.coinbaseTransferIntent.findFirst({ where: { id: intent.id, userId, state: "previewed", idempotencyKey: { startsWith: "quidax:" } } });
    if (!fresh) throw new Error("This transfer was already submitted from another tab.");
    await tx.coinbaseTransferIntent.update({ where: { id: fresh.id }, data: { state: "submitting", confirmedAt: new Date(), estimatedUsd: currentEstimatedUsd } });
  });

  const body: Record<string, unknown> = {
    currency: intent.asset.toLowerCase(), amount: intent.amount.toString(), fund_uid: intent.destination,
    reference: intent.idempotencyKey, network: intent.network, transaction_note: "LUCIAN owner-confirmed transfer",
  };
  if (intent.destinationTag) body.fund_uid2 = intent.destinationTag;
  try {
    const response = await quidaxFetch("/users/me/withdraws", { method: "POST", body: JSON.stringify(body) });
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
    const data = payload.data as { id?: string; status?: string } | undefined;
    const state = response.ok && payload.status !== "error" ? (data?.status === "success" ? "completed" : "pending") : "rejected";
    await db.coinbaseTransferIntent.update({ where: { id: intent.id }, data: { state, providerTransactionId: data?.id, providerResponse: payload as object } });
    if (!response.ok || payload.status === "error" || !data?.id) throw new Error(apiMessage(payload, "Quidax rejected the transfer. Review the saved audit record before trying again."));
    return { intentId: intent.id, providerTransactionId: data.id, state, status: data.status ?? "pending" };
  } catch (error) {
    await db.coinbaseTransferIntent.updateMany({ where: { id: intent.id, state: "submitting" }, data: { state: "submission_unknown", providerResponse: { error: error instanceof Error ? error.message : "Network failure" } } });
    throw error;
  }
}

function maskDestination(destination: string): string {
  return destination.length <= 14 ? destination : `${destination.slice(0, 8)}…${destination.slice(-6)}`;
}

export async function listQuidaxTransfers(userId: string) {
  const rows = await db.coinbaseTransferIntent.findMany({ where: { userId, idempotencyKey: { startsWith: "quidax:" } }, orderBy: { createdAt: "desc" }, take: 50 });
  return rows.map((row) => ({
    id: row.id, asset: row.asset, network: row.network, destinationMasked: maskDestination(row.destination), destinationTag: row.destinationTag,
    amount: row.amount.toString(), estimatedUsd: row.estimatedUsd.toString(), state: row.state,
    providerTransactionId: row.providerTransactionId, expiresAt: row.expiresAt, confirmedAt: row.confirmedAt, createdAt: row.createdAt,
  }));
}
