// 로보독 도우미 — 규칙 기반(키 없이 늘 동작) + AI(서버에 키가 있을 때) 연결
// 규칙 기반: 한국어 문장을 "언제(버튼·라디오·거리·시작)" 와 "무엇을(동작·소리·불빛·표정)" 으로 나눠 MakeCode 코드를 조립

const SPEED = { default: 25, fast: 30, slow: 15, max: 30 };   // 책상 위 안전: 30 이하
// 숫자 뒤 조사: 30(삼십)으로 / 25(이십오)로, 80(팔십)은 / 25는 — 마지막 숫자 읽기의 받침으로 결정
const ro = (n) => (/[036]$/.test(String(n)) ? `${n}으로` : `${n}로`);
const eun = (n) => (/[013678]$/.test(String(n)) ? `${n}은` : `${n}는`);
const num = (s, re, def) => { const m = s.match(re); return m ? Number(m[1]) : def; };
const speedOf = (s) => {
  const m = s.match(/속도\s*(\d+)/); if (m) return Math.min(100, Number(m[1]));
  if (/빠르게|빨리|힘차게|달려/.test(s)) return SPEED.fast;
  if (/천천히|느리게|살금살금|조심/.test(s)) return SPEED.slow;
  return SPEED.default;
};
const secOf = (s, def) => { const v = num(s, /(\d+(?:\.\d+)?)\s*초/, def); return Math.round(v * 1000); };

const COLORS = [
  [/빨간|빨강|빨갛|붉은/, [255, 0, 0], '빨간'], [/주황/, [255, 120, 0], '주황'], [/노란|노랑|노랗/, [255, 200, 0], '노란'],
  [/초록|녹색|초록색|푸른\s*초/, [0, 255, 0], '초록'], [/파란|파랑|파랗/, [0, 0, 255], '파란'], [/하늘/, [0, 180, 255], '하늘색'],
  [/보라/, [150, 0, 255], '보라'], [/분홍|핑크/, [255, 80, 160], '분홍'], [/흰|하얀|하양/, [255, 255, 255], '흰'],
];
const FACES = [
  [/하트|사랑/, 'ILoveYou', '[ILOVEYOU] (하트 눈 — 모양 추정)'], [/웃|행복|기쁜|기뻐|신나|즐거/, 'Thanks', '[감사] (웃는 눈 — 모양 추정)'], [/눈\s*감|졸려|잠들|자는/, 'EyesClosed', '[눈감기]'],
  [/화난\s*(눈|표정|얼굴)|화나|째려|무서운\s*(눈|표정)|노려/, 'SharpEyes', '[찢눈] (화난 눈 — 모양 추정)'], [/초롱|반짝/, 'SparklingEyes', '[초롱초롱]'],
  [/큰\s*눈|왕눈/, 'BigEyes', '[왕눈이]'], [/깜박|깜빡|윙크/, 'Blink', '[깜박]'], [/슬픈\s*(눈|표정|얼굴)|슬퍼/, 'EyesClosed', '[눈감기] (슬픈 표정 대신)'], [/뱀/, 'SnakeEyes', '[뱀눈]'], [/두리번|굴려|굴리/, 'RollingEyes', '[좌우굴리기]'],
];
const SOUNDS = [
  [/짖|멍멍|왈왈/, 'Bark', '[멍멍]'], [/으르렁/, 'Growl', '[으르렁]'], [/낑낑|찡찡|슬픈\s*소리/, 'Whine', '[찡찡]'], [/헥헥|거친\s*숨/, 'HeavyBreath', '[거친숨]'],
  [/화난\s*소리|화내/, 'Angry', '[화난]'], [/레이저/, 'Laser', '[레이저]'], [/띠리리/, 'DingDing', '[띠리리]'], [/외계/, 'AlienSignal', '[외계신호]'],
];
const SAYS = [[/안녕/, 'Hello', '[안녕]'], [/기다려/, 'Wait', '[기다려]'], [/비켜/, 'MoveAside', '[비켜]'], [/출발/, 'Start', '[출발]']];

