// 첫 화면 인트로 영상(bridge/assets/intro/intro.mp4) 만들기
//   1) '로보독의 첫 산책' 30초(영상 3개 + 3D 로보독 합성)를 프레임 단위로 렌더
//   2) 그 마지막 프레임을 이어받아 엔딩 '별이 모여 눈이 되다'(ending.js, 8.2초)를 렌더
//   3) ffmpeg 로 한 편(mp4)으로 묶음
// 실행: node tools/render-intro.js [사이트주소] [작업폴더]
//   사이트주소: 영상 탐색에 Range 요청이 되는 서버여야 함(python http.server는 안 됨). 기본은 운영 사이트.
//   필요: playwright(크로미움), ffmpeg. 소프트웨어 렌더 기준 수십 분 걸림.
//   INTRO_TEST=1 이면 몇 장만 뽑아 확인(영상은 만들지 않음).
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const BASE = (process.argv[2] || 'https://microbit-bridge.netlify.app/').replace(/\/?$/, '/');
const WORK = process.argv[3] || fs.mkdtempSync(path.join(require('os').tmpdir(), 'intro-'));
const FPS = 30, W = 1280, H = 720, STORY = 30, END = 8.2;
const OUT = path.join(__dirname, '../bridge/assets/intro/intro.mp4');
const pad = (n) => String(n).padStart(4, '0');
const TEST = !!process.env.INTRO_TEST;

(async () => {
  fs.mkdirSync(WORK, { recursive: true });
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  // ---- 1) 첫 산책: 영상 시계를 프레임마다 정확히 맞춘 뒤 3D 합성 화면을 그 자리에서 읽음 ----
  const p = await b.newPage({ viewport: { width: W, height: H + 58 }, deviceScaleFactor: 1 });
  await p.goto(BASE + 'veo.html');
  await p.waitForFunction('window.__samples && window.__veoTex', null, { timeout: 180000 });
  // veo.html의 재생 화면을 화면 전체 크기로 키워 캔버스가 정확히 W×H가 되게
  await p.addStyleTag({ content: `body { overflow: hidden } .player { position: fixed !important; left: 0; top: 0; width: ${W}px !important; height: ${H}px !important; max-height: none !important; border-radius: 0 !important; border: 0 !important; margin: 0 !important; z-index: 99 }` });
  await p.waitForTimeout(800);
  const size = await p.evaluate(() => { const c = document.querySelector('#stage3d canvas'); return [c.width, c.height]; });
  if (size[0] !== W || size[1] !== H) throw new Error('캔버스 크기 ' + size);
  const SH = [['assets/story/veo1.mp4', 0], ['assets/story/veo3.mp4', 10], ['assets/story/veo4.mp4', 20]];
  const N = Math.round(STORY * FPS);
  for (const n of TEST ? [0, 750, N - 1] : [...Array(N).keys()]) {
    const t = n / FPS;
    const data = await p.evaluate(async ({ t, SH }) => {
      const i = t < 10 ? 0 : t < 20 ? 1 : 2, v = window.__veoTex[SH[i][0]].userData.video, lt = Math.min(t - SH[i][1], 9.95);
      v.pause();
      if (Math.abs(v.currentTime - lt) > 1e-3) await new Promise((r) => { v.addEventListener('seeked', r, { once: true }); v.currentTime = lt; });
      window.__samples.seek(0, t);
      return document.querySelector('#stage3d canvas').toDataURL('image/png');   // 그린 직후 같은 작업 안에서 읽기
    }, { t, SH });
    fs.writeFileSync(path.join(WORK, `f${pad(n)}.png`), Buffer.from(data.split(',')[1], 'base64'));
    if (n % 60 === 0) console.log('첫 산책', (t).toFixed(1) + 's');
  }
  await p.close();
  // ---- 2) 엔딩: 첫 산책 마지막 프레임에서 시작 ----
  const last = path.join(WORK, `f${pad(N - 1)}.png`);
  const q = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await q.route('**/__last.png', (r) => r.fulfill({ body: fs.readFileSync(last), contentType: 'image/png' }));
  await q.goto(BASE + 'intro-logo.html?cap&from=__last.png');
  await q.waitForFunction('window.__ready');
  const M = Math.round(END * FPS);
  for (const k of TEST ? [0, 60, M] : [...Array(M + 1).keys()]) {
    await q.evaluate((s) => window.__seek(s), k / FPS);
    await q.screenshot({ path: path.join(WORK, `f${pad(N + k)}.png`) });
  }
  await b.close();
  if (TEST) { console.log('시험 완료:', WORK); return; }
  // ---- 3) 한 편으로 ----
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(WORK, 'f%04d.png'),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', OUT], { stdio: 'inherit' });
  console.log('완료:', OUT, (fs.statSync(OUT).size / 1e6).toFixed(1) + 'MB');
})();
