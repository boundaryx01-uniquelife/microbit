// 포니봇(boundaryX · micro:bit 메카넘 4바퀴) 어댑터 — 통합 시뮬레이터(bridge/sim/index.html)가 ?kit=ponybot 일 때 읽음.
// 로봇 모델·API·실행기·그리기·예제·도우미 코드는 ./ponybot/ 아래(옛 bridge/ponybot/sim/ 에서 옮김). 이 파일은 그것을 공용 화면에 꽂는 부분.
import { ensureBabel } from '../runtime.js';
import * as PROPS from '../props.js';
import { validateCode } from '../validate-code.mjs';
import { EST, MOTOR_WHEEL, SCENES, PonyWorld, PonyRobot, PonyRunner, makePonybotApi, needsFromCode } from './ponybot/pony.js';
import { PonyView, drawOled } from './ponybot/view.js';
import { EXAMPLES as RAW_EXAMPLES } from './ponybot/examples.js';
import { ponyAssistant, configurePony, SAMPLE_REQUESTS } from './ponybot/assistant.js';

const OFFICIAL = new URL('../../ponybot/assets/official/', import.meta.url).href;
const EXT_REPO = 'https://github.com/boundary-x/ai_ponybot_basic';
const $ = (id) => document.getElementById(id);

// ---- 예제: 원본(생성물) 위에 묶음·따라 하기 글을 덧붙임 (원본 파일은 고치지 않음) ----
export const GROUPS = [
  { id: 'button', title: '🅰 A·B 버튼으로 해 보기', note: '마이크로비트 1개. 실행한 뒤 화면의 A·B 버튼을 눌러 시작해요' },
  { id: 'radio', title: '📡 라디오 숫자로 해 보기 (AI 브리지·리모컨)', note: '마이크로비트 2개 또는 AI 브리지. 숫자를 받아 움직여요. 여기서는 숫자 버튼이 그 역할이에요' },
];
const RADIO_IDS = new Set(['03_ai-traffic-ponybot', '04_ai-team-template']);
export const EXAMPLES = RAW_EXAMPLES.map(e => {
  const group = RADIO_IDS.has(e.id) ? 'radio' : 'button';
  const input = group === 'radio' ? '위 [라디오로 숫자 보내기]에서 숫자를 눌러 보세요' : 'A·B 버튼을 눌러 보세요';
  return {
    ...e, group, level: e.simOnly ? '시뮬레이터 전용' : '',
    sim: ['[▶ 실행]을 누르세요 (실행만으로는 움직이지 않는 예제가 많아요)', `${input} — ${e.how}`, '움직임은 오른쪽 위에서 본 바닥, 포니봇 화면(OLED)·바퀴 표에서 확인해요'],
    real: e.simOnly
      ? ['시뮬레이터에서 장면을 시험하는 예제예요', '실물에 쓰기 전 속도·센서 값은 선생님과 함께 확인하세요']
      : ['MakeCode(블록 코딩 탭)의 코드를 마이크로비트에 내려받기', '포니봇에 꽂고 전원 켜기 — 바닥이나 울타리 안에서 시험', '바퀴 방향이 화면과 다르면 기록해 두고 선생님께 알리기(실물 확인 항목)'],
  };
});

