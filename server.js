// Tiny zero-dependency static server for Render (or any Node host).
// It finds the app folder by itself, so it works whether index.html sits in /public or at the repo root.
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

function findRoot() {
  const tries = [path.join(__dirname, 'public'), __dirname, path.join(__dirname, 'red-bull-soar-app', 'public'), path.join(__dirname, 'red-bull-soar-app')];
  for (const d of tries) if (fs.existsSync(path.join(d, 'index.html'))) return d;
  // last resort: search a few levels down
  const walk = (dir, depth) => {
    if (depth > 3) return null;
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return null; }
    if (entries.some(e => e.isFile() && e.name === 'index.html')) return dir;
    for (const e of entries) if (e.isDirectory() && !['node_modules', '.git'].includes(e.name)) { const r = walk(path.join(dir, e.name), depth + 1); if (r) return r; }
    return null;
  };
  return walk(__dirname, 0) || __dirname;
}
const ROOT = findRoot();
console.log('Serving app from: ' + ROOT);

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webp': 'image/webp', '.mp4': 'video/mp4', '.txt': 'text/plain',
};

function send(res, file, status = 200) {
  const ext = path.extname(file).toLowerCase();
  const stream = fs.createReadStream(file);
  stream.on('open', () => {
    res.writeHead(status, {
      'Content-Type': TYPES[ext] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': ['.html', '.js', '.css', '.webmanifest'].includes(ext) ? 'no-cache' : 'public, max-age=604800',
    });
    stream.pipe(res);
  });
  stream.on('error', () => { // never crash on a missing file
    if (!res.headersSent) { res.writeHead(404, { 'Content-Type': 'text/plain' }); }
    res.end('Not found');
  });
}

http.createServer((req, res) => {
  let p;
  try { p = decodeURIComponent(req.url.split('?')[0]); } catch (e) { p = '/'; }
  if (p === '/health') { res.writeHead(200); return res.end('ok'); }
  if (p.endsWith('/')) p += 'index.html';
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.stat(file, (err, st) => {
    if (!err && st.isFile()) return send(res, file);
    if (path.extname(p)) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
    send(res, path.join(ROOT, 'index.html'));
  });
}).listen(PORT, () => console.log('Red Bull SOAR app running on port ' + PORT));

process.on('uncaughtException', e => console.error('Error (server kept running):', e.message));
