import express from 'express';
import path from 'path';
import fs from 'fs';
import worker from './src/worker.js';
import { getDatabase } from './src/db.js';
import { runSupervisor } from './src/supervisor.js';
import type { Env } from './src/types.js';
import dotenv from 'dotenv';
import { fork } from 'child_process';

dotenv.config();

const app = express();
const PORT = 3000;

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static assets (PWA manifest, service worker, icons, favicons)
app.use(express.static('public', {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('sw.js')) {
      res.setHeader('Service-Worker-Allowed', '/');
      res.setHeader('Cache-Control', 'no-cache');
    } else if (filePath.endsWith('manifest.json')) {
      res.setHeader('Content-Type', 'application/manifest+json');
    }
  }
}));

// Static client bundle from Vite build
if (fs.existsSync(path.resolve(process.cwd(), 'dist'))) {
  app.use(express.static('dist'));
}

// React UniversityLinesManager SPA route
app.get(['/lines', '/lines-manager', '/manager', '/app'], (req, res) => {
  const distIndex = path.resolve(process.cwd(), 'dist/index.html');
  if (fs.existsSync(distIndex)) {
    return res.sendFile(distIndex);
  }
  res.sendFile(path.resolve(process.cwd(), 'index.html'));
});

const { d1 } = getDatabase();

const env: Env = {
  DB: d1 as unknown as D1Database,
  ADMIN_KEY: process.env.ADMIN_KEY || '442433',
  AI_BASE_URL: process.env.AI_BASE_URL,
  AI_API_KEY: process.env.AI_API_KEY || process.env.GEMINI_API_KEY,
  AI_MODEL: process.env.AI_MODEL,
};

// تشغيل بوابة واتساب تلقائياً في الخلفية
let gatewayChild: any = null;

function ensureGatewayRunning() {
  if (process.env.VERCEL) return;
  if (gatewayChild && !gatewayChild.killed && gatewayChild.exitCode === null) {
    return;
  }
  try {
    const gatewayEnv = {
      ...process.env,
      ADMIN_KEY: env.ADMIN_KEY,
      WORKER_URL: 'http://127.0.0.1:3000',
      GATEWAY_PORT: '3010',
    };
    gatewayChild = fork('./gateway/start.mjs', [], {
      env: gatewayEnv,
      stdio: 'inherit',
      cwd: process.cwd(),
    });
    gatewayChild.on('error', (e: any) => console.warn('[Gateway Child Error]', e));
    gatewayChild.on('exit', (code: any) => {
      console.log(`[Gateway Child Exit] code=${code}. Restarting in 5s...`);
      gatewayChild = null;
      setTimeout(ensureGatewayRunning, 5000);
    });
  } catch (err) {
    console.warn('[Gateway Child Start Error]', err);
  }
}

// Periodic background supervisor (run only in continuous server environments, not Vercel serverless)
if (!process.env.VERCEL) {
  setInterval(async () => {
    try {
      await runSupervisor(env);
    } catch (e) {
      // silent
    }
  }, 30000);
}

// Proxy requests to the WhatsApp Gateway
app.all('/api/gateway/*', async (req, res) => {
  const targetPath = req.path.replace(/^\/api\/gateway/, '');
  const query = req.url.includes('?') ? '?' + req.url.split('?')[1] : '';
  const baseGwUrl = (process.env.WHATSAPP_GATEWAY_URL || process.env.WHATSAPP_SERVER_URL || process.env.GATEWAY_URL || 'http://127.0.0.1:3010').replace(/\/+$/, '');
  const gatewayUrl = `${baseGwUrl}${targetPath}${query}`;
  try {
    const adminKey = env.ADMIN_KEY;
    const bodyData = ['GET', 'HEAD'].includes(req.method)
      ? undefined
      : (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));

    const gRes = await fetch(gatewayUrl, {
      method: req.method,
      headers: {
        'content-type': 'application/json',
        'x-gateway-token': adminKey,
      },
      body: bodyData,
      signal: AbortSignal.timeout(8000),
    });
    const data = await gRes.text();
    res.status(gRes.status);
    gRes.headers.forEach((v, k) => {
      if (k.toLowerCase() !== 'content-length') {
        res.setHeader(k, v);
      }
    });
    res.send(data);
  } catch (err: any) {
    res.status(502).json({
      ok: false,
      error: 'Gateway offline',
      details: err?.message,
      connection: 'disconnected',
      hint: 'إذا كنت تستخدم Vercel أو بيئة Serverless، يرجى تشغيل Gateway على سيرفر دائم (مثل Render/Railway) وضبط متغير البيئة WHATSAPP_GATEWAY_URL'
    });
  }
});

// Route all requests to worker.fetch
app.all('*', async (req, res) => {
  try {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:3000';
    const fullUrl = `${protocol}://${host}${req.originalUrl || req.url}`;
    
    // Build Headers
    const headers = new Headers();
    for (const [key, val] of Object.entries(req.headers)) {
      if (val) {
        if (Array.isArray(val)) {
          for (const v of val) headers.append(key, v);
        } else {
          headers.set(key, val);
        }
      }
    }

    // Build Request body
    let body: string | undefined;
    if (!['GET', 'HEAD'].includes(req.method)) {
      if (typeof req.body === 'string') {
        body = req.body;
      } else if (req.body && Object.keys(req.body).length > 0) {
        body = JSON.stringify(req.body);
      }
    }

    const webReq = new Request(fullUrl, {
      method: req.method,
      headers,
      body,
    });

    const webRes = await worker.fetch(webReq, env);

    // Apply status and headers
    res.status(webRes.status);
    webRes.headers.forEach((val, key) => {
      res.setHeader(key, val);
    });

    // Send response body
    const arrayBuffer = await webRes.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal Server Error', details: String(err) });
  }
});

export default app;

if (!process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚕 منظومة العياط وباصات الجامعات تعمل على http://0.0.0.0:${PORT}`);
    ensureGatewayRunning();
  });
}

