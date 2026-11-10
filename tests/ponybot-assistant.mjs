// 포니봇 도우미 시험(브라우저 없이): node tests/ponybot-assistant.mjs
import fs from 'node:fs';
import { validateCode, loadBabel } from '../.claude/skills/microbit-sim-builder/scripts/validate-code.mjs';
import { configurePony, ponyAssistant, checkPonyCode, SAMPLE_REQUESTS } from '../bridge/ponybot/sim/assistant.js';
import { buildBlockSyntax, buildSystemPrompt, buildPolicyText, OUTPUT_SCHEMA } from '../tools/build-assistant-prompt.mjs';

const read = (p) => JSON.parse(fs.readFileSync(new URL(p, import.meta.url), 'utf8'));
const blocks = read('../kits/ponybot/blocks.json');
const policy = read('../kits/ponybot/policy.json');
const Babel = loadBabel(new URL('../bridge/sim/lib/babel.min.js', import.meta.url).pathname);
configurePony({ blocks, validateCode, Babel });

const results = [];
const check = (name, ok, detail = '') => { results.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  → ' + String(detail).slice(0, 300)}`); };
const R = (t, p = policy) => ponyAssistant(t, p);
const speeds = (c) => [...c.matchAll(/(?:runMecanum|runNormal)\([^,]+,\s*(\d+)\)/g)].map(m => Number(m[1]));
const pol = (o) => ({ ...policy, ...o });
const errs = (code, p = policy) => validateCode(code, blocks, { Babel, policy: p }).errors;

// 1. 예시 문장 → 코드, 그리고 모두 validateCode 오류 0
for (const s of SAMPLE_REQUESTS) {
  const r = R(s);
  check('예시 문장 코드 생성: ' + s, !!r.code, r.explanation);
  check('  └ validateCode 오류 0', r.code && errs(r.code).length === 0, JSON.stringify(errs(r.code || '')));
}
check('예시 문장 8개 이상', SAMPLE_REQUESTS.length >= 8);

// 2. 트리거 순서
let r = R('A 버튼을 누르면 앞으로 1초 가고, B 버튼을 누르면 뒤로 1초 가');
check('트리거 순서: A 핸들러가 B보다 앞, 앞→뒤', r.code.indexOf('Button.A') < r.code.indexOf('Button.B') && r.code.indexOf('Mecanum.Forward') < r.code.indexOf('Mecanum.Backward'), r.code);
r = R('B 버튼을 누르면 뒤로 1초 가고, A 버튼을 누르면 앞으로 1초 가');
check('트리거 순서: 말한 순서(B 먼저)를 지킴', r.code.indexOf('Button.B') < r.code.indexOf('Button.A'), r.code);
r = R('앞으로 1초 가고 A 버튼을 누르면 뒤로 1초 가');
check('시작 동작 + 버튼 동작 둘 다 만듦', /Mecanum\.Forward/.test(r.code) && /Button\.A[\s\S]*Mecanum\.Backward/.test(r.code), r.code);
r = R('A 버튼을 누르면 앞으로 1초 가, A 버튼을 누르면 OLED에 "HI" 라고 써');
check('같은 버튼은 핸들러 하나로 합침', (r.code.match(/onButtonPressed\(Button\.A/g) || []).length === 1 && /showString\("HI"/.test(r.code), r.code);

// 3. 숫자와 조사
r = R('속도 100으로 앞으로 2초 동안 가');
check('조사: "100으로" → 100, "2초 동안" → pause(2000)', /Forward, 100\)/.test(r.code) && /pause\(2000\)/.test(r.code), r.code);
r = R('앞으로 1.5초 동안 가', pol({ defaultSpeed: 77 }));
check('소수 시간 1.5초 → 1500, 속도 없으면 정책 defaultSpeed', /pause\(1500\)/.test(r.code) && /Forward, 77\)/.test(r.code), r.code);
r = R('속도를 200으로 하고 앞으로 1초 가고 뒤로 1초 가');
check('앞에서 말한 속도가 뒤 이동에도 이어짐', JSON.stringify(speeds(r.code)) === '[200,200]', r.code);
r = R('앞으로 1초 가', pol({ defaultSpeed: null }));
check('defaultSpeed가 null이면 속도 없는 이동은 코드 안 만들고 숫자를 물어봄', !/runMecanum/.test(r.code) && r.warnings.some(w => /속도를 숫자로/.test(w)), r.code + JSON.stringify(r.warnings));

// 4. 속도 범위·정책
r = R('속도 300으로 앞으로 1초 가');
check('속도 300 → 확장 범위 255로 줄이고 경고', speeds(r.code)[0] === 255 && r.warnings.some(w => /255/.test(w) && /범위/.test(w)), r.code + JSON.stringify(r.warnings));
r = R('속도 200으로 앞으로 1초 가', pol({ maxSpeed: 150 }));
check('maxSpeed=150 → 150으로 줄이고 경고', speeds(r.code)[0] === 150 && r.warnings.some(w => /한도 150/.test(w)), r.code + JSON.stringify(r.warnings));
r = R('속도 200으로 앞으로 1초 가', pol({ maxSpeed: null }));
check('maxSpeed=null → 줄이지 않음, 경고 없음', speeds(r.code)[0] === 200 && !r.warnings.some(w => /한도/.test(w)), r.code + JSON.stringify(r.warnings));
r = R('속도 300으로 앞으로 1초 가', pol({ maxSpeed: 100 }));
check('범위(255) 클램프 뒤 정책(100) 클램프, 코드는 정책 한도 이하', speeds(r.code)[0] === 100, r.code);
r = R('빠르게 앞으로 1초 가');
check('"빠르게"는 숫자를 지어내지 않고 기본 속도 + 경고', speeds(r.code)[0] === policy.defaultSpeed && r.warnings.some(w => /빠르게/.test(w)), JSON.stringify(r.warnings));

// 5. 방향 어휘
r = R('왼쪽 옆으로 1초 가'); check('왼쪽 옆 → Mecanum.Left', /Mecanum\.Left,/.test(r.code), r.code);
r = R('오른쪽 뒤 대각선으로 1초 가'); check('대각선 → RightBackward', /Mecanum\.RightBackward/.test(r.code), r.code);
r = R('반시계 방향으로 돌아'); check('반시계 → DirectionControl.CounterClockwise(시계와 안 섞임)', /DirectionControl\.CounterClockwise/.test(r.code) && !/DirectionControl\.Clockwise/.test(r.code), r.code);
r = R('90도 돌아');
check('각도로 돌기는 만들지 않고 안내(추측 금지)', !r.code && r.warnings.some(w => /각도/.test(w)), JSON.stringify(r));
r = R('A 버튼을 누르면 앞으로 1초 가고 춤춰');
check('모르는 조각은 경고하고 코드에 넣지 않음', /Forward/.test(r.code) && r.warnings.some(w => /춤춰/.test(w)) && !/춤/.test(r.code.split('\n').slice(1).join('\n')), JSON.stringify(r.warnings));
r = R('OLED에 숫자 42 써'); check('OLED 숫자 → showNumber', /showNumber\(42, 0, 0, 1\)/.test(r.code), r.code);
r = R('마이크로비트 화면에 하트 보여줘'); check('LED 아이콘 → IconNames.Heart', /showIcon\(IconNames\.Heart\)/.test(r.code), r.code);
r = R('OLED에 "안녕" 이라고 써'); check('OLED 한글은 경고', r.warnings.some(w => /영어·숫자만/.test(w)) && /showString/.test(r.code), JSON.stringify(r.warnings));
r = R('화면에 하트');
check('OLED인지 LED인지 모호하면 지어내지 않음', !r.code, r.code);

// 6. 계속·정책 안전
r = R('시작하면 앞으로 계속 가');
check('켜자마자 계속 가면 B 멈춤 버튼 + 경고', /onButtonPressed\(Button\.B[\s\S]*stopAllMotors/.test(r.code) && r.warnings.some(w => /켜자마자/.test(w)), r.code);
r = R('A 버튼을 누르면 앞으로 계속 가', pol({ autoStopMs: null }));
check('autoStopMs=null → 자동 멈춤 코드 없음', !/시작시간/.test(r.code), r.code);
r = R('A 버튼을 누르면 앞으로 계속 가', pol({ autoStopMs: 5000 }));
check('autoStopMs=5000 → 5000ms 자동 멈춤 코드', /> 5000/.test(r.code) && errs(r.code).length === 0, r.code);
r = R('라디오 3을 받으면 앞으로 계속 가');
check('계속 가는 라디오: 정책 radioTimeoutMs(2000) 끊김 멈춤', /마지막수신 > 2000/.test(r.code), r.code);
r = R('라디오 3을 받으면 앞으로 계속 가', pol({ radioTimeoutMs: null }));
check('radioTimeoutMs=null → 끊김 코드 없음 + 경고', !/마지막수신 >/.test(r.code) && r.warnings.some(w => /끊겨도/.test(w)));
r = R('가까우면 멈춰');
check('가까우면(숫자 없음) → 정책 nearCm 20 + 안내', /거리 < 20/.test(r.code) && /20cm/.test(r.explanation), r.code);
r = R('가까우면 멈춰', pol({ nearCm: null }));
check('nearCm=null → 지어내지 않고 숫자를 물어봄', !r.code && r.warnings.some(w => /몇 cm/.test(w)), JSON.stringify(r));
r = R('30cm보다 가까우면 멈추고 멀면 앞으로 가');
check('거리: 못 읽음(0·500) 멈춤 + 가까우면 + 멀면(계속 가기)', /거리 == 0 \|\| 거리 >= 500/.test(r.code) && /거리 < 30/.test(r.code) && /\} else \{\n\s+aiPonybot\.runMecanum/.test(r.code), r.code);
r = R('A 버튼을 누르면 앞으로 1초 가고 뒤로 1초 가는 걸 3번 반복해');
check('N번 반복 → for 루프', /for \(let 번 = 0; 번 < 3; 번\+\+\)/.test(r.code), r.code);

// 7. 어휘가 블록 표에서 나오는지
r = R('노란색이 보이면 멈춰'); check('색 낱말(블록 표 DetectedColor 노란색)', /DetectedColor\.Yellow/.test(r.code), r.code);
r = R('노랑이 보이면 멈춰'); check('색 동의어(노랑)', /DetectedColor\.Yellow/.test(r.code), r.code);
const cut = JSON.parse(JSON.stringify(blocks)); const dc = cut.namespaces[0].enums.find(e => e.name === 'DetectedColor'); dc.members = dc.members.filter(m => m.name !== 'Yellow');
r = ponyAssistant('노란색이 보이면 멈춰', policy, { blocks: cut });
check('블록 표에서 Yellow를 빼면 노란색 트리거가 사라짐(표 기반 증거)', !/Yellow/.test(r.code), r.code);
const broken = JSON.parse(JSON.stringify(blocks)); broken.namespaces[0].functions = broken.namespaces[0].functions.filter(f => f.name !== 'runMecanum');
r = ponyAssistant('앞으로 가', policy, { blocks: broken });
check('블록 표에 runMecanum이 없으면 코드를 만들지 않음', !r.code && /블록 표/.test(r.explanation), r.explanation);

// 8. 입력 검사·안내
r = R('가'.repeat(301)); check('301자 입력 거절', !r.code && /너무 길어요/.test(r.explanation));
r = R('   '); check('빈 입력 안내', !r.code && /적어 주세요/.test(r.explanation));
r = R('내 이름은 홍길동이야, 앞으로 1초 가'); check('개인정보 안내(코드는 만듦)', r.warnings.some(w => /개인정보/.test(w)) && !!r.code);
r = R('카메라로 사람 얼굴을 보면 멈춰'); check('카메라·AI 요청은 예제 03 안내', !r.code && r.suggestions.some(s => s.id === '03_ai-traffic-ponybot'), JSON.stringify(r));
r = R('버튼을 누르면 앞으로 가'); check('어느 버튼인지 모르면 거절', !r.code && /어느 버튼/.test(r.explanation));
r = ponyAssistant('앞으로 1초 가', policy, { Babel: null });
check('Babel이 없으면 검사 건너뜀을 경고(코드는 줌)', !!r.code && r.warnings.some(w => /Babel/.test(w)), JSON.stringify(r.warnings));

// 9. 출력 검사(환각·정책) — 규칙 모드와 AI 모드가 같은 길을 쓴다
let c = checkPonyCode('aiPonybot.flyAway()', policy);
check('환각 방지: aiPonybot.flyAway() 거절(E1)', !c.ok && c.errors.some(e => e.code === 'E1'), JSON.stringify(c));
c = checkPonyCode('aiPonybot.runMecanum(aiPonybot.Mecanum.Fly, 100)', policy);
check('환각 방지: 없는 enum Mecanum.Fly 거절(E2)', !c.ok && c.errors.some(e => e.code === 'E2'), JSON.stringify(c));
c = checkPonyCode('aiPonybot.runMecanum(aiPonybot.Mecanum.Forward, 300)', policy);
check('확장 범위 밖 속도 300 거절(E3)', !c.ok && c.errors.some(e => e.code === 'E3'), JSON.stringify(c));
c = checkPonyCode('aiPonybot.runMecanum(aiPonybot.Mecanum.Forward, 200)', pol({ maxSpeed: 150 }));
check('정책 한도 150 초과는 거절(W3 → 거절)', !c.ok, JSON.stringify(c));
c = checkPonyCode('music.playTone(262, 500)', pol({ forbid: ['music.*'] }));
check('정책 forbid music.* 거절', !c.ok, JSON.stringify(c));
c = checkPonyCode('aiPonybot.stopAllMotors(', policy);
check('문법 오류 거절(E5)', !c.ok && c.errors.some(e => e.code === 'E5'), JSON.stringify(c));
r = R('앞으로 가', pol({ forbid: ['aiPonybot.runMecanum'] }));
check('규칙 모드도 forbid에 걸리면 코드 대신 이유', !r.code && /검사/.test(r.explanation), JSON.stringify(r));

// 10. AI 프롬프트 빌더
const visible = blocks.namespaces[0].functions.filter(f => !f.hidden);
const syn = buildBlockSyntax(blocks), sys = buildSystemPrompt(blocks, policy, '포니봇');
check('프롬프트: 보이는 블록 전부 포함', visible.every(f => sys.includes(`aiPonybot.${f.name}(`)), visible.filter(f => !sys.includes(`aiPonybot.${f.name}(`)).map(f => f.name));
check('프롬프트: 모든 enum과 멤버 포함', blocks.namespaces[0].enums.every(e => sys.includes(`aiPonybot.${e.name}:`) && e.members.every(m => sys.includes(m.name))));
check('프롬프트: 한국어 블록 이름·범위 포함', /메카넘 \S+ 방향 \S+ 속도로 이동/.test(syn) && /speed: number \(0~255\)/.test(syn) && /degree: number \(0~180\)/.test(syn));
check('프롬프트: 코드 규칙(function 콜백, 화살표·템플릿 금지, 맨 위 주석)', /function \(\) \{ \}/.test(sys) && /화살표 함수\(=>\)/.test(sys) && /템플릿 문자열/.test(sys) && /맨 위에 한 줄 주석/.test(sys));
const allNull = { defaultSpeed: null, maxSpeed: null, autoStopMs: null, forbid: [], defaultSeconds: null, nearCm: null, radioTimeoutMs: null };
check('프롬프트: 정책이 모두 null이면 정책 절 없음', !buildSystemPrompt(blocks, allNull, '포니봇').includes('선생님이 정한 값') && buildPolicyText(allNull) === '');
check('프롬프트: maxSpeed 설정 시에만 "150 이하" 문장', /150 이하/.test(buildSystemPrompt(blocks, pol({ maxSpeed: 150 }))) && !/ 이하로만/.test(sys));
const hid = JSON.parse(JSON.stringify(blocks)); hid.namespaces[0].functions.find(f => f.name === 'servo').hidden = true;
check('프롬프트: 숨김 함수는 제외', !buildBlockSyntax(hid).includes('aiPonybot.servo(') && buildBlockSyntax(blocks).includes('aiPonybot.servo('));
check('출력 스키마: code·explanation·warnings', OUTPUT_SCHEMA.required.join() === 'code,explanation,warnings' && OUTPUT_SCHEMA.additionalProperties === false);

const pass = results.filter(Boolean).length, fail = results.length - pass;
console.log(`\n${pass}/${results.length} 통과${fail ? `, ${fail} 실패` : ''}`);
process.exit(fail ? 1 : 0);
