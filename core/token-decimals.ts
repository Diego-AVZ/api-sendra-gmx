export const TOKEN_DECIMALS: Record<string, number> = {
  ETH: 12,
  BTC: 22,
  SOL: 21,
  DOGE: 22,
  BNB: 12,
  TIA: 24,
  PEPE: 9,
  LINK: 18,
  ARB: 18,
  AVAX: 18,
  UNI: 18,
  AAVE: 12,
  MATIC: 18,
  DOT: 20,
  ADA: 6,
  XRP: 6,
  LTC: 8,
  SHIB: 18,
  APE: 18,
  APT: 8,
  BOME: 18,
  MEME: 18,
  FLOKI: 18,
  MEW: 18,
  TAO: 18,
  BONK: 5,
  WLD: 18,
  tBTC: 18,
  'WBTC.b': 8,
  EIGEN: 18,
  SUI: 9,
  SEI: 18,
  STX: 6,
  OP: 18,
  WIF: 8,
  PENDLE: 18,
};

export function getTokenDecimals(tokenSymbol: string): number {
  const upperSymbol = tokenSymbol.toUpperCase();
  return TOKEN_DECIMALS[upperSymbol] ?? 18;
}

