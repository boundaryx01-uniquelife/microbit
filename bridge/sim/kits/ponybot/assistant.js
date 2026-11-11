// 포니봇 도우미 — 말로 MakeCode 코드 만들기(오프라인 규칙 워크플로, 키·인터넷 불필요)
// 확장: boundary-x/ai_ponybot_basic (네임스페이스 aiPonybot) — 블록 표 kits/ponybot/blocks.json 에서 어휘를 만든다.
//
// 흐름: 입력 검사(길이·개인정보 안내) → 트리거로 문장 나누기 → 구절별 동작 사전 → 코드 템플릿 조립
//       → validateCode(블록 표 검사)로 확인 → 오류면 코드 대신 이유를 돌려줌. 못 알아들은 조각은 경고(추측 안 함).
//
// 사용(브라우저·node 공용 ES 모듈):
//   import { configurePony, ponyAssistant } from './assistant.js';
//   configurePony({ blocks, validateCode, Babel });     // blocks = kits/ponybot/blocks.json 내용
//   const r = ponyAssistant('A 버튼을 누르면 앞으로 2초 동안 가', policy);   // policy = kits/ponybot/policy.json 내용
//   → { code, explanation, warnings, suggestions }
//
// 정책은 교사가 정한 값만 쓴다(maxSpeed·autoStopMs 가 null이면 한도 없음). 확장의 범위(속도 0~255)는 블록 표에서 읽는다.
// 블록 표에 없는 것(기본 블록 basic.*·input.*·radio.*·IconNames)은 아래 ICONS 등 최소 목록만 손으로 둔다.

export const SAMPLE_REQUESTS = [
  '시작하면 OLED에 "HELLO" 라고 쓰고 앞으로 2초 동안 가고 멈춰',
  'A 버튼을 누르면 속도 100으로 오른쪽 옆으로 1초 동안 가',
  'B 버튼을 누르면 시계 방향으로 2초 동안 돌아',
  '거리가 20cm보다 가까우면 멈추고, 아니면 앞으로 계속 가',
  '빨간색이 보이면 멈추고 OLED에 "RED" 라고 써',
  '라인을 만나면 뒤로 1초 동안 가',
  '라디오 1을 받으면 왼쪽 앞 대각선으로 1초 동안 가',
  'A 버튼을 누르면 앞으로 계속 가',
];

const CFG = { blocks: null, validateCode: null, Babel: null };
export function configurePony({ blocks, validateCode, Babel } = {}) {
  if (blocks) CFG.blocks = blocks;
  if (validateCode) CFG.validateCode = validateCode;
  if (Babel) CFG.Babel = Babel;
  VOCAB_CACHE.delete(CFG.blocks);
}

// ───────────────────────── 블록 표에서 어휘 만들기 ─────────────────────────
const NS = 'aiPonybot';
const VOCAB_CACHE = new WeakMap();

// 블록 표에는 한국어 낱말 사전이 없다 → 블록 이름(block_en)과 enum 멤버 이름은 표에서, 말버릇(동의어)만 최소로 여기에 둔다.
// 아래 표의 키(멤버 이름)는 buildVocab 에서 블록 표에 실제로 있는지 검사한다(없으면 오류).
const COLOR_SYNONYMS = { Red: ['빨강', '붉은'], Green: ['녹색'], Blue: ['파랑'], Yellow: ['노랑'] };
const MOVE_ENUM = 'Mecanum', TURN_ENUM = 'DirectionControl';
const MOVE_MEMBERS = ['Forward', 'Backward', 'Left', 'Right', 'LeftForward', 'RightForward', 'LeftBackward', 'RightBackward'];
const TURN_MEMBERS = ['Clockwise', 'CounterClockwise'];
// micro:bit 기본 블록(IconNames)은 블록 표 밖 → 손으로 둔 최소 목록
const ICONS = [
  [/하트|사랑/, 'Heart', '하트'], [/웃|행복|기쁜|기뻐/, 'Happy', '웃는 얼굴'], [/슬픈|슬퍼|우는|울/, 'Sad', '슬픈 얼굴'],
  [/화난|화나/, 'Angry', '화난 얼굴'], [/놀란|놀라/, 'Surprised', '놀란 얼굴'], [/졸린|졸려|잠|자는/, 'Asleep', '잠자는 얼굴'],
  [/헷갈|혼란/, 'Confused', '헷갈리는 얼굴'], [/체크|맞아|예스|\bYes\b/i, 'Yes', '체크'], [/엑스|X\s*표|안\s*돼|\bNo\b/i, 'No', '엑스'], [/별/, 'Star', '별'],
];

function buildVocab(blocks) {
  const ns = (blocks.namespaces || []).find(n => n.name === NS);
  if (!ns) throw new Error(`블록 표에 ${NS} 네임스페이스가 없어요`);
  const fn = (n) => { const f = ns.functions.find(x => x.name === n); if (!f) throw new Error(`블록 표에 ${NS}.${n} 이(가) 없어요`); return f; };
  const en = (n) => { const e = (ns.enums || []).find(x => x.name === n); if (!e) throw new Error(`블록 표에 enum ${n} 이(가) 없어요`); return e; };
  const member = (e, m) => { const x = en(e).members.find(y => y.name === m); if (!x) throw new Error(`블록 표에 ${e}.${m} 이(가) 없어요`); return x; };
  const param = (f, p) => { const x = f.params.find(y => y.name === p); if (!x) throw new Error(`블록 표에 ${f.name}(${p}) 이(가) 없어요`); return x; };
  const V = { ns, fn, en, member, param };
  for (const m of MOVE_MEMBERS) member(MOVE_ENUM, m);
  for (const m of TURN_MEMBERS) member(TURN_ENUM, m);
  const speed = param(fn('runMecanum'), 'speed');
  param(fn('runNormal'), 'speed');
  V.speedRange = [speed.min ?? 0, speed.max ?? 255];                 // 확장의 범위(정책 아님)
  V.pingMax = Number(param(fn('ping'), 'maxCmDistance').default ?? 500);   // 반사가 없으면 이 값(예제 02 주의)
  V.thresholdDefault = Number(param(fn('isColorAdvanced'), 'threshold').default ?? 40);
  ['stopAllMotors', 'showString', 'showNumber', 'clear', 'checkSingleLineSensor', 'initColorSensor'].forEach(fn);
  V.colors = en('DetectedColor').members.map(m => {
    const label = m.block_en || m.name;
    const words = [label.replace(/색$/, ''), ...(COLOR_SYNONYMS[m.name] || [])];
    return { id: m.name, label, words, re: new RegExp(words.join('|')) };
  });
  V.colorWordsRe = V.colors.flatMap(c => c.words).join('|');
  V.versions = en('SensorVersion').members.map(m => m.name);
  return V;
}
function vocabFor(blocks) {
  let V = VOCAB_CACHE.get(blocks);
  if (!V) { V = buildVocab(blocks); VOCAB_CACHE.set(blocks, V); }
  return V;
}

