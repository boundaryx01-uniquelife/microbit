// Render a deterministic web animation to PNG frames (f0000.png ...).
// Usage: NODE_PATH=$(npm root -g) node render-frames.js --url <page> --seek "window.__seek(t)" \
//   --fps 30 --from 0 --to 8.2 --size 1280x720 --out <dir> [--canvas "<css>"] [--webgl] [--ready "<js expr>"]
// --seek: JS expression using t (seconds); may return a promise.
// --canvas: read pixels via toDataURL in the SAME evaluate as the seek (WebGL buffers clear after the frame).
// Frames cover [from, to] inclusive.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const a = {}; const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) { const k = argv[i].slice(2); const nx = argv[i + 1]; if (nx === undefined || nx.startsWith('--')) a[k] = true; else { a[k] = nx; i++; } }
if (!a.url || !a.seek || !a.out) { console.error('need --url --seek --out'); process.exit(1); }
const fps = +(a.fps || 30), from = +(a.from || 0), to = +(a.to || 0);
const [W, H] = (a.size || '1280x720').split('x').map(Number);
const N = Math.round((to - from) * fps) + 1;
(async () => {
  fs.mkdirSync(a.out, { recursive: true });
  const args = a.webgl ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [];
  const b = await chromium.launch({ args });
  const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  p.on('pageerror', (e) => console.error('pageerror:', e.message));
  await p.goto(a.url);
  if (a.ready) await p.waitForFunction(a.ready, null, { timeout: 180000 });
  const fn = new Function('t', 'sel', `return (async () => { await (${a.seek}); return sel ? document.querySelector(sel).toDataURL('image/png') : null; })();`);
  for (let n = 0; n < N; n++) {
    const t = from + n / fps, name = path.join(a.out, 'f' + String(n).padStart(4, '0') + '.png');
    const data = await p.evaluate(`(${fn.toString()})(${t}, ${JSON.stringify(a.canvas || null)})`);
    if (data) fs.writeFileSync(name, Buffer.from(data.split(',')[1], 'base64'));
    else await p.screenshot({ path: name });
    if (n % 30 === 0) console.log('frame', n + 1, '/', N);
  }
  await b.close();
  console.log('done', N, 'frames ->', a.out);
})();
