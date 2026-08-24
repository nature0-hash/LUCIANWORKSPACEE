"use client";

/* LUCIAN Economic Agent — Connection configuration.
 *
 * Stores the user's selected AI provider + model identifier. API keys
 * are NEVER stored here — they live in Vercel environment variables and
 * are only read server-side. This store only persists the non-secret
 * configuration (provider id + model id) so the UI can display the
 * current selection and the server route knows which provider to use.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type ProviderId =
  | "gemini"
  | "openai"
  | "anthropic"
  | "openrouter"
  | "deepseek"
  | "custom";

export interface ProviderInfo {
  id: ProviderId;
  name: string;
  /** Environment variable name that holds the API key (server-side only). */
  envKey: string;
  /** Default model identifier if the user hasn't set one. */
  defaultModel: string;
  /** Placeholder text for the model input. */
  modelPlaceholder: string;
}

export const PROVIDERS: ProviderInfo[] = [
  {
    id: "gemini",
    name: "Google Gemini",
    envKey: "GEMINI_API_KEY",
    defaultModel: "gemini-2.0-flash",
    modelPlaceholder: "gemini-2.0-flash",
  },
  {
    id: "openai",
    name: "OpenAI",
    envKey: "OPENAI_API_KEY",
    defaultModel: "gpt-4o-mini",
    modelPlaceholder: "gpt-4o-mini",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    envKey: "ANTHROPIC_API_KEY",
    defaultModel: "claude-3-5-sonnet-20241022",
    modelPlaceholder: "claude-3-5-sonnet-20241022",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    envKey: "OPENROUTER_API_KEY",
    defaultModel: "openai/gpt-4o-mini",
    modelPlaceholder: "openai/gpt-4o-mini",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    envKey: "DEEPSEEK_API_KEY",
    defaultModel: "deepseek-chat",
    modelPlaceholder: "deepseek-chat",
  },
  {
    id: "custom",
    name: "Custom (OpenAI-compatible)",
    envKey: "CUSTOM_AI_API_KEY",
    defaultModel: "",
    modelPlaceholder: "model-id",
  },
];

export function getProviderInfo(id: ProviderId): ProviderInfo {
  return PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0];
}

/** Result of a connection test — returned by the server. */
export interface ConnectionTestResult {
  success: boolean;
  message: string;
  /** Detailed error reason when success=false. */
  reason?: string;
  /** Provider that was tested. */
  provider?: ProviderId;
  /** Model that was tested. */
  model?: string;
  /** Whether the API key was present in the environment. */
  keyPresent?: boolean;
  /** ISO timestamp of the test. */
  testedAt?: string;
}

interface EconomicAgentConnectionState {
  provider: ProviderId;
  model: string;
  /** Result of the last test (client-side cache for UI display). */
  lastTest: ConnectionTestResult | null;
  /** Whether a test is in progress. */
  testing: boolean;

  // Actions
  setProvider: (p: ProviderId) => void;
  setModel: (m: string) => void;
  setLastTest: (r: ConnectionTestResult | null) => void;
  setTesting: (v: boolean) => void;
}

export const useEconomicAgentConnection = create<EconomicAgentConnectionState>()(
  persist(
    (set) => ({
      provider: "gemini",
      model: "gemini-2.0-flash",
      lastTest: null,
      testing: false,

      setProvider: (p) =>
        set((s) => ({
          provider: p,
          // Auto-fill model with the provider's default when switching.
          model: s.model || getProviderInfo(p).defaultModel,
        })),
      setModel: (m) => set({ model: m }),
      setLastTest: (r) => set({ lastTest: r }),
      setTesting: (v) => set({ testing: v }),
    }),
    {
      name: "lucian-economic-agent-connection",
      storage: createJSONStorage(() => {
        if (typeof window === "undefined") return {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        };
        return localStorage;
      }),
    },
  ),
);
