// Static file server with HTTP Range support (needed for video seeking).
// Usage: node rangeserve.js <dir> <port>
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.resolve(process.argv[2] || '.'), port = +(process.argv[3] || 8000);
const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.md': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
http.createServer((req, res) => {
  let f;
  try { f = path.join(root, decodeURIComponent(req.url.split('?')[0])); } catch (e) { res.writeHead(400); return res.end(); }
  if (f !== root && !f.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
  try { if (fs.statSync(f).isDirectory()) f = path.join(f, 'index.html'); } catch (e) {}
  fs.stat(f, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end('not found'); }
    const type = T[path.extname(f).toLowerCase()] || 'application/octet-stream', r = req.headers.range;
    const m = r && /bytes=(\d*)-(\d*)/.exec(r);
    if (m) {
      let a, b;
      if (m[1]) { a = +m[1]; b = m[2] ? Math.min(+m[2], st.size - 1) : st.size - 1; }
      else { a = Math.max(0, st.size - +m[2]); b = st.size - 1; }   // suffix range
      if (a > b || a >= st.size) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }); return res.end(); }
      res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${a}-${b}/${st.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': b - a + 1 });
      fs.createReadStream(f, { start: a, end: b }).pipe(res);
    } else { res.writeHead(200, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': st.size }); fs.createReadStream(f).pipe(res); }
  });
}).listen(port, () => console.log('serving', root, 'on', port));
