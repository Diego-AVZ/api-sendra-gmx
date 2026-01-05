import http from 'http';
import { parse } from 'url';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import indexHandler from './api/index';
import fundingFeesHandler from './api/funding-fees';
import positionsHandler from './api/positions';

const PORT = process.env.PORT || 3000;

function setupVercelResponse(res: http.ServerResponse): VercelResponse {
  const vercelRes = res as unknown as VercelResponse;
  const originalEnd = res.end.bind(res);
  
  (vercelRes as any).status = (code: number) => {
    res.statusCode = code;
    return vercelRes;
  };
  (vercelRes as any).json = (data: any) => {
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'application/json');
    }
    originalEnd(JSON.stringify(data));
    return vercelRes;
  };
  (vercelRes as any).send = (data: any) => {
    originalEnd(data);
    return vercelRes;
  };
  (vercelRes as any).end = () => {
    if (!res.headersSent) {
      originalEnd();
    }
    return vercelRes;
  };
  
  return vercelRes;
}

function setupVercelRequest(req: http.IncomingMessage, parsedUrl: ReturnType<typeof parse>): VercelRequest {
  const vercelReq = req as unknown as VercelRequest;
  
  const cleanQuery: { [key: string]: string | string[] } = {};
  const query = parsedUrl.query || {};
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      cleanQuery[key] = value;
    }
  }
  
  (vercelReq as any).query = cleanQuery;
  (vercelReq as any).method = req.method;
  (vercelReq as any).cookies = {};
  
  return vercelReq;
}

async function handleRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  handler: (req: VercelRequest, res: VercelResponse) => Promise<void | VercelResponse>,
  parsedUrl: ReturnType<typeof parse>
): Promise<void> {
  const vercelReq = setupVercelRequest(req, parsedUrl);
  const vercelRes = setupVercelResponse(res);
  
  let body = '';
  req.on('data', (chunk) => {
    body += chunk.toString();
  });
  
  req.on('end', async () => {
    try {
      if (body) {
        (vercelReq as any).body = JSON.parse(body);
      } else {
        (vercelReq as any).body = {};
      }
    } catch {
      (vercelReq as any).body = body || {};
    }
    
    await handler(vercelReq, vercelRes);
  });
}

const server = http.createServer((req, res) => {
  const parsedUrl = parse(req.url || '/', true);
  const pathname = parsedUrl.pathname || '/';
  
  if (pathname === '/api' || pathname === '/api/') {
    handleRequest(req, res, indexHandler, parsedUrl);
    return;
  }
  
  if (pathname === '/api/funding-fees') {
    handleRequest(req, res, fundingFeesHandler, parsedUrl);
    return;
  }
  
  if (pathname === '/api/positions') {
    handleRequest(req, res, positionsHandler, parsedUrl);
    return;
  }
  
  if (pathname.startsWith('/api')) {
    res.statusCode = 404;
    res.end('Not Found');
    return;
  }
  
  res.statusCode = 404;
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`API available at http://localhost:${PORT}/api`);
});

