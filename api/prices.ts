import type { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'cross-fetch';
import { getTokenDecimals } from '../core/token-decimals';

interface GMXTicker {
  tokenAddress: string;
  tokenSymbol: string;
  minPrice: string;
  maxPrice: string;
  updatedAt: number;
  timestamp: number;
}

interface PriceResponse {
  tokenSymbol: string;
  tokenAddress: string;
  price: string;
  minPrice: string;
  maxPrice: string;
  updatedAt: number;
  timestamp: number;
}

function formatPrice(price: bigint, decimals: number): string {
  const divisor = BigInt(10 ** decimals);
  const quotient = price / divisor;
  const remainder = price % divisor;
  
  if (remainder === 0n) {
    return quotient.toString();
  }
  
  const remainderStr = remainder.toString().padStart(decimals, '0');
  const trimmedRemainder = remainderStr.replace(/0+$/, '');
  
  if (trimmedRemainder === '') {
    return quotient.toString();
  }
  
  return `${quotient}.${trimmedRemainder}`;
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  if (request.method !== 'GET') {
    return response.status(405).json({
      error: 'Method not allowed',
    });
  }

  try {
    const tokensParam = request.query.tokens as string | undefined;

    if (!tokensParam) {
      return response.status(400).json({
        error: 'Bad request',
        message: 'Tokens parameter is required. Use ?tokens=ETH,BTC,SOL',
      });
    }

    const requestedTokens = tokensParam
      .split(',')
      .map((token) => token.trim().toUpperCase())
      .filter((token) => token.length > 0);

    if (requestedTokens.length === 0) {
      return response.status(400).json({
        error: 'Bad request',
        message: 'At least one token must be provided',
      });
    }

    const gmxResponse = await fetch('https://arbitrum-api.gmxinfra.io/prices/tickers');
    
    if (!gmxResponse.ok) {
      throw new Error(`GMX API error: ${gmxResponse.status} ${gmxResponse.statusText}`);
    }

    const allTickers: GMXTicker[] = await gmxResponse.json();

    const filteredTickers = allTickers.filter((ticker) =>
      requestedTokens.includes(ticker.tokenSymbol.toUpperCase())
    );

    const foundTokens = filteredTickers.map((t) => t.tokenSymbol.toUpperCase());
    const notFoundTokens = requestedTokens.filter(
      (token) => !foundTokens.includes(token)
    );

    const prices: PriceResponse[] = filteredTickers.map((ticker) => {
      const decimals = getTokenDecimals(ticker.tokenSymbol);
      const minPriceRaw = BigInt(ticker.minPrice);
      const maxPriceRaw = BigInt(ticker.maxPrice);
      const averagePriceRaw = (minPriceRaw + maxPriceRaw) / 2n;

      const price = formatPrice(averagePriceRaw, decimals);
      const minPrice = formatPrice(minPriceRaw, decimals);
      const maxPrice = formatPrice(maxPriceRaw, decimals);

      return {
        tokenSymbol: ticker.tokenSymbol,
        tokenAddress: ticker.tokenAddress,
        price,
        minPrice,
        maxPrice,
        updatedAt: ticker.updatedAt,
        timestamp: ticker.timestamp,
      };
    });

    const responseData: {
      success: boolean;
      data: PriceResponse[];
      requestedTokens: string[];
      foundTokens: string[];
      notFoundTokens?: string[];
      timestamp: string;
    } = {
      success: true,
      data: prices,
      requestedTokens,
      foundTokens,
      timestamp: new Date().toISOString(),
    };

    if (notFoundTokens.length > 0) {
      responseData.notFoundTokens = notFoundTokens;
    }

    return response.status(200).json(responseData);
  } catch (error) {
    console.error('Error fetching prices:', error);
    return response.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}