// 한 덩어리(구절) → [코드 줄들], 설명. 한 구절 안에 여러 동작이 있으면 말한 순서대로
function actionsOf(phrase) {
  const p = phrase.trim(), items = [];
  if (!p) return { lines: [], desc: [], understood: true };
  const add = (l, d, re) => { const at = re ? p.search(re) : 999; items.push({ at: at < 0 ? 999 : at, n: items.length, lines: [].concat(l), d }); };
  const sec = (def) => secOf(p, def);
  const walk = (dir, label, re) => { const want = speedOf(p), v = Math.min(SPEED.max, want), ms = sec(1); add([`robodog.move(deflib.MoveDirection.${dir}, ${v})`, `basic.pause(${ms})`, 'robodog.stop()'], `속도 ${ro(v)} ${ms / 1000}초 ${label} 걷기` + (want > v ? ` (속도 ${eun(want)} 책상 위에서 위험해서 ${ro(v)} 줄였어요)` : ''), re); };

  // 불빛(몸통 LED)
  const LED = /불|LED|빛|색/i;
  if (LED.test(p) && !/눈|표정/.test(p)) {
    if (/꺼|끄|끔/.test(p)) add('robodog.bodyLed(0, 0, 0)', '몸통 불 끄기', LED);
    else if (/무지개|여러\s*색|알록달록/.test(p)) add(COLORS.slice(0, 7).flatMap(([, c]) => [`robodog.bodyLed(${c.join(', ')})`, 'basic.pause(300)']), '무지개색으로 바꾸기', /무지개|여러|알록/);
    else for (const [re, c, label] of COLORS) if (re.test(p)) { add(`robodog.bodyLed(${c.join(', ')})`, `몸통 불을 ${label}색으로`, re); break; }
  }
  // 표정(눈 LED)
  if (!/마이크로비트|화면/.test(p)) for (const [re, name, label] of FACES) if (re.test(p)) { add(`robodog.headLedExp(deflib.LedExpression.${name})`, `눈 표정 ${label}`, re); break; }
  // 춤(바운스)·점프
  if (/춤|댄스|바운스/.test(p)) {
    const n = num(p, /(\d+)\s*(번|회)/, 3);
    add([`for (let 번 = 0; 번 < ${n}; 번++) {`, '    robodog.legBend(deflib.LegGroup.AllLegs, 20)', '    basic.pause(400)', '    robodog.legBend(deflib.LegGroup.AllLegs, 100)', '    basic.pause(400)', '}', 'robodog.legBend(deflib.LegGroup.AllLegs, 70)'], `${n}번 몸을 낮췄다 높였다 춤추기`, /춤|댄스|바운스/);
  } else if (/점프|뛰어|깡충/.test(p)) {
    add(['robodog.legBend(deflib.LegGroup.AllLegs, 10)', 'basic.pause(500)', 'robodog.legBend(deflib.LegGroup.AllLegs, 100)', 'basic.pause(500)', 'robodog.legBend(deflib.LegGroup.AllLegs, 70)'], '점프 흉내(몸을 낮췄다 쭉 펴기 — 로보독은 실제로 뛰지는 못해요)', /점프|뛰어|깡충/);
  }
  // 이동 (앞으로·뒤로가 한 구절에 같이 있어도 순서대로)
  const BACK = /뒤로(?!\s*돌)|후진|뒷걸음/;
  const turnWord = /돌|회전|턴|방향을/.test(p);
  const side = p.match(/(오른|왼)쪽?\s*(으로|방향으로)\s*(걸|걷|가|달려)/);
  if (side && !turnWord) {
    const ccw = side[1] === '왼';
    add([`robodog.rotation(deflib.RotateDirection.${ccw ? 'Counterclockwise' : 'Clockwise'}, 90, 60)`, 'basic.pause(1550)'], `${ccw ? '왼쪽' : '오른쪽'}으로 90° 돌기(옆으로는 못 걸어서 돌고 걸어요)`, /오른|왼/);
    walk('Forward', '앞으로', /걸|걷|가|달려/);
  } else if (/앞으로|전진|직진|달려/.test(p)) walk('Forward', '앞으로', /앞으로|전진|직진|달려/);
  else if (/걸어|걷|(?:^|\s)가(?:$|\s|요|자|라)/.test(p) && !BACK.test(p) && !turnWord) walk('Forward', '앞으로', /걸어|걷|가/);
  if (BACK.test(p)) walk('Backward', '뒤로', BACK);
  // 회전
  if (/한\s*바퀴|빙글|360/.test(p)) {
    const ccw = /왼|반시계/.test(p);
    add([`robodog.rotation(deflib.RotateDirection.${ccw ? 'Counterclockwise' : 'Clockwise'}, 360, 60)`, 'basic.pause(5300)'], `${ccw ? '왼쪽' : '오른쪽'}으로 한 바퀴 돌기`, /한\s*바퀴|빙글|360/);
  } else if (turnWord && /오른|시계\s*방향|우회전/.test(p) && !/반시계/.test(p)) {
    const d = num(p, /(\d+)\s*도/, 90);
    add([`robodog.rotation(deflib.RotateDirection.Clockwise, ${d}, 60)`, `basic.pause(${Math.round(d / 72 * 1000) + 300})`], `오른쪽으로 ${d}° 돌기`, /오른|시계|우회전/);
  } else if (turnWord && /왼|반시계|좌회전/.test(p)) {
    const d = num(p, /(\d+)\s*도/, 90);
    add([`robodog.rotation(deflib.RotateDirection.Counterclockwise, ${d}, 60)`, `basic.pause(${Math.round(d / 72 * 1000) + 300})`], `왼쪽으로 ${d}° 돌기`, /왼|반시계|좌회전/);
  } else if (turnWord && /뒤로\s*돌|돌아\s*서|180/.test(p)) {
    add(['robodog.rotation(deflib.RotateDirection.Clockwise, 180, 60)', 'basic.pause(2800)'], '뒤로 돌기(180°)', /뒤로\s*돌|돌아|180/);
  }
  // 자세
  if (/앉|누워|눕|엎드/.test(p)) add(['robodog.gesture(deflib.Posture.SitDown)', 'basic.pause(1000)'], /누워|눕|엎드/.test(p) ? '앉기(눕기 대신 — 로보독은 앉기 자세가 가장 낮아요)' : '앉기', /앉|누워|눕|엎드/);
  if ((/인사/.test(p) && !/소리|라고|말/.test(p)) || /손\s*(을\s*)?흔들|발\s*(을\s*)?흔들|하이파이브|손\s*들/.test(p)) add(['robodog.gesture(deflib.Posture.SayHello)', 'basic.pause(2500)', 'robodog.gesture(deflib.Posture.Ready)'], '앞발 들어 인사하기', /인사|흔들|하이파이브|손/);
  if (/물구나무/.test(p)) add(['robodog.gesture(deflib.Posture.Handstand)', 'basic.pause(2000)', 'robodog.gesture(deflib.Posture.Ready)'], '물구나무서기', /물구나무/);
  if (/기지개|스트레칭/.test(p)) add(['robodog.gesture(deflib.Posture.Stretch)', 'basic.pause(2000)', 'robodog.gesture(deflib.Posture.Ready)'], '기지개 켜기', /기지개|스트레칭/);
  if (/일어나|일어서|일어|준비\s*자세|기본\s*자세|똑바로\s*서|^서$|^서라|^서요/.test(p)) add('robodog.gesture(deflib.Posture.Ready)', '준비 자세로 서기', /일어|준비|기본|똑바로|서/);
  if (/낮게|몸을\s*낮|숙여/.test(p)) add('robodog.legBend(deflib.LegGroup.AllLegs, 20)', '몸 낮추기', /낮|숙여/);
  if (/높게|키를\s*높|발돋움|높이\s*서/.test(p)) add('robodog.legBend(deflib.LegGroup.AllLegs, 100)', '몸 높이기', /높|발돋움/);
  if (/멈춰|멈추|멈춤|정지|그만/.test(p) && !/기다|있어/.test(p)) add('robodog.stop()', '멈추기', /멈|정지|그만/);
  // 소리
  let sound = false;
  for (const [re, name, label] of SOUNDS) if (re.test(p)) { add(`robodog.soundPlay(deflib.SoundEffect.${name}, deflib.SoundVolume.Medium)`, `소리 ${label}`, re); sound = true; break; }
  if (/소리|라고|말해|외쳐/.test(p)) for (const [re, name, label] of SAYS) if (re.test(p)) { add(`robodog.soundPlay(deflib.SoundEffect.${name}, deflib.SoundVolume.Medium)`, `소리 ${label}`, re); sound = true; break; }
  if (/도레미|노래|음계/.test(p)) { add(['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Si', 'SharpDo'].flatMap(n => [`robodog.soundPlay(deflib.SoundEffect.${n}, deflib.SoundVolume.Medium)`, 'basic.pause(300)']), '도레미파솔라시도 노래', /도레미|노래|음계/); sound = true; }
  if (!sound && /소리\s*(를\s*)?(내|나|켜)|소리$/.test(p)) add('robodog.soundPlay(deflib.SoundEffect.DingDing, deflib.SoundVolume.Medium)', '소리 [띠리리]', /소리/);
  // 마이크로비트 화면
  if (/마이크로비트|화면/.test(p)) {
    if (/하트/.test(p)) add('basic.showIcon(IconNames.Heart)', '마이크로비트에 하트', /마이크로비트|화면/);
    else if (/웃/.test(p)) add('basic.showIcon(IconNames.Happy)', '마이크로비트에 웃는 얼굴', /마이크로비트|화면/);
    else if (/숫자\s*(\d+)/.test(p)) add(`basic.showNumber(${num(p, /숫자\s*(\d+)/, 0)})`, '마이크로비트에 숫자', /마이크로비트|화면/);
    else if (/거리/.test(p)) add('basic.showNumber(robodog.getTof())', '마이크로비트에 거리센서 값', /마이크로비트|화면/);
  }
  // 기다리기
  if (/(\d+(?:\.\d+)?)\s*초\s*(동안\s*)?(기다|쉬|가만|있)/.test(p)) add(`basic.pause(${secOf(p, 1)})`, `${secOf(p, 1) / 1000}초 기다리기`, /기다|쉬|가만/);
  items.sort((x, y) => x.at - y.at || x.n - y.n);
  const lines = items.flatMap(i => i.lines), desc = items.map(i => i.d).filter(Boolean);
  return { lines, desc, understood: lines.length > 0 };
}

