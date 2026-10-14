/**
 * pricing.ts
 *
 * Per-model token prices used to recompute message cost from token counts.
 * OpenCode's bundled price table prices GitHub Copilot cache writes at $0,
 * which under-reports daily spend; these rates follow GitHub's published
 * Copilot pricing (USD per 1M tokens):
 * https://docs.github.com/en/copilot/reference/copilot-billing/models-and-pricing
 */

export interface ModelRates {
  input:      number;
  output:     number;
  cacheRead:  number;
  cacheWrite: number;
}

export interface TokenCounts {
  input?:     number;
  output?:    number;
  reasoning?: number;
  cache?:     { read?: number; write?: number };
}

export type PricingTable = Record<string, ModelRates>;

const opus5  = { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 };
const sonnet = { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 };

/** Keyed by `providerID/modelID`. */
export const DEFAULT_PRICING: PricingTable = {
  "github-copilot/claude-haiku-4.5":  { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
  "github-copilot/claude-sonnet-4":   sonnet,
  "github-copilot/claude-sonnet-4.5": sonnet,
  "github-copilot/claude-sonnet-4.6": sonnet,
  "github-copilot/claude-sonnet-5":   { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  "github-copilot/claude-opus-4.5":   opus5,
  "github-copilot/claude-opus-4.6":   opus5,
  "github-copilot/claude-opus-4.7":   opus5,
  "github-copilot/claude-opus-4.8":   opus5,
  "github-copilot/claude-opus-5":     opus5,
  "github-copilot/claude-opus-5.5":   { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
};

/** Merge user overrides (partial rates allowed) over the defaults. Invalid entries are ignored. */
export function buildPricingTable(overrides: unknown): PricingTable {
  const table: PricingTable = { ...DEFAULT_PRICING };
  if (!overrides || typeof overrides !== "object") { return table; }
  for (const [key, val] of Object.entries(overrides as Record<string, unknown>)) {
    if (!val || typeof val !== "object") { continue; }
    const base: ModelRates = table[key] ?? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
    const merged = { ...base };
    for (const f of ["input", "output", "cacheRead", "cacheWrite"] as const) {
      const n = (val as Record<string, unknown>)[f];
      if (typeof n === "number" && isFinite(n) && n >= 0) { merged[f] = n; }
    }
    table[key] = merged;
  }
  return table;
}

export function ratesFor(table: PricingTable, providerID?: string, modelID?: string): ModelRates | undefined {
  if (!providerID || !modelID) { return undefined; }
  return table[`${providerID}/${modelID}`];
}

/** Cost in USD. Reasoning tokens are billed at the output rate. */
export function computeCost(tokens: TokenCounts | undefined, rates: ModelRates): number {
  const t = tokens ?? {};
  return ((t.input ?? 0) * rates.input
        + ((t.output ?? 0) + (t.reasoning ?? 0)) * rates.output
        + (t.cache?.read ?? 0) * rates.cacheRead
        + (t.cache?.write ?? 0) * rates.cacheWrite) / 1_000_000;
}

/** Recomputed cost when the model is priced, otherwise OpenCode's stored cost (0 if missing/NaN). */
export function messageCost(
  table: PricingTable,
  info: { cost?: number; tokens?: TokenCounts; providerID?: string; modelID?: string; model?: { providerID?: string; id?: string } },
): number {
  const rates = ratesFor(table, info.providerID ?? info.model?.providerID, info.modelID ?? info.model?.id);
  if (rates) { return computeCost(info.tokens, rates); }
  return typeof info.cost === "number" && !isNaN(info.cost) ? info.cost : 0;
}
