import express from 'express';
import worker from './src/worker.js';
import { getDatabase } from './src/db.js';
import { runSupervisor } from './src/supervisor.js';
import type { Env } from './src/types.js';
import dotenv from 'dotenv';

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

const { d1 } = getDatabase();

const env: Env = {
  DB: d1 as unknown as D1Database,
  ADMIN_KEY: process.env.ADMIN_KEY || 'taxi-admin-2025',
  AI_BASE_URL: process.env.AI_BASE_URL,
  AI_API_KEY: process.env.AI_API_KEY || process.env.GEMINI_API_KEY,
  AI_MODEL: process.env.AI_MODEL,
};

// Periodic background supervisor
setInterval(async () => {
  try {
    await runSupervisor(env);
  } catch (e) {
    // silent
  }
}, 30000);

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
  });
}

