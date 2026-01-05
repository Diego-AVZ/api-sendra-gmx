import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  if (request.method === 'GET') {
    return response.status(200).json({
      message: 'Sendra API - GMX Protocol',
      version: '1.0.0',
      status: 'ok',
    });
  }

  if (request.method === 'POST') {
    try {
      const body = request.body;
      return response.status(200).json({
        message: 'POST request received',
        data: body,
      });
    } catch (error) {
      return response.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return response.status(405).json({
    error: 'Method not allowed',
  });
}