// ---- 코드에서 장치 찾기 ----
export const DEVICE_INFO = {
  mbBtn: { icon: '🅰', label: '마이크로비트 A·B 버튼', how: '[마이크로비트]의 A·B 버튼이나 로봇 위 빠른 조작 칸의 A·B를 누르세요(실물에서 포니봇에 꽂았을 때 버튼이 눌리는지는 확인 필요)', panel: 'pMb' },
  radio: { icon: '📡', label: '라디오 숫자 받기(AI 브리지·리모컨)', how: '[라디오로 숫자 보내기]의 숫자 버튼 = AI 브리지가 보내는 숫자예요. 2초 안에 다시 보내야 하는 예제는 [계속 보내기]를 켜세요', panel: 'pRadio' },
  ping: { icon: '📏', label: '거리센서(초음파) + 장애물', how: '앞에 책·상자를 놓았어요. 끌어 옮기면 거리 값이 바로 바뀌어요(못 읽으면 500)', panel: 'pPSensor' },
  line: { icon: '➖', label: '라인 센서 + 검은 선', how: '장면을 컬러칩 서킷으로 하거나 [선 편집] 도구로 검은 선을 그려 보세요', panel: 'pPSensor', warn: true },
  color: { icon: '🎨', label: '컬러 센서 + 컬러칩', how: '컬러칩 위에 포니봇을 놓으면 색 값이 바뀌어요', panel: 'pPSensor', warn: true },
  oled: { icon: '🖥', label: '포니봇 화면(OLED 128×64)', how: '오른쪽 아래 [포니봇 화면]에 글자가 나와요', panel: 'pPOled' },
  mbLed: { icon: '🔲', label: '마이크로비트 LED', how: '[마이크로비트]의 5×5 불빛에 나와요', panel: 'pMb' },
};
function strip(src) {
  return String(src || '').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`/g, ' ');
}
export function detectDevices(code) {
  const c = strip(code), out = [], has = (re) => re.test(c);
  if (has(/input\.(onButtonPressed|buttonIsPressed)\s*\(/)) out.push('mbBtn');
  if (has(/radio\.onReceived(Number|Value|String)\s*\(/)) out.push('radio');
  if (has(/\bping\s*\(/)) out.push('ping');
  if (has(/\b(readLineSensor|checkTwoLineState|checkSingleLineSensor)\b/)) out.push('line');
  if (has(/\b(isColorAdvanced|getRed|getGreen|getBlue|getLight|isColorInRange)\s*\(/)) out.push('color');
  if (has(/aiPonybot\.(showString|showNumber|printString|printNumber|pixel|rectangle|horizontalLine|verticalLine)\s*\(/)) out.push('oled');
  if (has(/basic\.(showNumber|showString|showIcon|showLeds|showArrow)\s*\(|led\.(plot|unplot|toggle)\s*\(/)) out.push('mbLed');
  return out;
}
export function runHint(devs) {
  const parts = [];
  if (devs.includes('mbBtn')) parts.push('A·B 버튼');
  if (devs.includes('radio')) parts.push('라디오 숫자');
  if (devs.includes('ping')) parts.push('장애물');
  if (devs.includes('line')) parts.push('검은 선');
  if (devs.includes('color')) parts.push('컬러칩');
  return parts.length ? parts.join(' · ') + '(으)로 시험해 보세요' : '포니봇 움직임을 지켜보세요';
}

// ---- 말로 코드 만들기 ----
let POLICY = {};
let assistReady = null;
function loadAssistant(log) {
  const get = (p) => fetch(new URL(p, import.meta.url)).then(r => { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); });
  assistReady = Promise.all([get('./ponybot/data/blocks.json'), get('./ponybot/data/policy.json'), ensureBabel()])
    .then(([blocks, policy]) => { POLICY = policy; configurePony({ blocks, validateCode, Babel: window.Babel }); })
    .catch(e => log('도우미 준비 실패: ' + e.message, 'warn'));
  return assistReady;
}

// ---- 모델 ----
let M = null;   // { world, robot, runner, api } — 화면이 만든 뒤 init 에서 채움
const SCENE_IMG = { bowling: 'activity-bowling.webp', circuit: 'activity-circuit.webp', relay: 'activity-relay.webp' };
const f1 = (v) => (Math.round(v * 10) / 10).toFixed(1);

const kit = {
  id: 'ponybot',
  name: '포니봇',
  docTitle: '포니봇 시뮬레이터 · AI 포니봇 교실',
  codeKey: 'ponybot-sim-code',
  supports3d: true, default3d: false,   // 3D 모형은 실물 사진 기준 어림 모형(처음 화면은 2D, [3D 보기]로 전환 / ?view=3d)
  async makeView3D(container, world, robot, runner) { const { PonyView3D } = await import('./ponybot/model3d.js'); return new PonyView3D(container, world, robot, runner.oled); },
  radius: EST.radius,
  mascot: { src: OFFICIAL + 'material-pony-v2.webp', alt: 'AI 포니봇 제품 그림 (제조사 바운더리엑스 공식 자료)' },
  brand: { name: 'AI 포니봇 교실', sub: '바운더리엑스 제품 · 피지컬 AI 수업', home: '../' },
  nav: [
    { text: '처음', href: '../' },
    { text: '시뮬레이터', href: './?kit=ponybot', current: true },
    { text: '공식 확장 ↗', href: EXT_REPO, ext: true, title: '새 탭에서 열기(GitHub)' },
  ],
  badge: { text: '움직임 추정 · 실물과 다를 수 있음', title: '속도·회전·크기·센서 위치는 실물 측정값이 아닌 추정치예요' },
  footer: 'AI 포니봇은 바운더리엑스(boundary X)의 제품이에요. 이 시뮬레이터는 공식 확장(MIT)과 공개 자료를 참고해 만든 교육용 미리 보기예요. · <a href="../ponybot/assets/official/SOURCE.md">그림·자료 출처</a>',
  ui: {   // id → innerHTML (없는 것은 로보독 기본 글)
    codeHint: '블록 코딩 화면에서 블록을 고치면 <b data-kn>포니봇</b>이 바로 움직여요. MakeCode가 안 열리면 <b>글자 코드</b> 탭에 코드를 붙여넣고 <b>▶ 실행</b>. <b>A·B 버튼이나 라디오 숫자를 눌러야</b> 움직이는 예제가 많아요.',
    mcNote: '진짜 MakeCode 편집기예요(makecode.microbit.org). <b>AI 포니봇 확장</b>(aiPonybot 블록)이 미리 들어 있어요. 블록을 고치면 오른쪽 포니봇이 그대로 움직여요. 마이크로비트에 내려받기는 편집기 아래 [다운로드]를 쓰세요. 프로젝트는 이 화면의 코드 칸에 저장돼요.',
    estNote: '⚠ 시뮬레이터는 <b>미리 보기</b>입니다. 바퀴 속도(속도 255 ≈ 30cm/초)·가감속·크기·센서 위치는 <b>추정치</b>예요. 모터 번호→바퀴 위치(M1=오른쪽 앞·M2=오른쪽 뒤·M3=왼쪽 뒤·M4=왼쪽 앞)는 <b>사진 근거(기판 글자)</b>예요. 앞 = 초음파 쪽: 실물 확인(2026-11-11, 사용자). 회전 방향은 사진·블록 화살표 근거 — 실물 회전 방향 확인 권장(코드 이름 Clockwise 는 화살표 ↶(반시계)와 반대예요).',
    realSummary: '🐴 실물 포니봇으로 해 보기',
    mapNote: '장면(소품·검은 선)을 <b>내 지도</b>로 저장하고 나눌 수 있어요. 지도를 고르면 바닥 크기도 바뀌어요. 검은 선 지도는 라인 센서 예제용이에요.',
    askPlaceholder: '예) A 버튼 누르면 앞으로 2초 가',
  },
  examplePlaceholder: '예제 고르기 (A·B 버튼 / 라디오 숫자)…',
  groups: GROUPS,
  examples: EXAMPLES,
  defaultExampleId: '01_hello-ponybot',
  mapOpts: { tiles: true, mapLabel: (m) => `포니봇용(라인 센서) · ${m.title}` },
  buildMapPanel: true,
  detectDevices, DEVICE_INFO, runHint, needsFromCode,
  assistant: {
    ai: false, sample: SAMPLE_REQUESTS,
    ruleNote: '정해진 표현(A·B 버튼·라디오·가까우면·라인·색 / 앞·뒤·옆·돌기·멈춤·OLED 글자)을 알아들어요. 글은 이 컴퓨터 밖으로 나가지 않아요. 이름·학교는 쓰지 마세요.',
    get ready() { return assistReady; },
    rule(text) { return ponyAssistant(text, POLICY); },
  },
  makecode: {
    projectName: '포니봇 시뮬레이터', idPrefix: 'ponybot-sim-',
    base: { core: '*', radio: '*' },
    pins: { 'ai-ponybot-basic': 'github:boundary-x/ai_ponybot_basic#63fa6aac90447084e7acdcb65d267ec43be7cc0b' },
    blockPackage: (code) => (/\baiPonybot\./.test(code) ? 'ai-ponybot-basic=github:boundary-x/ai_ponybot_basic' : undefined),
  },
  demos: null,   // 자동 시연 없음(예제를 실행해 직접 눌러 보는 방식)

  // ----- 모델·실행기·그리기 -----
  createModel() { const world = new PonyWorld(); return { world, robot: new PonyRobot(world) }; },
  createRunner(robot, ui) { return new PonyRunner(robot, ui); },
  makeView2D(top, side, world, robot) { return new PonyView(top, world, robot); },
  editorOpts({ world, robot, runner }) {
    return {
      getSize: () => world.size,
      storageKey: () => 'ponybot-sim.scene.v1.' + world.sceneId,
      getMeta: () => ({ scene: world.sceneId, size: { ...world.size }, start: { ...world.start } }),
      applyMeta: (m) => { if (m.size && (m.size.w !== world.size.w || m.size.h !== world.size.h)) { world.setField({ size: m.size, start: m.start }); robot.reset(); } },
      onMessage: () => {},
      onChange: (reason, d) => { if (reason === 'preset' && d.start) { world.start = { ...world.start, ...d.start }; if (!runner.running) robot.reset(); } },
    };
  },
  // 코드가 읽는 센서(거리·선·색)에 맞춰 없는 환경만 채움(사용자가 놓은 것은 그대로)
  autoSetup(code, { world, robot, log }) {
    const needs = needsFromCode(code);
    if (!needs.length) return [];
    const notes = PROPS.ensureFor(needs, world.props, robot, world, { robotRadius: EST.radius });
    notes.forEach(n => log(n));
    return notes;
  },
  applyField(f, ctx) {   // 지도·타일 불러오기: 월드 크기·시작 자리·소품을 바꾸고 로봇을 시작 자리로
    const { world, robot, runner } = ctx;
    runner.stop(); world.setField({ size: f.size, start: f.start, props: f.props });
    robot.reset();
    const sel = $('scene'); let o = sel.querySelector('option[value="map"]');
    if (!o) { o = document.createElement('option'); o.value = 'map'; sel.appendChild(o); }
    o.textContent = '지도: ' + (f.title || '내 지도'); sel.value = 'map';
    $('sceneImg').hidden = true; $('sceneHint').textContent = f.title ? `지도 “${f.title}” — 지도 설정에서 고르고 고칠 수 있어요.` : '';
  },
  // 예제를 고르면 그 예제의 장면으로
  onExample(ex, ctx) { if (ex && ctx.world.sceneId !== ex.scene && ctx.world.sceneId !== 'map') kit.setScene(ex.scene); },
  setScene(id) {
    const { world, robot, runner, editor } = M;
    runner.stop(); world.loadScene(id); robot.reset();
    const tmp = $('scene').querySelector('option[value="map"]'); if (tmp) tmp.remove();
    $('scene').value = world.sceneId; if (editor()) editor().select(null);
    const img = $('sceneImg'), f = SCENE_IMG[world.sceneId];
    if (f) { img.src = OFFICIAL + f; img.alt = world.scene.title + ' 공식 활동 그림 (바운더리엑스)'; img.hidden = false; } else img.hidden = true;
    $('sceneHint').textContent = world.scene.hint;
    runner.running = false;
  },

  // 화면 켜질 때 한 번: 장면 고르기·표·추정값 채우기
  init(ctx) {
    const { world, robot, runner, log } = ctx;
    M = { world, robot, runner, api: makePonybotApi(robot, { oled: runner.oled }), editor: () => ctx.editor, lastOled: -1, lastSlow: 0 };
    Object.entries(SCENES).forEach(([id, s]) => { const o = document.createElement('option'); o.value = id; o.textContent = s.title; $('scene').appendChild(o); });
    $('scene').addEventListener('change', () => { if ($('scene').value !== 'map') kit.setScene($('scene').value); });
    const wh = $('whBody');
    [1, 2, 3, 4].forEach(m => { const tr = document.createElement('tr'); tr.innerHTML = `<td>M${m}</td><td>${MOTOR_WHEEL[m]}</td><td id="wc${m}">0</td><td id="wv${m}">0</td>`; wh.appendChild(tr); });
    $('estList').textContent = JSON.stringify(EST, null, 1).replace(/[{}"]/g, '').replace(/,$/gm, '') + '\n모터→바퀴(사진 근거 · 앞 = 초음파 쪽은 실물 확인 2026-11-11 · 회전 방향은 실물 확인 권장): ' + JSON.stringify(MOTOR_WHEEL);
    loadAssistant(log);
    kit.setScene(world.sceneId);
  },
  // 매 그림 반복: 위에서 본 바닥(+ OLED)
  draw({ view2d, view3d, mode3d }) {
    if (mode3d && view3d) view3d.draw(); else view2d.draw();
    const o = M.runner.oled;
    if (o.version !== M.lastOled) { M.lastOled = o.version; drawOled($('oled'), o); }
  },
  // 센서·바퀴 표(0.1초마다)
  updatePanels(ctx, now) {
    if (now - M.lastSlow < 100) return;
    M.lastSlow = now;
    const { robot, world } = M, api = M.api;
    const d = api.ping(1);
    $('psDist').textContent = d + ' cm' + (d >= 500 ? ' (못 읽음=500)' : '');
    const l = robot.lineRaw(0), r = robot.lineRaw(1);
    $('psL').classList.toggle('on', !!l); $('psR').classList.toggle('on', !!r); $('psLv').textContent = l; $('psRv').textContent = r;
    const c = robot.colorRGB(); $('psSw').style.background = `rgb(${c})`; $('psRgb').textContent = c.map(Math.round).join(', ');
    $('psPose').textContent = `x ${f1(robot.x)}, y ${f1(robot.y)}, 방향 ${f1(((robot.heading % 360) + 360) % 360)}°`;
    $('psVel').textContent = `옆 ${f1(robot.vx)} · 앞 ${f1(robot.vy)} cm/s · 회전 ${f1(robot.omega / Math.PI * 180)}°/s`;
    [1, 2, 3, 4].forEach(m => {
      const u = robot.pwm[m - 1] / 16, el = $('wc' + m), v = robot.w[MOTOR_WHEEL[m]];
      el.textContent = (u > 0 ? '▲ ' : u < 0 ? '▼ ' : '■ ') + Math.round(Math.abs(u)); el.className = u > 0 ? 'p' : u < 0 ? 'n' : '';
      $('wv' + m).textContent = f1(v);
    });
    const sv = robot.servo.map((a, i) => (a == null ? null : `서보${i + 1}=${a}°`)).filter(Boolean);
    $('servoNote').textContent = sv.length ? sv.join(' · ') : '';
    $('score').textContent = world.pins.length ? `쓰러뜨린 핀 ${world.pinsDown()} / ${world.pins.length}` : '';
  },

  // 자동 시험용 창구(옛 window.__pony 와 같은 모양)
  expose(ctx) {
    const { world, robot, runner } = ctx;
    window.__pony = {
      robot, runner, world, view: ctx.view2d, api: M.api, oled: runner.oled, EST, SCENES, props: world.props, editor: ctx.editor, lib: ctx.mapLib, PROPS, needsFromCode,
      autoSetup: () => ctx.autoSetup(ctx.$('code').value), applyField: ctx.applyField,
      setScene: kit.setScene, loadExample: ctx.loadExample, runCode: () => ctx.runCode(ctx.$('code').value), fastForward: (sec) => robot.step(sec),
      setPose(x, y, heading = 0) { robot.x = x; robot.y = y; robot.heading = heading; robot.trail = []; },
      state() { return { x: robot.x, y: robot.y, heading: robot.heading, vx: robot.vx, vy: robot.vy, omega: robot.omega, pwm: robot.pwm.slice(), w: { ...robot.w }, running: runner.running }; },
    };
    window.__ponyReady = true;
  },
};
export default kit;