// 문장 → 구절들
function splitPhrases(text) {
  return text.split(/(?:하고\s|한\s*다음(?:에)?|한\s*뒤(?:에)?|그리고|그\s*다음(?:에)?|다음에|후에|뒤에|[,.!?\n]|→|->|(?<=[가-힣])(?<!라)고\s)/)
    .map(s => s && s.trim()).filter(Boolean);
}

const TRIGGERS = [
  { re: /(로보독|등|몸통|로봇)\s*(의\s*)?(버튼|단추)\s*(을|를|이|가)?\s*(누르면|누를\s*때|눌렀을\s*때|눌리면)/, kind: 'robotbtn' },
  { re: /(A\s*\+\s*B|AB|에이\s*비|에이비|A\s*(와|랑|하고)\s*B|두\s*버튼)\s*(버튼)?\s*(을|를)?\s*(같이|함께|동시에)?\s*(누르면|누를\s*때|눌렀을\s*때)/i, kind: 'btn', arg: 'AB' },
  { re: /(?<![A-Za-z가-힣])(A|에이)\s*(버튼|단추)?\s*(을|를|이|가)?\s*(누르면|누를\s*때|눌렀을\s*때|눌리면)/i, kind: 'btn', arg: 'A' },
  { re: /(?<![A-Za-z가-힣])(B|비)\s*(버튼|단추)?\s*(을|를|이|가)?\s*(누르면|누를\s*때|눌렀을\s*때|눌리면)/i, kind: 'btn', arg: 'B' },
  { re: /(라디오|신호|숫자)\s*(로)?\s*(\d)\s*(을|를|이|가)?\s*(받으면|오면|들어오면|받았을\s*때)/, kind: 'radio' },
  // "라디오 A 버튼을 누르면"(붙여 써도 됨) = 손에 든 리모컨 마이크로비트의 A 버튼 → 라디오 숫자 1, B → 2 로 받는 규칙
  { re: /(라디오|무선|리모컨|리모콘)\s*(로)?\s*(A|B|에이|비)\s*(버튼|단추)\s*(을|를|이|가)?\s*(누르면|누를\s*때|눌렀을\s*때|눌리면)/i, kind: 'radio', letter: true },
  { re: /(?:(?:장애물|벽|물건)이?\s*)?(가까우면|가까워지면|가까이\s*오면|장애물이?\s*(있으면|보이면|나타나면)|벽이?\s*(있으면|가까우면)|부딪히기\s*전에)/, kind: 'near' },
  { re: /(멀면|아니면|없으면)/, kind: 'else' },
  { re: /(계속해서|계속|무한\s*반복|무한히)\s*(반복)?\s*(해|하기|해줘)?/, kind: 'forever' },
];

