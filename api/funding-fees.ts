import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GMXService } from '../core/services/gmx-service';

const gmxService = new GMXService({
  chainId: 42161,
});

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  if (request.method !== 'GET') {
    return response.status(405).json({
      error: 'Method not allowed',
    });
  }

  try {
    const fundingFees = await gmxService.getFundingFees();
    
    return response.status(200).json({
      success: true,
      data: fundingFees,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching funding fees:', error);
    return response.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