// 블록 한국어 이름에 값을 채워 설명문으로: "메카넘 ↑ 방향 100 속도로 이동"
export function blockText(f, args = {}) {
  return String(f.block_ko || f.block_en || f.name).replace(/%(\w+)/g, (m, n) => (n in args ? args[n] : m)).replace(/\|/g, ' ').replace(/\s+/g, ' ').trim();
}

// ───────────────────────── 말 다루기 ─────────────────────────
const QBASE = 0xE100;                       // 따옴표 안 글자를 문장 나누기에서 보호하는 자리표시 글자
const protectQuotes = (s) => { const q = []; const t = s.replace(/["“”'‘’]([^"“”'‘’]*)["“”'‘’]/g, (m, a) => { q.push(a.replace(/\\/g, '')); return String.fromCharCode(QBASE + q.length - 1); }); return { t, q }; };
const quoteOf = (p, q) => { const m = p.match(/[-]/); return m ? q[m[0].charCodeAt(0) - QBASE] : null; };

function splitPhrases(text) {
  return text.split(/(?:하고\s|한\s*다음(?:에)?|한\s*뒤(?:에)?|그리고|그\s*다음(?:에)?|다음에|이어서|[,!?\n]|\.(?!\d)|→|->|(?<=[가-힣])(?<!라)고\s)/)
    .map(s => s && s.trim()).filter(Boolean);
}
const FILLER = /계속해서|계속|쭉|무한\s*반복|무한히|반복해서|반복|해\s*줘|해줘|해요|해\s*주세요|하기|해라|해|줘|해서|하게|하면/g;
const SKIP_COMMENT = (s) => s.replace(/\s+/g, ' ').slice(0, 60);

