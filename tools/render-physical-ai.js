// 첫 화면 인트로 "Physical AI with micro:bit"(bridge/intro/physical-ai.js)를 mp4로 굽기 — 웹 애니메이션과 같은 코드
// 실행: node tools/render-physical-ai.js [사이트주소] [작업폴더]
//   사이트주소: bridge/ 를 여는 로컬 서버(기본 http://127.0.0.1:8765/). 영상을 읽지 않으므로 python http.server도 됨.
//   결과: bridge/assets/intro/physical-ai.mp4 (1920×1080, 30fps, H.264, faststart)
//   PORTRAIT=1 이면 세로판(1080×1920) bridge/assets/intro/physical-ai-portrait.mp4 도 만듦.
//   INTRO_TEST=1 이면 몇 장만 뽑아 확인(영상은 만들지 않음).
// 필요: playwright(크로미움), ffmpeg. 소프트웨어 렌더로 1~3분.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os'), { execFileSync } = require('child_process');
const BASE = (process.argv[2] || 'http://127.0.0.1:8765/').replace(/\/?$/, '/');
const WORK = process.argv[3] || fs.mkdtempSync(path.join(os.tmpdir(), 'pai-'));
const TEST = !!process.env.INTRO_TEST, FPS = 30, DUR = 14;
const OUTDIR = path.join(__dirname, '../bridge/assets/intro');
const pad = (n) => String(n).padStart(4, '0');

async function shoot(b, W, H, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  p.on('pageerror', (e) => { throw e; });
  await p.goto(BASE + 'intro/physical-ai.html?cap&t=0');
  await p.waitForFunction('window.__ready', null, { timeout: 60000 });   // 글꼴(Pretendard)이 준비된 뒤에 켜짐
  const N = Math.round(DUR * FPS);
  const list = TEST ? [0, 45, 100, 200, 300, 380, N] : [...Array(N + 1).keys()];
  for (const n of list) {
    await p.evaluate((t) => window.__seek(t), n / FPS);
    await p.screenshot({ path: path.join(dir, `f${pad(n)}.png`) });
    if (n % 60 === 0) console.log(`${W}x${H}`, (n / FPS).toFixed(1) + 's');
  }
  await p.close();
}
function encode(dir, out) {
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(dir, 'f%04d.png'),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '22', '-tune', 'animation', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: 'inherit' });
  console.log(out, (fs.statSync(out).size / 1e6).toFixed(2) + 'MB');
}

(async () => {
  const b = await chromium.launch();
  await shoot(b, 1920, 1080, path.join(WORK, 'land'));
  if (process.env.PORTRAIT) await shoot(b, 1080, 1920, path.join(WORK, 'port'));
  await b.close();
  if (TEST) { console.log('시험 완료:', WORK); return; }
  encode(path.join(WORK, 'land'), path.join(OUTDIR, 'physical-ai.mp4'));
  if (process.env.PORTRAIT) encode(path.join(WORK, 'port'), path.join(OUTDIR, 'physical-ai-portrait.mp4'));
})();
