// 포니봇 인트로(bridge/ponybot/intro/intro.js)를 mp4로 굽기 — 웹 미리 보기와 같은 코드(시간 t만으로 화면이 정해짐)
// 실행: node tools/render-ponybot-intro.js [사이트주소] [작업폴더]
//   사이트주소: bridge/ 를 여는 로컬 서버(기본 http://127.0.0.1:8765/)
//   결과: bridge/ponybot/assets/intro.mp4 (1280×720, 30fps, H.264, faststart) + intro-poster.jpg(마지막 장면)
//   INTRO_TEST=1 이면 몇 장만 뽑아 확인(영상은 만들지 않음)
// 필요: playwright(크로미움), ffmpeg. 소프트웨어 렌더(WebGL)로 몇 분 걸림.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os'), { execFileSync } = require('child_process');
const BASE = (process.argv[2] || 'http://127.0.0.1:8765/').replace(/\/?$/, '/');
const WORK = process.argv[3] || fs.mkdtempSync(path.join(os.tmpdir(), 'pony-intro-'));
const TEST = !!process.env.INTRO_TEST, FPS = 30, DUR = 20, W = 1280, H = 720;
const OUT = path.join(__dirname, '../bridge/ponybot/assets');
const pad = (n) => String(n).padStart(4, '0');
(async () => {
  fs.mkdirSync(WORK, { recursive: true });
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  p.on('pageerror', (e) => { throw e; });
  await p.goto(BASE + 'ponybot/intro/?cap&t=0');
  await p.waitForFunction('window.__ready', null, { timeout: 60000 });
  const N = Math.round(DUR * FPS);
  const list = TEST ? [0, 60, 130, 190, 270, 310, 400, 460, 540, N] : [...Array(N + 1).keys()];
  for (const n of list) {
    await p.evaluate((t) => window.__seek(t), n / FPS);
    await p.screenshot({ path: path.join(WORK, `f${pad(n)}.png`) });
    if (n % 60 === 0) console.log((n / FPS).toFixed(1) + 's');
  }
  await b.close();
  if (TEST) { console.log('시험 프레임:', WORK); return; }
  const mp4 = path.join(OUT, 'intro.mp4');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(WORK, 'f%04d.png'), '-c:v', 'libx264', '-preset', 'slow', '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4]);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(WORK, `f${pad(N)}.png`), '-q:v', '3', path.join(OUT, 'intro-poster.jpg')]);
  console.log('만듦:', mp4, (fs.statSync(mp4).size / 1048576).toFixed(2) + 'MB');
})().catch((e) => { console.error(e); process.exit(1); });