// ───────────────────────── 한 구절 → 동작 ─────────────────────────
// st: { V, P, quotes, warn(msg), speed(문장 안에서 앞서 말한 속도), mode: 'once'|'poll' }
function actionsOf(raw, st) {
  const { V, P } = st;
  let p = raw.trim();
  const items = [];
  const blank = (m) => { p = p.slice(0, m.index) + ' '.repeat(m[0].length) + p.slice(m.index + m[0].length); };
  const scan = (re) => [...p.matchAll(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'))];
  const add = (at, lines, desc, extra = {}) => items.push({ at, lines: [].concat(lines), desc, ...extra });
  const runM = V.fn('runMecanum'), runN = V.fn('runNormal');
  const glyph = (e, m) => V.member(e, m).block_en || m;

  // ① 포니봇 화면(OLED)
  const oled = scan(/OLED|올레드|오엘이디|디스플레이|(?:포니봇|로봇)\s*화면/i)[0];
  if (oled) {
    const rest = p.slice(oled.index + oled[0].length);
    const at = oled.index;
    blank(oled);
    const q = quoteOf(p, st.quotes);
    const numM = p.match(/숫자\s*(-?\d+)/);
    if (/지우|지워|꺼/.test(rest) && q === null) { add(at, `aiPonybot.${V.fn('clear').name}()`, blockText(V.fn('clear'))); p = p.replace(/지우\S*|지워\S*/, ' '); }
    else if (q !== null) {
      if (/^-?\d+$/.test(q)) add(at, [`aiPonybot.clear()`, `aiPonybot.showNumber(${q}, 0, 0, 1)`], `OLED에 숫자 ${q} 쓰기`);
      else {
        if (/[^\x20-\x7e]/.test(q)) st.warn('포니봇 화면(OLED)은 영어·숫자만 확실히 나와요(공식 예제도 영어만 써요). 한글은 안 나올 수 있으니 실물로 확인하세요.');
        if (q.length > 21) st.warn(`OLED 글자는 한 줄에 21자쯤까지 보여요("${q.slice(0, 12)}…").`);
        add(at, [`aiPonybot.clear()`, `aiPonybot.showString(${JSON.stringify(q)}, 0, 0, 1)`], `OLED에 "${q}" 쓰기 (${blockText(V.fn('showString'), { text: '"' + q + '"', column: 0, row: 0, color: 1 })})`);
      }
      p = p.replace(/[-]/, ' ');
    } else if (numM) { add(at, ['aiPonybot.clear()', `aiPonybot.showNumber(${numM[1]}, 0, 0, 1)`], `OLED에 숫자 ${numM[1]} 쓰기`); p = p.replace(numM[0], ' '); }
    else if (/거리/.test(p + rest)) { add(at, ['aiPonybot.clear()', 'aiPonybot.showNumber(aiPonybot.ping(aiPonybot.PingUnit.Centimeters), 0, 0, 1)'], 'OLED에 거리(cm) 숫자 쓰기'); p = p.replace(/거리\S*/, ' '); }
    else { st.warn('OLED에 무엇을 쓸지 알려 주세요. 예: OLED에 "HELLO" 라고 써'); items.push({ at, lines: [], desc: '', handled: true }); }
  }
  // ② micro:bit LED 아이콘 (포니봇 화면과 구분: 마이크로비트·LED·아이콘을 말했을 때만)
  const led = scan(/마이크로\s*비트\s*(?:화면|LED|엘이디)?|(?<![A-Za-z])LED|엘이디|아이콘/)[0];
  if (led) {
    const at = led.index;
    if (/(지우|지워|꺼)/.test(p.slice(led.index))) { add(at, 'basic.clearScreen()', 'LED 화면 지우기'); blank(led); p = p.replace(/지우\S*|지워\S*|꺼\S*/, ' '); }
    else {
      const ic = ICONS.find(([re]) => re.test(p));
      blank(led);
      if (ic) { add(at, `basic.showIcon(IconNames.${ic[1]})`, `LED 화면에 ${ic[2]} 아이콘 보이기`); p = p.replace(ic[0], ' '); }
      else { st.warn(`LED 아이콘 이름을 못 알아들었어요(${ICONS.map(i => i[2]).join('·')} 중에서 말해 보세요).`); items.push({ at, lines: [], desc: '', handled: true }); }
    }
  }
  // ③ 기다리기: "2초 동안 기다려"
  for (const m of scan(/(\d+(?:\.\d+)?)\s*초\s*(?:동안\s*)?(?:기다|쉬|대기|가만히|멈춰\s*있)\S*/)) {
    add(m.index, `basic.pause(${Math.round(Number(m[1]) * 1000)})`, `${m[1]}초 기다리기`); blank(m);
  }
  // ④ 방향: 회전 → 대각선 → 옆 → 뒤로 돌기(거절) → 뒤 → 앞
  const turnVerb = /돌|회전|턴/.test(p);
  const degree = /(\d+)\s*도(?![착])|한\s*바퀴|반\s*바퀴|빙글/.test(p) && turnVerb;
  const moves = [];
  const mv = (at, member, label) => moves.push({ at, e: MOVE_ENUM, member, label, kind: 'move' });
  const tn = (at, member, label) => moves.push({ at, e: TURN_ENUM, member, label, kind: 'turn' });
  if (/뒤로\s*돌|돌아\s*서|도는\s*방향/.test(p) && degree) { /* 아래 degree 경고가 처리 */ }
  for (const m of scan(/반시계\s*(?:방향)?(?:으로)?/)) { tn(m.index, 'Clockwise', '반시계 방향(↶)으로 돌기'); blank(m); }
  for (const m of scan(/시계\s*(?:방향)?(?:으로)?/)) { tn(m.index, 'CounterClockwise', '시계 방향(↷)으로 돌기'); blank(m); }
  if (turnVerb) for (const m of scan(/(왼|오른)쪽?(?:으로|\s*방향으로)?\s*(?:제자리에서\s*)?(?=\S*\s*(?:돌|회전|턴)|돌|회전|턴)/)) { tn(m.index, m[1] === '왼' ? 'Clockwise' : 'CounterClockwise', `${m[1]}쪽(${m[1] === '왼' ? '↶' : '↷'})으로 돌기`); blank(m); }
  if (degree) {
    st.warn('각도(N도·한 바퀴)로 돌기는 못 만들어요 — 포니봇은 각도 센서가 없어서 시간으로만 정해요. 예: "시계 방향으로 2초 동안 돌아"');
    moves.length = 0; p = p.replace(/(\d+)\s*도|한\s*바퀴|반\s*바퀴|빙글\S*|돌\S*|회전\S*|턴\S*/g, ' ');
    items.push({ at: 0, lines: [], desc: '', handled: true });
  }
  const diag = { '왼앞': 'LeftForward', '오른앞': 'RightForward', '왼뒤': 'LeftBackward', '오른뒤': 'RightBackward' };
  for (const m of scan(/(왼|오른)쪽?\s*(앞|뒤)(?:쪽)?\s*(?:대각선)?\s*(?:으로|방향으로|방향)?/)) { mv(m.index, diag[m[1] + m[2]], `${m[1]}쪽 ${m[2]} 대각선`); blank(m); }
  for (const m of scan(/(왼|오른)쪽?\s*(옆)?\s*(?:쪽|방향)?\s*(으로|로)?/)) {
    if (!m[2] && !m[3]) continue;                                   // "왼쪽" 만 있고 옆·으로가 없으면 방향으로 보지 않음
    mv(m.index, m[1] === '왼' ? 'Left' : 'Right', `${m[1]}쪽 옆`); blank(m);
  }
  if (/대각선/.test(p)) { st.warn('대각선은 "왼쪽 앞 대각선으로" 처럼 어느 쪽인지 알려 주세요.'); items.push({ at: 0, lines: [], desc: '', handled: true }); p = p.replace(/대각선\S*/, ' '); }
  for (const m of scan(/뒤로|후진|뒷걸음|뒤쪽으로/)) { mv(m.index, 'Backward', '뒤로'); blank(m); }
  for (const m of scan(/앞으로|앞쪽으로|전진|직진|똑바로/)) { mv(m.index, 'Forward', '앞으로'); blank(m); }
  if (turnVerb && !degree && !moves.some(x => x.kind === 'turn')) { st.warn('돌 때는 "시계 방향" 또는 "반시계 방향"(또는 왼쪽·오른쪽으로 돌기)을 알려 주세요.'); items.push({ at: 0, lines: [], desc: '', handled: true }); p = p.replace(/돌\S*|회전\S*|턴\S*/, ' '); }

  // ⑤ 멈춤
  const stops = scan(/멈춰|멈추|멈출|정지|그만|서\s*줘|서라/);
  // ⑥ 속도·시간(이동·멈춤에 붙는 숫자)
  let speedWant = null, ms = null, timeText = null;
  if (moves.length || stops.length) {
    const sm = p.match(/속도\s*(?:를|은|는|가)?\s*(\d+)/);
    if (sm) { speedWant = Number(sm[1]); p = p.replace(sm[0], ' '); }
    else if (moves.length) { const s2 = p.match(/(\d+)\s*(?:으로|로)(?!\S*초)/); if (s2) { speedWant = Number(s2[1]); p = p.replace(s2[0], ' '); } }
    const tm = p.match(/(\d+(?:\.\d+)?)\s*초/);
    if (tm) { ms = Math.round(Number(tm[1]) * 1000); timeText = `${tm[1]}초`; p = p.replace(tm[0], ' '); }
    p = p.replace(/동안/, ' ');
  } else {
    const sm = p.match(/속도\s*(?:를|은|는|가)?\s*(\d+)/);
    if (sm && !items.length) { st.speed = Number(sm[1]); p = p.replace(sm[0], ' '); st.warn(`이후 이동은 속도 ${sm[1]}로 해요.`); items.push({ at: 0, lines: [], desc: '', handled: true }); }
  }
  if (moves.length && /빠르게|빨리|천천히|느리게|살금살금/.test(p) && speedWant === null) st.warn('"빠르게·천천히"는 숫자로 알려 주세요(예: 속도 150으로). 숫자가 없어서 기본 속도를 썼어요.');
  const cont = /계속|쭉|멈추라고|멈출\s*때까지/.test(raw);

  // 속도 결정: 문장 숫자 > 앞에서 말한 속도 > 정책 defaultSpeed(없으면 코드 안 만듦)
  const speedFor = () => {
    let v = speedWant ?? st.speed ?? null;
    if (v === null) {
      if (P.defaultSpeed === null) { st.warn('속도를 숫자로 알려 주세요(예: 속도 100으로). 선생님이 기본 속도를 정해 두지 않았어요.'); return null; }
      v = P.defaultSpeed; st.note(`속도 말이 없어서 기본 속도(선생님이 정한 값 ${v})를 썼어요.`);
    } else if (speedWant !== null) st.speed = speedWant;
    const [lo, hi] = V.speedRange;
    if (v > hi) { st.warn(`속도 ${v}은(는) 확장 범위(${lo}~${hi})를 넘어서 ${hi}로 줄였어요.`); v = hi; }
    if (v < lo) { st.warn(`속도 ${v}은(는) 확장 범위(${lo}~${hi}) 밖이라 ${lo}로 했어요.`); v = lo; }
    if (P.maxSpeed !== null && v > P.maxSpeed) { st.warn(`선생님이 정한 속도 한도 ${P.maxSpeed}보다 커서 ${P.maxSpeed}로 줄였어요.`); v = P.maxSpeed; }
    return v;
  };
  // 움직임 시간: 문장 숫자 > (계속이거나 거리·라인·색 규칙 안이면 계속) > 정책 defaultSeconds
  const stopLine = 'aiPonybot.stopAllMotors()';
  for (const mo of moves) {
    const v = speedFor(); if (v === null) { items.push({ at: mo.at, lines: [], desc: '', handled: true }); continue; }
    const f = mo.kind === 'move' ? runM : runN;
    const run = `aiPonybot.${f.name}(aiPonybot.${mo.e}.${mo.member}, ${v})`;
    const block = blockText(f, { direction: glyph(mo.e, mo.member), speed: v });
    if (mo.kind === 'turn') {
      st.warn('돌기: 코드 이름은 화살표와 반대예요(시계 방향 ↷ = CounterClockwise, 반시계 ↶ = Clockwise). 방향은 사진(기판 글자)으로 정했어요 — 실물에서 3초 시험해 확인하세요.');
    }
    let msUse = ms, continuous = false;
    if (msUse === null) {
      if (cont || st.mode === 'poll') continuous = true;
      else if (P.defaultSeconds === null) { st.warn('몇 초 동안 움직일지 알려 주세요(예: 2초 동안). 선생님이 기본 시간을 정해 두지 않았어요.'); items.push({ at: mo.at, lines: [], desc: '', handled: true }); continue; }
      else { msUse = Math.round(P.defaultSeconds * 1000); st.note(`시간 말이 없어서 기본 시간(선생님이 정한 값 ${P.defaultSeconds}초)으로 했어요.`); }
    }
    if (continuous) add(mo.at, run, `${mo.label} 계속 이동: 「${block}」`, { cont: true });
    else add(mo.at, [run, `basic.pause(${msUse})`, stopLine], `${mo.label} ${msUse / 1000}초 이동 뒤 멈춤: 「${block}」 → 「${blockText(V.fn('stopAllMotors'))}」`, { move: true });
  }
  if (stops.length && !moves.length) {
    for (const m of stops) {
      if (ms !== null && stops[0] === m) add(m.index, [stopLine, `basic.pause(${ms})`], `멈추고 ${timeText} 기다리기`);
      else add(m.index, stopLine, `멈춤: 「${blockText(V.fn('stopAllMotors'))}」`);
      blank(m);
    }
  } else if (moves.length && stops.length) { /* "앞으로 가다 멈춰" 처럼 같은 구절에 있으면 이동 뒤 멈춤으로 이미 포함 */ }

  items.sort((a, b) => a.at - b.at);
  const lines = items.flatMap(i => i.lines);
  const understood = items.length > 0;
  const rest = p.replace(/[-]/g, '').replace(FILLER, '').replace(/\d+\s*(?:번|회)/g, '').replace(/[\s을를이가은는도요에서로의한]/g, '');
  return { items, lines, desc: items.map(i => i.desc).filter(Boolean), understood, leftover: rest, cont: items.some(i => i.cont), timed: items.some(i => i.move) };
}

// ───────────────────────── 트리거 ─────────────────────────
function makeTriggers(V) {
  const PRESS = '(?:을|를|이|가)?\\s*(?:누르면|누를\\s*때|눌렀을\\s*때|눌리면)';
  const COLOR_RE = V.colorWordsRe;
  return [
    { kind: 'start', re: /(?:전원을\s*)?(?:시작하면|시작할\s*때|켜면|켜지면|켰을\s*때)/ },
    { kind: 'btn', arg: 'AB', re: new RegExp(`(?:A\\s*\\+\\s*B|AB|에이\\s*비|에이비|A\\s*(?:와|랑|하고)\\s*B|두\\s*버튼)\\s*(?:버튼)?\\s*${PRESS}`, 'i') },
    { kind: 'btn', arg: 'A', re: new RegExp(`(?<![A-Za-z가-힣])(?:A|에이)\\s*(?:버튼|단추)?\\s*${PRESS}`, 'i') },
    { kind: 'btn', arg: 'B', re: new RegExp(`(?<![A-Za-z가-힣])(?:B|비)\\s*(?:버튼|단추)?\\s*${PRESS}`, 'i') },
    { kind: 'radio', re: /(?:라디오|신호|숫자)\s*(?:로)?\s*(\d+)\s*(?:을|를|이|가)?\s*(?:받으면|오면|들어오면|받았을\s*때)/ },
    { kind: 'near', re: /(?:(?:거리가?|앞(?:의|에)?)\s*)?(?:(\d+(?:\.\d+)?)\s*(?:cm|센티미터|센티)\s*(?:보다|이내|안쪽|안으로|안에)?\s*(?:더\s*)?)?(?:가까우면|가까워지면|가까이\s*오면|작으면|장애물이?\s*(?:있으면|보이면|나타나면))/i },
    { kind: 'line', re: /(?:(왼|오른)쪽?\s*)?(?:검은\s*)?(?:라인|선)(?:\s*센서)?(?:을|를|이|가|에서|에)?\s*(?:만나면|만났을\s*때|보이면|감지하면|감지되면|밟으면|발견하면|닿으면)/ },
    { kind: 'color', re: new RegExp(`(${COLOR_RE})\\s*색?(?:을|이|가)?\\s*(?:보이면|감지되면|감지하면|나오면|인식하면|만나면|있으면)`) },
    { kind: 'else', re: /(?:멀면|아니면|없으면|그렇지\s*않으면|멀어지면)/ },
    { kind: 'forever', re: /(?:계속해서|계속|무한\s*반복|무한히)/ },
  ];
}

// ───────────────────────── 코드 검사 ─────────────────────────
// 두 모드(규칙·AI) 공통 출력 검사. 서버(AI 모드)에서도 같은 함수를 돌린다.
export function checkPonyCode(code, policy = {}, ctx = {}) {
  const C = { ...CFG, ...ctx };
  const P = normalizePolicy(policy);
  if (!C.blocks) return { ok: false, errors: [{ code: 'E0', msg: '블록 표가 설정되지 않았어요(configurePony)' }], warnings: [], skipped: true };
  if (!C.validateCode || !C.Babel) return { ok: true, errors: [], warnings: [], skipped: true };
  const vp = { forbid: P.forbid };
  if (P.maxSpeed !== null) vp.max = { [`${NS}.runMecanum.speed`]: P.maxSpeed, [`${NS}.runNormal.speed`]: P.maxSpeed, [`${NS}.runMotor.speed`]: P.maxSpeed };
  const r = C.validateCode(code, C.blocks, { Babel: C.Babel, policy: vp });
  // 정책 위반(W3 한도·W4 금지)은 경고가 아니라 거절로 다룬다(교사가 정한 값)
  const policyBad = r.warnings.filter(w => w.code === 'W3' || w.code === 'W4');
  return { ok: r.ok && policyBad.length === 0, errors: [...r.errors, ...policyBad], warnings: r.warnings.filter(w => !policyBad.includes(w)), skipped: false };
}

export function normalizePolicy(p = {}) {
  const num = (v) => (typeof v === 'number' && isFinite(v) ? v : null);
  return {
    defaultSpeed: num(p.defaultSpeed), maxSpeed: num(p.maxSpeed), autoStopMs: num(p.autoStopMs),
    forbid: Array.isArray(p.forbid) ? p.forbid.filter(x => typeof x === 'string') : [],
    defaultSeconds: num(p.defaultSeconds), nearCm: num(p.nearCm), radioTimeoutMs: num(p.radioTimeoutMs),
    colorSensorVersion: typeof p.colorSensorVersion === 'string' ? p.colorSensorVersion : null,
    maxChars: num(p.maxChars) ?? 300,
  };
}

const EXAMPLE_HINTS = [
  { id: '00_check-ponybot', title: '0. 연결·센서 점검', re: /점검|확인|테스트|시험|바퀴.*(돌|도는)/, why: '바퀴·거리·라인 센서가 되는지 먼저 확인해요' },
  { id: '01_hello-ponybot', title: '1. 안녕, 포니봇!(순차 구조)', re: /인사|옆으로|순서|차례|메카넘/, why: 'A 버튼으로 장면을 차례로 보여 주는 예제예요' },
  { id: '02_distance-rule', title: '2. 규칙으로 반응하기(거리센서)', re: /거리|가까우|장애물|벽|부딪/, why: '가까우면 멈추고 멀면 천천히 가는 규칙 예제예요' },
  { id: '03_ai-traffic-ponybot', title: '3. AI 신호등 포니봇', re: /카드|카메라|인공\s*지능|(?<![A-Za-z])AI(?![A-Za-z])|라디오|신호등|사물|얼굴|손\s*모양|포즈/i, why: 'AI 브리지가 라디오로 보낸 숫자를 받아 움직여요' },
  { id: '04_ai-team-template', title: '4. 우리 모둠 AI 포니봇(틀)', re: /모둠|프로젝트|배달|분리수거|안내/, why: '모둠이 행동을 채워 넣는 틀이에요' },
];
export function suggestExamples(text) { return EXAMPLE_HINTS.filter(h => h.re.test(text)).slice(0, 3).map(({ id, title, why }) => ({ id, title, why })); }

const PERSONAL = /01[016789][-\s]?\d{3,4}[-\s]?\d{4}|[\w.+-]+@[\w-]+\.[\w.]+|(?:내\s*)?이름\s*(?:은|이|는)|[가-힣]{2,}\s*(?:초등학교|중학교|고등학교|학교)|주소\s*(?:는|가)/;

// ───────────────────────── 도우미 본체 ─────────────────────────
export function ponyAssistant(text, policy = {}, ctx = {}) {
  const C = { ...CFG, ...ctx };
  const P = normalizePolicy(policy);
  const warnings = [], notes = [];
  const warn = (m) => { if (!warnings.includes(m)) warnings.push(m); };
  const note = (m) => { if (!notes.includes(m)) notes.push(m); };
  const fail = (explanation, extra = {}) => ({ code: '', explanation, warnings, suggestions: extra.suggestions || [] });
  const src = String(text || '').trim();

  // 1) 입력 검사
  if (!src) return fail('하고 싶은 동작을 적어 주세요. 예: "A 버튼을 누르면 앞으로 2초 동안 가"');
  if (src.length > P.maxChars) return fail(`말이 너무 길어요(${P.maxChars}자까지). 한 번에 한두 가지씩 나눠서 말해 주세요.`);
  if (PERSONAL.test(src)) warn('이름·학교·전화번호·주소 같은 개인정보는 쓰지 마세요. 이 도우미(규칙 모드)는 글을 이 컴퓨터 밖으로 보내지 않지만, 코드를 공유하면 보일 수 있어요.');
  if (!C.blocks) return fail('블록 표(kits/ponybot/blocks.json)가 아직 안 불러와졌어요. 잠시 뒤 다시 해 보세요.');
  let V; try { V = vocabFor(C.blocks); } catch (e) { return fail('블록 표가 이 도우미와 맞지 않아요: ' + e.message); }
  if (/카드|카메라|인공\s*지능|(?<![A-Za-z])AI(?![A-Za-z])|에이\s*아이/i.test(src)) {
    const msg = "카드·카메라로 알아보는 일은 AI 브리지가 필요해요 → 예제 '3. AI 신호등 포니봇'에서 시작하세요.";
    warn(msg);
    return fail(msg, { suggestions: suggestExamples(src) });
  }

  const { t: prot, q: quotes } = protectQuotes(src);
  // 2) 트리거 찾기
  const TR = makeTriggers(V);
  const marks = [];
  for (const t of TR) {
    const g = new RegExp(t.re.source, t.re.flags.includes('g') ? t.re.flags : t.re.flags + 'g');
    let m; while ((m = g.exec(prot))) {
      if (!m[0]) { g.lastIndex++; continue; }
      let arg = t.arg ?? null;
      if (t.kind === 'radio') arg = Number(m[1]);
      if (t.kind === 'near') arg = m[1] !== undefined ? Number(m[1]) : null;
      if (t.kind === 'line') arg = m[1] ? (m[1] === '왼' ? 'Left' : 'Right') : null;
      if (t.kind === 'color') arg = V.colors.find(c => c.re.test(m[1])).id;
      marks.push({ at: m.index, end: m.index + m[0].length, kind: t.kind, arg });
    }
  }
  marks.sort((a, b) => a.at - b.at || (b.end - b.at) - (a.end - a.at));
  const clean = [];
  for (const m of marks) if (!clean.some(c => m.at < c.end && m.end > c.at)) clean.push(m);
  // 누르면 계열 말이 있는데 어느 버튼인지 못 잡으면 거절(추측 금지)
  const pressAt = [...prot.matchAll(/(누르면|눌리면|누를\s*때|눌렀을\s*때)/g)].map(m => m.index);
  if (pressAt.some(i => !clean.some(c => i >= c.at && i < c.end))) return fail('어느 버튼인지 알려 주세요: "A 버튼을 누르면", "B 버튼을 누르면", "A+B 버튼을 누르면"', { suggestions: suggestExamples(src) });
  // '계속'은 따로 떼지 않고 앞 구간 글에 남겨 둔다(그 안의 계속 이동/반복으로 읽음)
  const trig = clean.filter(m => m.kind !== 'forever');
  const segs = [{ kind: 'start', text: prot.slice(0, trig.length ? trig[0].at : prot.length) }];
  trig.forEach((m, i) => segs.push({ kind: m.kind, arg: m.arg, text: prot.slice(m.end, i + 1 < trig.length ? trig[i + 1].at : prot.length) }));
  // 같은 조건은 합치기(버튼 A 두 번 등), '아니면'은 바로 앞 조건에 붙이기
  const groups = [];
  for (const sg of segs) {
    if (sg.kind === 'else') {
      const prev = groups[groups.length - 1];
      if (prev && ['near', 'line', 'color'].includes(prev.kind)) prev.elseText = (prev.elseText ? prev.elseText + ', ' : '') + sg.text;
      else warn('"아니면·멀면"은 "가까우면·라인을 만나면·색이 보이면" 바로 다음에 써야 해요. 그 부분은 무시했어요.');
      continue;
    }
    const same = sg.kind === 'start' ? groups.find(g => g.kind === 'start') : groups.find(g => g.kind === sg.kind && g.arg === sg.arg);
    if (same) same.text += ', ' + sg.text; else groups.push({ ...sg });
  }

  // 3) 구간별 동작 만들기
  const unknown = [];
  const build = (textIn, mode, label) => {
    const st = { V, P, quotes, mode, speed: null, warn, note };
    const out = [], ds = []; let hasCont = false, timed = false;
    const rep = textIn.match(/(\d+)\s*(?:번|회)\s*(?:반복|씩|해)/);
    for (const ph of splitPhrases(textIn)) {
      const a = actionsOf(ph, st);
      if (a.understood) { out.push(...a.lines); ds.push(...a.desc); hasCont = hasCont || a.cont; timed = timed || a.timed; }
      else if (a.leftover.length > 1) unknown.push(ph.replace(/[-]/g, '"…"'));
    }
    const forever = /계속|무한|쭉/.test(textIn);
    for (let i = out.length - 1; i > 0; i--) if (out[i] === out[i - 1] && out[i] === 'aiPonybot.stopAllMotors()') out.splice(i, 1);   // 멈춤이 겹치면 하나만
    let lines = out, desc = ds.slice();
    if (rep && out.length) { lines = [`for (let 번 = 0; 번 < ${rep[1]}; 번++) {`, ...out.map(l => '    ' + l), '}']; desc = [`${rep[1]}번 반복: ` + ds.join(' → ')]; }
    return { lines, desc, hold: hasCont, loop: forever && !hasCont && out.length > 0 && mode === 'once', label };
  };

  const decl = [], init = ['aiPonybot.stopAllMotors()'], regs = [], tail = [], expl = [];
  const indent = (ls, n = 1) => ls.map(l => '    '.repeat(n) + l);
  const forever = (ls, ms) => ['basic.forever(function () {', ...indent(ls), `    basic.pause(${ms})`, '})'];
  const hasLine = (ls, re) => ls.some(l => re.test(l));
  let usesB = false, safetyNeeded = false, usesColor = false, usesRadio = false, radioCont = false;
  const radioCases = [];
  const polls = [];                                         // 거리·라인·색

  for (const g of groups) {
    const poll = ['near', 'line', 'color'].includes(g.kind);
    const b = build(g.text, poll ? 'poll' : 'once', g.kind);
    const e = g.elseText ? build(g.elseText, 'poll', 'else') : null;
    if (!b.lines.length && !(e && e.lines.length)) { if (g.kind !== 'start') warn(`"${labelOf(g, V, P)}" 다음에 할 일을 못 알아들었어요.`); continue; }
    const name = labelOf(g, V, P);
    expl.push(`· ${name}: ${b.desc.join(' → ') || '(없음)'}` + (e ? ` / 아니면: ${e.desc.join(' → ')}` : ''));
    if (g.kind === 'start') {
      if (b.hold) { tail.push(...b.lines); safetyNeeded = true; warn('켜자마자 계속 움직이는 코드예요. 책상 끝(낭떠러지)을 못 보니 바닥이나 울타리 안에서 시험하고, B 버튼으로 멈춰요.'); }
      else if (b.loop) tail.push(...forever(b.lines, 50)), safetyNeeded = true;
      else tail.push(...b.lines);
    } else if (g.kind === 'btn') {
      const btn = g.arg === 'AB' ? 'Button.AB' : `Button.${g.arg}`;
      if (g.arg === 'B' || g.arg === 'AB') usesB = true;
      if (b.hold || b.loop) {
        const on = `${g.arg}동작중`, cur = `${g.arg}지금`;
        decl.push(`let ${on} = false`, `let ${cur} = false`);
        regs.push(`input.onButtonPressed(${btn}, function () {`, `    ${on} = !(${on})`, '})');
        const body = b.hold
          ? [`if (${on} != ${cur}) {`, `    ${cur} = ${on}`, `    if (${cur}) {`, ...indent(b.lines, 2), '    } else {', '        aiPonybot.stopAllMotors()', '    }', '}']
          : [`if (${on}) {`, ...indent(b.lines), `    ${cur} = true`, `} else if (${cur}) {`, `    ${cur} = false`, '    aiPonybot.stopAllMotors()', '}'];
        if (P.autoStopMs !== null) { decl.push(`let ${g.arg}시작시간 = 0`); body.unshift(`if (${on} && !(${cur})) {`, `    ${g.arg}시작시간 = input.runningTime()`, '}', `if (${on} && input.runningTime() - ${g.arg}시작시간 > ${P.autoStopMs}) {`, `    ${on} = false`, '}'); }
        tail.push(...forever(body, 50));
        note(`${g.arg} 버튼은 누를 때마다 켜고 끄는 스위치로 만들었어요.`);
      } else regs.push(`input.onButtonPressed(${btn}, function () {`, ...indent(b.lines), '})');
    } else if (g.kind === 'radio') {
      usesRadio = true; if (b.hold) radioCont = true;
      if (b.loop) warn('라디오 안에서 "계속 반복"은 지원하지 않아 한 번만 하도록 했어요.');
      radioCases.push({ n: g.arg, lines: b.lines });
    } else {
      polls.push({ g, b, e });
    }
  }

  // 라디오 수신 + 한 곳에서 처리(예제 03·04 패턴)
  if (usesRadio) {
    decl.push('let 모둠번호 = 1', 'let 받은신호 = -1', 'let 처리한신호 = -9', 'let 마지막수신 = 0');
    init.push('radio.setGroup(모둠번호)');
    warn('라디오 모둠번호를 1로 했어요. 보내는 쪽(AI 브리지 수신기)과 같은 번호인지 확인하세요.');
    regs.push('radio.onReceivedNumber(function (받은수) {', '    받은신호 = 받은수', '    마지막수신 = input.runningTime()', '})');
    const body = ['let 할일 = 받은신호'];
    if (radioCont && P.radioTimeoutMs !== null) body.push(`if (input.runningTime() - 마지막수신 > ${P.radioTimeoutMs}) {`, '    할일 = -2', '}');
    else if (radioCont) warn('계속 움직이는 라디오 동작인데 신호가 끊겨도 멈추지 않아요(선생님이 끊김 시간을 정하지 않았어요).');
    const inner = radioCases.flatMap((c, i) => [`${i ? '} else if' : 'if'} (할일 == ${c.n}) {`, ...indent(c.lines)]);
    body.push('if (할일 != 처리한신호) {', '    처리한신호 = 할일', '    aiPonybot.stopAllMotors()', ...indent(inner), '    }', '}');
    tail.push(...forever(body, 50));
    safetyNeeded = safetyNeeded || radioCont;
    note('라디오는 받은 숫자만 기록하고, 움직임은 아래 반복 한 곳에서 처리해요. 새 숫자가 오면 먼저 멈춘 뒤 시작해요.');
  }

  // 거리·라인·색 반복(각각 따로 forever)
  for (const { g, b, e } of polls) {
    let cond, head = [];
    if (g.kind === 'near') {
      let cm = g.arg;
      if (cm === null) {
        if (P.nearCm === null) { warn('몇 cm보다 가까울 때인지 숫자로 알려 주세요(예: 20cm보다 가까우면).'); continue; }
        cm = P.nearCm; note(`기준 거리를 말하지 않아 ${cm}cm(선생님이 정한 값)로 했어요.`);
      }
      head = ['let 거리 = aiPonybot.ping(aiPonybot.PingUnit.Centimeters)'];
      const unread = `거리 == 0 || 거리 >= ${V.pingMax}`;
      const lines = [...head, `if (${unread}) {`, '    aiPonybot.stopAllMotors()', `} else if (거리 < ${cm}) {`, ...indent(b.lines.length ? b.lines : ['aiPonybot.stopAllMotors()'])];
      if (e && e.lines.length) lines.push('} else {', ...indent(e.lines));
      lines.push('}');
      tail.push(...forever(lines, 100));
      note(`거리센서는 반사가 안 오면 ${V.pingMax}(또는 0)을 돌려줘요 → 못 읽으면 안전하게 멈추게 했어요(예제 02와 같은 규칙).`);
      continue;
    }
    if (g.kind === 'line') {
      const mk = (ch) => `aiPonybot.checkSingleLineSensor(aiPonybot.LineSensorChannel.${ch}, aiPonybot.LineState.On)`;
      cond = g.arg ? mk(g.arg) : `${mk('Left')} || ${mk('Right')}`;
      warn('라인 센서 "켜짐(On)"이 검은 선인지는 실물에서 확인하세요(블록 표만으로는 알 수 없어요).');
    } else {
      cond = `aiPonybot.isColorAdvanced(aiPonybot.DetectedColor.${g.arg}, ${V.thresholdDefault})`;
      usesColor = true;
    }
    const lines = [`if (${cond}) {`, ...indent(b.lines.length ? b.lines : ['aiPonybot.stopAllMotors()'])];
    if (e && e.lines.length) lines.push('} else {', ...indent(e.lines));
    lines.push('}');
    tail.push(...forever(lines, 100));
  }
  if (usesColor) {
    const ver = V.versions.includes(P.colorSensorVersion) ? P.colorSensorVersion : null;
    if (ver) { init.push(`aiPonybot.initColorSensor(aiPonybot.SensorVersion.${ver})`); warn(`컬러센서 모듈을 ${ver}로 가정했어요(V1 검은색·V2 보라색). 실물 모듈과 같은지 확인하세요.`); }
    else warn('컬러센서 버전(V1/V2)을 선생님이 정하지 않아 초기화 줄을 넣지 않았어요. 컬러센서 초기화 블록을 직접 추가하세요.');
  }
  // 계속 움직이는 동작의 멈춤 버튼(안전): B를 쓰고 있지 않을 때만
  if (safetyNeeded && !usesB) regs.push('input.onButtonPressed(Button.B, function () {', '    aiPonybot.stopAllMotors()', '})'), note('계속 움직이는 동작이 있어서 B 버튼을 "멈춤"으로 넣었어요.');
  else if (safetyNeeded && usesB) warn('B 버튼을 이미 다른 일에 써서 별도 "멈춤 버튼"을 넣지 않았어요.');
  // 시작 후 자동 멈춤(선생님이 정했을 때만): 켜자마자 계속 움직이는 경우
  if (P.autoStopMs !== null && safetyNeeded && !groups.some(g => g.kind === 'btn' && /계속/.test(g.text))) {
    decl.push('let 시작시간 = input.runningTime()');
    tail.push(...forever([`if (input.runningTime() - 시작시간 > ${P.autoStopMs}) {`, '    aiPonybot.stopAllMotors()', '}'], 100));
    note(`선생님이 정한 시간(${P.autoStopMs}ms)이 지나면 자동으로 멈춰요.`);
  }

  const bodyLines = [...decl, ...init, ...regs, ...tail];
  if (!tail.length && !regs.length) {
    unknown.forEach(u => warn(`이 부분은 알아듣지 못했어요: "${u}"`));
    return fail(`만들 수 있는 동작이 없었어요. 이런 말을 알아들어요 — ${CAN_DO}`, { suggestions: suggestExamples(src) });
  }
  const code = ['// 포니봇 도우미가 만든 코드: ' + SKIP_COMMENT(src), ...bodyLines].join('\n').replace(/\n{3,}/g, '\n\n');
  unknown.forEach(u => warn(`이 부분은 알아듣지 못했어요(코드에 넣지 않았어요): "${u}"`));

  // 4) 출력 검사: 오류면 코드를 주지 않는다
  const chk = checkPonyCode(code, policy, C);
  if (chk.skipped && !chk.ok) return fail('코드 검사를 못 해서 코드를 내보내지 않았어요: ' + chk.errors.map(x => x.msg).join(' / '));
  if (chk.skipped) warn('코드 검사기(Babel)를 못 불러와서 블록 표 검사를 건너뛰었어요.');
  if (!chk.ok) {
    return fail('만든 코드가 블록 표 검사를 통과하지 못해서 코드를 내보내지 않았어요: ' + chk.errors.map(x => x.msg).join(' / '), { suggestions: suggestExamples(src) });
  }
  chk.warnings.forEach(w => warn(w.msg));

  const head = expl.length ? expl.join('\n') : '만들 수 있는 동작을 정리했어요.';
  const explanation = head + (notes.length ? '\n' + notes.map(n => '※ ' + n).join('\n') : '');
  return { code, explanation, warnings, suggestions: suggestExamples(src) };
}

export const CAN_DO = '앞·뒤·왼쪽 옆·오른쪽 옆·대각선 이동, 시계·반시계 방향 돌기, 멈춤, N초 동안, 속도 N, OLED에 글자·숫자, 마이크로비트 LED 아이콘 / 언제: 시작하면, A·B 버튼을 누르면, 라디오 N을 받으면, 가까우면(N cm), 라인을 만나면, 색이 보이면, 계속';

function labelOf(g, V, P) {
  switch (g.kind) {
    case 'start': return '시작하면';
    case 'btn': return `${g.arg === 'AB' ? 'A+B' : g.arg} 버튼을 누르면`;
    case 'radio': return `라디오 ${g.arg}을(를) 받으면`;
    case 'near': return `거리가 ${g.arg ?? P.nearCm ?? '?'}cm보다 가까우면`;
    case 'line': return `${g.arg ? (g.arg === 'Left' ? '왼쪽 ' : '오른쪽 ') : ''}라인을 만나면`;
    case 'color': return `${V.colors.find(c => c.id === g.arg).label}이 보이면`;
    default: return g.kind;
  }
}