export const CAN_DO = '앞으로·뒤로 걷기, 오른쪽·왼쪽 돌기, 한 바퀴, 앉기, 일어서기, 인사(손 흔들기), 물구나무, 기지개, 춤, 멈추기, 짖기·노래, 빨간·초록·파란 불, 하트·웃는·슬픈 눈 / 언제: A·B 버튼을 누르면, 라디오 3을 받으면, 장애물이 가까우면, 계속';

export function ruleAssistant(text) {
  const src = String(text || '').trim();
  const warnings = [], unknown = [];
  if (!src) return { code: '', explanation: '하고 싶은 동작을 적어 주세요. 예: "A 버튼을 누르면 인사하고 멍멍 짖어"', warnings, suggestions: [] };
  if (src.length > 300) return { code: '', explanation: '말이 너무 길어요(300자까지). 한 번에 한두 가지씩 나눠서 말해 주세요.', warnings, suggestions: [] };

  // 1) 언제(트리거) 위치 찾기 → 구간 나누기
  const marks = [];
  for (const t of TRIGGERS) {
    const g = new RegExp(t.re.source, t.re.flags.includes('g') ? t.re.flags : t.re.flags + 'g');
    let m; while ((m = g.exec(src))) marks.push({ at: m.index, end: m.index + m[0].length, kind: t.kind, arg: t.arg || (t.kind === 'radio' ? (t.letter ? (/^(A|에이)$/i.test(m[3]) ? 1 : 2) : Number(m[3])) : null) });
  }
  marks.sort((a, b) => a.at - b.at);
  const clean = [];
  for (const m of marks) if (!clean.some(c => m.at < c.end && m.end > c.at)) clean.push(m);   // 겹친 것 제거(AB가 A보다 먼저)
  // 버튼·라디오 뒤의 '계속'은 따로 떼지 않고 그 조건 안에서 계속(예: B 버튼을 누르면 계속 걸어)
  for (let i = clean.length - 1; i > 0; i--) if (clean[i].kind === 'forever') {
    const prev = clean.slice(0, i).reverse().find(c => c.kind !== 'forever');
    if (prev) { prev.always = true; clean.splice(i, 1); }
  }
  const segs = [{ kind: 'start', text: src.slice(0, clean.length ? clean[0].at : src.length) }];
  clean.forEach((m, i) => segs.push({ kind: m.kind, arg: m.arg, always: m.always, text: src.slice(m.end, i + 1 < clean.length ? clean[i + 1].at : src.length) }));
  // '앞으로 계속 걸어'처럼 '계속' 앞뒤가 한 동작이면 앞부분을 '계속' 쪽으로 합침(켜자마자 1초 걷는 코드가 따로 생기지 않게)
  if (segs[1] && segs[1].kind === 'forever' && segs[1].text.trim() && segs[0].text.trim() && !/[,.!?\n]\s*$/.test(segs[0].text)) { segs[1].text = segs[0].text + ' ' + segs[1].text; segs[0].text = ''; }

  // 2) 구간별 동작 만들기
  const build = (t) => {
    const out = [], ds = [];
    const rep = t.match(/(\d+)\s*(번|회)\s*(반복|씩)/);
    for (const ph of splitPhrases(t)) {
      const a = actionsOf(ph);
      if (a.understood) { out.push(...a.lines); ds.push(...a.desc); }
      else if (ph.replace(/\d+\s*(cm|센티|센티미터)?\s*(보다|이내|안쪽|정도)?/g, '').replace(/[\s을를이가은는도요해줘주세요하기]/g, '').length > 1) unknown.push(ph);
    }
    if (rep && out.length && !/춤|댄스|바운스/.test(t)) {
      const n = Number(rep[1]);
      return { lines: [`for (let 번 = 0; 번 < ${n}; 번++) {`, ...out.map(l => '    ' + l), '}'], desc: [`${n}번 반복: ` + ds.join(' → ')] };
    }
    return { lines: out, desc: ds };
  };
  const indent = (ls, n = 1) => ls.map(l => '    '.repeat(n) + l);
  const hasMove = (ls) => ls.some(l => l.includes('robodog.move('));
  // 걷기(이동 → 기다림 → 멈춤)를 '계속 걷기'(이동만)로: 라디오·거리 규칙처럼 상태가 바뀔 때까지 걷는 곳에서 씀
  const continuous = (ls) => { const o = []; for (let i = 0; i < ls.length; i++) { o.push(ls[i]); if (ls[i].includes('robodog.move(') && /basic\.pause/.test(ls[i + 1] || '') && /robodog\.stop/.test(ls[i + 2] || '')) i += 2; } return o; };
  const code = ['robodog.gesture(deflib.Posture.Ready)'], tail = [], expl = [];

  // 어느 버튼인지 모르는 '누르면'은 만들지 않음
  const pressAt = [...src.matchAll(/(누르면|눌리면|누를\s*때|눌렀을\s*때)/g)].map(m => m.index);
  if (pressAt.some(i => !clean.some(c => i >= c.at && i < c.end))) {
    return { code: '', explanation: '어느 버튼인지 알려 주세요: "A 버튼을 누르면", "B 버튼을 누르면", "A+B 버튼을 누르면", "로보독 버튼을 누르면"', warnings, suggestions: suggestExamples(src) };
  }

  const startPart = build(segs[0].text);
  const handlers = [], radioCases = [], foreverParts = [], robotBtn = [];
  let nearPart = null, elsePart = null;
  for (const sg of segs.slice(1)) {
    const b = build(sg.text);
    b.always = !!sg.always;
    if (sg.kind === 'btn') handlers.push({ btn: sg.arg, ...b });
    else if (sg.kind === 'robotbtn') robotBtn.push(b);
    else if (sg.kind === 'radio') radioCases.push({ n: sg.arg, ...b });
    else if (sg.kind === 'near') nearPart = b;
    else if (sg.kind === 'else') elsePart = b;
    else if (sg.kind === 'forever') foreverParts.push(b);
  }
  // '계속'이 문장 끝(또는 앞)에 붙은 경우: 앞부분 동작을 계속 반복으로
  if (foreverParts.length && !foreverParts.some(f => f.lines.length) && !nearPart && startPart.lines.length) {
    foreverParts.push({ ...startPart }); startPart.lines = []; startPart.desc = [];
  }
  const used = new Set(handlers.map(h => h.btn));
  const freeBtn = () => ['B', 'A', 'AB'].find(b => !used.has(b));
  // 로보독 등에 꽂은 마이크로비트의 A·B 버튼은 가려져서 못 누름 → 켜고 끄기는 로보독 본체 버튼(전원 스위치 옆)을 먼저 씀
  let robotUsed = robotBtn.some(r => r.lines.length), robotDeclared = false;
  const takeToggle = () => { if (!robotUsed) { robotUsed = true; return 'ROBOT'; } const b = freeBtn() || 'B'; used.add(b); return b; };
  const btnName = (b) => b === 'ROBOT' ? '로보독 본체 버튼' : (b === 'AB' ? 'A+B' : b) + ' 버튼';
  const onPress = (b, lines) => {
    if (b !== 'ROBOT') return [`input.onButtonPressed(Button.${b}, function () {`, ...indent(lines), '})'];
    if (!robotDeclared) { robotDeclared = true; code.splice(1, 0, 'let 본체이전 = false'); }
    return ['basic.forever(function () {', '    let 본체 = robodog.getButton()', '    if (본체 && !(본체이전)) {', ...indent(lines, 2), '    }', '    본체이전 = 본체', '    basic.pause(50)', '})'];
  };

  // 계속 걷기(이동이 있는 반복)는 버튼으로 켜고 끄며, 10초 지나면 저절로 멈춤(책상 안전)
  let walkerNo = 0;
  const walker = (btn, lines, label) => {
    const cl = continuous(lines);
    if (cl.every(l => l.includes('robodog.move('))) { lines = cl; label = label.replace(/\d+(\.\d+)?초 /g, ''); }   // 걷기만이면 끊기지 않고 쭉 걷기
    const v = walkerNo ? `걷는중${walkerNo + 1}` : '걷는중', t0 = walkerNo ? `시작시간${walkerNo + 1}` : '시작시간'; walkerNo++;
    if (btn !== 'ROBOT') used.add(btn);
    code.splice(1, 0, `let ${v} = false`, `let ${t0} = 0`);
    tail.push('', ...onPress(btn, [`${v} = !(${v})`, `${t0} = input.runningTime()`, `if (!(${v})) {`, '    robodog.stop()', '}']),
      'basic.forever(function () {', `    if (${v}) {`, ...indent(lines, 2), `        if (input.runningTime() - ${t0} > 10000) {`, `            ${v} = false`, '            robodog.stop()', '        }', '    }', '    basic.pause(20)', '})');
    expl.push(`${btnName(btn)}을 누르면 ${label} 시작, 다시 누르면 멈춤 (10초 지나면 저절로 멈춤)`);
    warnings.push('계속 걷는 코드는 10초 뒤 저절로 멈추게 했어요(책상에서 떨어지지 않게). 바닥에서 시험하고, 시간은 10000(10초)을 바꾸면 돼요.');
  };

  code.push(...startPart.lines);
  if (startPart.desc.length) expl.push('켜면: ' + startPart.desc.join(' → '));

  for (const h of handlers) {
    if (!h.lines.length) continue;
    if (h.always && hasMove(h.lines)) { walker(h.btn, h.lines, '계속 ' + h.desc.join(' → ')); continue; }
    if (h.always) {
      const v = `반복${h.btn}`;
      code.splice(1, 0, `let ${v} = false`);
      tail.push('', `input.onButtonPressed(Button.${h.btn}, function () {`, `    ${v} = !(${v})`, '})', 'basic.forever(function () {', `    if (${v}) {`, ...indent(h.lines, 2), '    }', '    basic.pause(20)', '})');
      expl.push(`${h.btn === 'AB' ? 'A+B' : h.btn} 버튼으로 켜고 끄기: 계속 ` + h.desc.join(' → '));
      continue;
    }
    tail.push('', `input.onButtonPressed(Button.${h.btn}, function () {`, ...indent(h.lines), '})');
    expl.push(`${h.btn === 'AB' ? 'A+B' : h.btn} 버튼: ` + h.desc.join(' → '));
  }
  for (const r of robotBtn) {
    if (!r.lines.length) continue;
    code.splice(1, 0, 'let 이전버튼 = false');
    tail.push('', 'basic.forever(function () {', '    let 눌림 = robodog.getButton()', '    if (눌림 && !(이전버튼)) {', ...indent(r.lines, 2), '    }', '    이전버튼 = 눌림', '    basic.pause(50)', '})');
    expl.push('로보독 버튼을 누를 때: ' + r.desc.join(' → '));
  }

  if (radioCases.length) {
    // 03 예제와 같은 구조: 받은 숫자는 기록만, 처리는 한 곳에서. 2초 동안 신호가 없거나 A(멈춤 잠금)면 멈춤
    const lockBtn = !robotUsed ? takeToggle() : (!used.has('A') ? (used.add('A'), 'A') : null);
    const lock = !!lockBtn;
    code.splice(1, 0, 'let 신호 = 0', 'let 마지막신호 = 0', 'let 이전신호 = -1', ...(lock ? ['let 잠금 = false'] : []), 'radio.setGroup(1)');
    tail.push('', 'radio.onReceivedNumber(function (받은수) {', '    신호 = 받은수', '    마지막신호 = input.runningTime()', '})');
    if (lock) tail.push(...onPress(lockBtn, ['잠금 = !(잠금)', 'if (잠금) {', '    robodog.stop()', '    robodog.headLedPrint(deflib.HeadLedSide.Both, "X")', '}', '이전신호 = -1']));
    tail.push('basic.forever(function () {', `    if (${lock ? '잠금 || ' : ''}input.runningTime() - 마지막신호 > 2000) {`, '        if (이전신호 != 0) {', '            robodog.stop()', '            이전신호 = 0', '        }',
      '    } else if (신호 != 이전신호) {', '        이전신호 = 신호', '        robodog.stop()');
    radioCases.forEach((c, i) => {
      tail.push(`        ${i ? '} else if' : 'if'} (신호 == ${c.n}) {`, ...indent(continuous(c.lines), 3));
      expl.push(`라디오 ${c.n}: ` + ((hasMove(c.lines) ? c.desc.join(' → ').replace(/\d+(\.\d+)?초 /g, '') : c.desc.join(' → ')) || '멈추기') + (hasMove(c.lines) ? ' (신호가 오는 동안 계속)' : ''));
    });
    tail.push('        }', '    }', '    basic.pause(50)', '})');
    expl.push('안전장치: 2초 동안 신호가 없으면 멈춤' + (lock ? `, ${btnName(lockBtn)} = 멈춤 잠금 ↔ 풀기(잠그면 눈에 X)` : ''));
    warnings.push('라디오 모둠번호는 1로 넣었어요. USB 마이크로비트(AI 브리지)와 같은 번호로 맞추세요.');
    if (/(라디오|무선|리모컨|리모콘)\s*(로)?\s*(A|B|에이|비)\s*(버튼|단추)/i.test(src)) warnings.push('리모컨(손에 든 마이크로비트)에는 A 버튼을 누르면 radio.sendNumber(1), B 버튼을 누르면 radio.sendNumber(2)를 보내는 코드를 넣고, 모둠번호를 1로 같게 맞추세요.');
    if (!lock) warnings.push('버튼이 모두 다른 일에 쓰여 "멈춤 잠금"을 넣지 못했어요. 비상시에는 전원을 끄세요.');
  }

  if (nearPart) {
    // 02 예제와 같은 구조: 값 0(못 읽음)은 멈춤, 상태가 바뀔 때만 명령
    const cm = num(src, /(\d+)\s*(cm|센티)/, 20);
    const sb = takeToggle();
    const thenL = nearPart.lines.length ? nearPart.lines : ['robodog.stop()'];
    let elseL = elsePart && elsePart.lines.length ? continuous(elsePart.lines) : ['robodog.move(deflib.MoveDirection.Forward, 20)'];
    if (elseL.some(l => /MoveDirection\.Backward/.test(l))) {
      elseL = ['robodog.stop()']; elsePart.desc = ['멈추기(뒤로 계속 걷기 대신)'];
      warnings.push('거리센서는 앞만 봐서 "멀면 뒤로 계속 걷기"는 넣지 않고 멈추게 했어요.');
    }
    code.splice(1, 0, 'let 걷는중 = false', 'let 상태 = 0');
    tail.push('', ...onPress(sb, ['걷는중 = !(걷는중)', '상태 = 0', 'if (!(걷는중)) {', '    robodog.stop()', '}']),
      'basic.forever(function () {', '    if (걷는중) {', '        let 거리 = robodog.getTof()', '        if (거리 == 0) {', '            if (상태 != 0) {', '                robodog.stop()', '                상태 = 0', '            }',
      `        } else if (거리 < ${cm}) {`, '            if (상태 != 1) {', '                상태 = 1', ...indent(thenL, 4), '            }',
      '        } else if (상태 != 2) {', '            상태 = 2', ...indent(elseL, 3), '        }', '    }', '    basic.pause(100)', '})');
    expl.push(`${btnName(sb)}으로 시작/멈춤. 거리센서 값이 ${cm}보다 작아지면 한 번: ` + (nearPart.desc.join(' → ') || '멈추기') + ' / 멀면: ' + ((elsePart && elsePart.desc.join(' → ').replace(/\d+초 /g, '계속 ')) || '천천히 계속 앞으로') + ' / 값이 0(못 읽음)이면 멈춤');
    warnings.push('거리센서 값의 단위는 실물에서 확인이 필요해요(시뮬레이터는 cm로 가정). 거리센서는 책상 끝(낭떠러지)은 못 봐요 — 바닥에서 시험하세요.');
  }

  for (const f of foreverParts) {
    if (!f.lines.length) continue;
    if (hasMove(f.lines)) { walker(takeToggle(), f.lines, '계속 ' + f.desc.join(' → ')); continue; }
    tail.push('', 'basic.forever(function () {', ...indent(f.lines), '})');
    expl.push('계속 반복: ' + f.desc.join(' → '));
  }
  code.push(...tail);
  if (code.some(l => l.includes('input.onButtonPressed'))) warnings.push('로보독 등에 꽂은 마이크로비트의 A·B 버튼은 가려져서 누를 수 없어요. 실물 로보독에서는 "로보독 버튼 누르면"으로 말하거나, 리모컨 마이크로비트(라디오)를 쓰세요. A·B는 시뮬레이터와 손에 든 마이크로비트에서만 눌러요.');
  if (unknown.length) warnings.push('이해하지 못한 말: ' + unknown.map(u => `"${u}"`).join(', ') + ' — 아래 "이렇게 말해 보세요" 표현을 참고하세요.');

  const body = code.filter((l, i, a) => !(l === '' && a[i - 1] === ''));
  const meaningful = body.slice(1).some(l => l);   // 맨 앞 준비 자세 말고 실제 동작이 있는지
  const header = `// 로보독 도우미가 만든 코드: ${src.replace(/\s+/g, ' ').slice(0, 60)}`;
  return {
    code: meaningful ? [header, ...body].join('\n') + '\n' : '',
    explanation: meaningful ? expl.join('\n') : (/숙제|공부|게임|욕|바보/.test(src) ? '나는 로보독 움직임만 도와줄 수 있어요. ' : '무엇을 해야 할지 찾지 못했어요. ') + '로보독이 할 수 있는 말: ' + CAN_DO,
    warnings, suggestions: suggestExamples(src),
  };
}

