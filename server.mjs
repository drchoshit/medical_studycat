import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { Readable } from 'node:stream';

const root = resolve('dist');
const port = Number(process.env.PORT || 3000);

const proxyTargets = {
  '/medischedule-api': process.env.MEDISCHEDULE_API_BASE || 'https://medischedule.kr/api',
  '/mentoring-api': process.env.MENTORING_API_BASE || 'https://mentoring-api-6l1a.onrender.com',
  '/penalty-api': process.env.MEDIPENALTY_API_BASE || 'https://medipenalty.kr/api',
};

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

async function proxyRequest(req, res, prefix, targetBase) {
  const path = req.url.slice(prefix.length) || '/';
  const target = new URL(`${targetBase.replace(/\/$/, '')}${path}`);
  const headers = { ...req.headers, host: target.host };
  delete headers.connection;

  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : Readable.toWeb(req),
      duplex: 'half',
      redirect: 'manual',
    });

    res.writeHead(upstream.status, Object.fromEntries(upstream.headers.entries()));
    if (upstream.body) {
      Readable.fromWeb(upstream.body).pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    send(
      res,
      502,
      JSON.stringify({ error: 'Proxy request failed', detail: error instanceof Error ? error.message : String(error) }),
      { 'content-type': 'application/json; charset=utf-8' },
    );
  }
}

function serveStatic(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
  const requested = normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
  let filePath = resolve(join(root, requested));

  if (!filePath.startsWith(root)) {
    send(res, 403, 'Forbidden', { 'content-type': 'text/plain; charset=utf-8' });
    return;
  }

  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    filePath = join(root, 'index.html');
  }

  const type = mimeTypes[extname(filePath)] || 'application/octet-stream';
  res.writeHead(200, { 'content-type': type });
  createReadStream(filePath).pipe(res);
}

createServer((req, res) => {
  const match = Object.entries(proxyTargets).find(([prefix]) => req.url === prefix || req.url.startsWith(`${prefix}/`));
  if (match) {
    void proxyRequest(req, res, match[0], match[1]);
    return;
  }

  serveStatic(req, res);
}).listen(port, '0.0.0.0', () => {
  console.log(`medical-studycat listening on ${port}`);
});
