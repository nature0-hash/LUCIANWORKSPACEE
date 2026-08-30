// LUCIAN Vault — Coinbase Crypto Provider adapter (STUB — honest state).
//
// SERVER-ONLY. Never import from a client component.
// Coinbase Commerce / Custody secrets are read from env and NEVER
// exposed to the browser.
//
// This adapter is a STUB: the real Coinbase SDK is not installed in
// this project. Every live operation throws ProviderStubError.
//
// Address validation IS implemented locally (no SDK needed) because it
// is a pure regex check — that part of the adapter is genuinely useful
// even before SDK wiring.

import {
  CryptoProvider, ProviderConnection, ProviderConnectionState,
  WithdrawalResult, VerifiedWebhookEvent,
  ProviderNotConfiguredError, ProviderStubError, ProviderError,
  deriveAdapterState,
} from "./types";
import { Money } from "../money";

const COINBASE_API_KEY = process.env.CRYPTO_PROVIDER_API_KEY;
const COINBASE_API_SECRET = process.env.CRYPTO_PROVIDER_API_SECRET;
const COINBASE_WEBHOOK_SECRET = process.env.CRYPTO_PROVIDER_WEBHOOK_SECRET;

/**
 * There is no official Coinbase Commerce Node SDK; integration is
 * direct REST. This adapter is a STUB until the REST calls are
 * implemented, regardless of whether the API keys are present.
 */
const COINBASE_REST_WIRED = false;

export class CoinbaseCryptoProvider implements CryptoProvider {
  readonly type = "crypto" as const;
  readonly name = "coinbase";

  isConfigured(): boolean {
    return !!COINBASE_API_KEY && !!COINBASE_API_SECRET;
  }

  getState(): ProviderConnectionState {
    return deriveAdapterState(this.isConfigured(), COINBASE_REST_WIRED);
  }

  isAuthenticated(): boolean {
    return false;
  }

  getConnection(): ProviderConnection {
    const state = this.getState();
    return {
      id: "coinbase",
      type: "crypto",
      name: "coinbase",
      configured: this.isConfigured(),
      state,
      authenticated: state === "connected",
      displayName: "Coinbase",
      stateDetail:
        state === "not_configured" ? "Missing CRYPTO_PROVIDER_API_KEY / CRYPTO_PROVIDER_API_SECRET." :
        state === "setup_required" ? "Keys present, but the Coinbase REST integration is not wired up. Implement the deposit-address / custody / withdrawal API calls to connect." :
        state === "configured" ? "SDK ready. Begin the custody account linking flow." :
        state === "connected" ? "Connected." :
        "See state detail.",
    };
  }

  private requireConfig(): void {
    if (!this.isConfigured()) {
      throw new ProviderNotConfiguredError("Coinbase");
    }
  }

  private async requireLive(operation: string): Promise<void> {
    this.requireConfig();
    if (!COINBASE_REST_WIRED) {
      throw new ProviderStubError("Coinbase", operation);
    }
  }

  async generateDepositAddress(_options: { asset: string; network: string }): Promise<{ address: string; qrCode?: string }> {
    await this.requireLive("generateDepositAddress");
    if (!_options.asset || !_options.network) {
      throw new ProviderError("Asset and network required.", "coinbase", "missing_asset_or_network");
    }
    throw new ProviderStubError("Coinbase", "generateDepositAddress");
  }

  async getBalances(): Promise<Array<{ asset: string; network: string; quantity: string; fiatEquivalent: Money }>> {
    await this.requireLive("getBalances");
    return [];
  }

  async initiateWithdrawal(options: {
    asset: string; network: string; amount: Money;
    destinationAddress: string; idempotencyKey: string;
  }): Promise<WithdrawalResult> {
    await this.requireLive("initiateWithdrawal");
    if (options.amount.amount <= 0n) {
      throw new ProviderError("Amount must be positive.", "coinbase", "invalid_amount");
    }
    if (!options.destinationAddress) {
      throw new ProviderError("Destination address required.", "coinbase", "missing_destination");
    }
    if (!options.asset || !options.network) {
      throw new ProviderError("Asset and network required.", "coinbase", "missing_asset_or_network");
    }
    const valid = await this.validateAddress({
      asset: options.asset,
      network: options.network,
      address: options.destinationAddress,
    });
    if (!valid.valid) {
      throw new ProviderError(
        `Address does not match ${options.asset} on ${options.network}. ${valid.reason ?? ""}`,
        "coinbase",
        "address_network_mismatch",
      );
    }
    throw new ProviderStubError("Coinbase", "initiateWithdrawal");
  }

  /**
   * Local address validation — pure regex, no SDK needed.
   * This is the ONE part of the adapter that is genuinely implemented;
   * it is shared by the withdrawal validation path.
   */
  async validateAddress(options: { asset: string; network: string; address: string }): Promise<{ valid: boolean; reason?: string }> {
    const { asset, network, address } = options;
    if (!address) return { valid: false, reason: "Address is empty." };

    if (asset === "BTC" && network === "bitcoin") {
      if (/^bc1[a-zA-HJ-NP-Z0-9]{25,62}$/.test(address) || /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address)) {
        return { valid: true };
      }
      return { valid: false, reason: "Not a valid Bitcoin address." };
    }
    if (network === "ethereum" || network === "polygon" || network === "base" || network === "arbitrum") {
      if (/^0x[a-fA-F0-9]{40}$/.test(address)) {
        return { valid: true };
      }
      return { valid: false, reason: `Not a valid ${network} address.` };
    }
    if (network === "solana") {
      if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
        return { valid: true };
      }
      return { valid: false, reason: "Not a valid Solana address." };
    }
    return { valid: false, reason: `Address validation not supported for ${asset} on ${network}.` };
  }

  async verifyWebhookSignature(_payload: string | Buffer, _signature: string): Promise<boolean> {
    if (!COINBASE_WEBHOOK_SECRET) {
      throw new ProviderNotConfiguredError("Coinbase Webhook");
    }
    // STUB: real verification is HMAC-SHA256. Never return true here.
    return false;
  }

  async parseWebhookEvent(payload: string | Buffer, signature: string): Promise<VerifiedWebhookEvent> {
    const valid = await this.verifyWebhookSignature(payload, signature);
    if (!valid) {
      throw new ProviderError("Webhook signature verification failed.", "coinbase", "signature_invalid");
    }
    throw new ProviderStubError("Coinbase", "parseWebhookEvent");
  }
}
