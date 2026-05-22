// Lightweight capture server for the Sen Money DS Mapper Figma plugin.
// Run alongside your Vite app:  node figma-plugin/capture-server/server.mjs
//
// It serves:
//   GET  /capture/latest   -> { screenshotBase64, usageJson, tsx, width, height }
//   POST /capture          -> body: { screenshotBase64, usageJson, tsx, width, height }
//
// In your preview app, add a small dev-only button that calls html2canvas on
// #root, then POSTs the PNG + the current usage.json + App.tsx source here.
// Then in the Figma plugin click "Capture from preview".

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const PORT = Number(process.env.CAPTURE_PORT || 8765);
const STORE = path.join(process.cwd(), '.capture-latest.json');

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

const server = http.createServer((req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.method === 'GET' && req.url === '/capture/latest') {
    if (!fs.existsSync(STORE)) { res.writeHead(404); res.end('no capture yet'); return; }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(fs.readFileSync(STORE));
    return;
  }

  if (req.method === 'POST' && req.url === '/capture') {
    let buf = '';
    req.on('data', c => { buf += c; });
    req.on('end', () => {
      try {
        const json = JSON.parse(buf);
        fs.writeFileSync(STORE, JSON.stringify(json));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(400); res.end(String(e.message || e));
      }
    });
    return;
  }

  res.writeHead(404); res.end('not found');
});

server.listen(PORT, () => {
  console.log(`Capture server listening on http://localhost:${PORT}`);
  console.log(`  GET  /capture/latest   <- Figma plugin pulls from here`);
  console.log(`  POST /capture          <- your preview app posts here`);
});
