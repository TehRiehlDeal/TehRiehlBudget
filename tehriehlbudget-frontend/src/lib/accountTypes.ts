export const MARKET_VALUE_TYPES = ['STOCK', 'INVESTMENT', 'RETIREMENT'] as const;

/**
 * Returns true for account types whose balance is driven by periodic valuation
 * snapshots rather than by transaction ledger entries.
 */
export function isMarketValue(type: string): boolean {
  return (MARKET_VALUE_TYPES as readonly string[]).includes(type);
}
