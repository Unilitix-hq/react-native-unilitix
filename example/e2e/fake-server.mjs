// A fake Unilitix ingest API for the example app's e2e job. Accepts every
// request (gzip bodies included), answers like the real API, and exposes
// what it received at GET /__received.
//
//   node example/e2e/fake-server.mjs [port]   (default 8787)
import { createServer } from 'node:http';
import { gunzipSync } from 'node:zlib';

const port = Number(process.argv[2] ?? process.env.PORT ?? 8787);
const received = [];

const server = createServer((req, res) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    if (req.method === 'GET' && req.url === '/__received') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(received));
      return;
    }
    let raw = Buffer.concat(chunks);
    if (req.headers['content-encoding'] === 'gzip' && raw.length > 0) {
      raw = gunzipSync(raw);
    }
    let body = null;
    try {
      body = raw.length ? JSON.parse(raw.toString('utf8')) : null;
    } catch {
      body = raw.toString('utf8').slice(0, 200);
    }
    const path = (req.url ?? '').split('?')[0];
    received.push({ method: req.method, path, body });
    console.log(`${req.method} ${path}`);
    const events = Array.isArray(body?.events) ? body.events.length : 0;
    res.writeHead(202, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify(
        path.startsWith('/v1/ingest/identify')
          ? { updated: true }
          : { received: events, sessionId: body?.sessionId ?? null }
      )
    );
  });
});

server.listen(port, '0.0.0.0', () =>
  console.log(`fake ingest server on :${port}`)
);
