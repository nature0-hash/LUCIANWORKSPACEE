// Risk rules stub — returns defaults so the markets store can initialize.

import type { RiskRules } from "./types";

export const DEFAULT_RISK_RULES: RiskRules = {
  maxRiskPerTrade: 1,
  maxDailyLoss: 5,
  maxOpenPositions: 5,
};

const KEY = "lucian-markets-risk-rules";

export function loadRiskRules(): RiskRules {
  if (typeof window === "undefined") return DEFAULT_RISK_RULES;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_RISK_RULES;
    return { ...DEFAULT_RISK_RULES, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_RISK_RULES;
  }
}

export function saveRiskRules(rules: RiskRules): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(rules));
  } catch {
    // ignore
  }
}