// 데이터 기반 추천: 요청 낱말로 관련 예제·수업 활동 추천
const EXAMPLE_HINTS = [
  { id: '03_ai-traffic-dog', title: '3. AI 신호등 안내견', re: /신호등|색\s*카드|안내견|AI|인공지능|웹캠|카드를\s*보/, why: 'AI가 카드를 보고 로보독이 반응하는 예제(AI 브리지)' },
  { id: '02_distance-rule', title: '2. 규칙으로 반응하기', re: /거리|가까|장애물|벽|부딪/, why: '거리센서로 멈추고 경고하는 예제' },
  { id: '01_hello-robodog', title: '1. 안녕, 로보독', re: /인사|버튼|안녕|순서/, why: '버튼으로 순서대로 움직이는 첫 예제' },
  { id: '05_motion-tour', title: '5. 동작 둘러보기', re: /앉|물구나무|기지개|사각형|다리|모터/, why: '자세·걷기·다리 블록을 한 번에 보는 예제' },
  { id: '04_ai-team-template', title: '4. 우리 모둠 AI 로보독', re: /모둠|프로젝트|알레르기|급식|도우미/, why: '번호마다 다른 행동을 넣는 프로젝트 틀' },
  { id: 'dance', title: '🐕×8 군무', re: /군무|여러\s*대|다\s*같이|웨이브|바운스|춤/, why: '여러 대가 함께 움직이는 시연' },
];
export function suggestExamples(text) {
  return EXAMPLE_HINTS.filter(h => h.re.test(text)).slice(0, 3);
}

export const SAMPLE_REQUESTS = [
  '앞으로 2초 걷고 오른쪽으로 90도 돌아서 인사해',
  'A 버튼을 누르면 빨간 불을 켜고 멍멍 짖어, B 버튼을 누르면 앉아',
  '장애물이 가까우면 멈추고 비켜라고 말해, 아니면 천천히 앞으로 걸어',
  '라디오 1을 받으면 멈춰, 라디오 3을 받으면 초록 불 켜고 앞으로 걸어',
  '웃는 눈으로 3번 반복해서 춤춰',
];

// AI(서버) 연결: 설정 확인 → 요청. 실패하면 규칙 기반으로
export async function checkAi() {
  try {
    const r = await fetch('/api/robodog-assistant', { method: 'GET', cache: 'no-store' });
    if (!r.ok) return { available: false, reason: 'offline' };
    const j = await r.json();
    return { available: !!j.configured, needsCode: !!j.needsCode, reason: j.configured ? '' : 'not_configured' };
  } catch (e) { return { available: false, reason: 'offline' }; }
}
export async function askAi(request, currentCode, classCode) {
  const r = await fetch('/api/robodog-assistant', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ request, currentCode, classCode }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.error || ('http_' + r.status)); e.code = j.error; e.status = r.status; throw e; }
  return j;
}
