// AI 모드(Claude API) 서버 프롬프트를 블록 표(kits/<kit>/blocks.json)와 정책(policy.json)에서 만든다. 손으로 베끼지 않는다.
//
//   import { buildSystemPrompt, OUTPUT_SCHEMA } from '../tools/build-assistant-prompt.mjs';
//   const SYSTEM = buildSystemPrompt(blocks, policy, '포니봇');      // 서버 함수에서 한 번 만들어 캐시(cache_control)
//
// 서버 함수가 쓰는 법(이 파일은 함수를 만들지도 배포하지도 않는다 — docs 메모):
//   1) 서버 함수(예: netlify/functions/ponybot-assistant.mjs)는 로보독 함수의 게이트(수업 코드·속도 제한·길이 제한)를 그대로 쓰고,
//      SYSTEM 만 buildSystemPrompt(blocks, policy, '포니봇')로 바꾼다. 출력 형식은 OUTPUT_SCHEMA(json_schema)로 강제한다.
//   2) 모델 응답의 code 는 반드시 checkPonyCode(code, policy)(bridge/sim/kits/ponybot/assistant.js → validateCode)로 서버에서 다시 검사한다.
//      오류(E1 없는 블록·E2 없는 enum·E3 범위·E4 인자 수·E5 문법)나 정책 위반(W3 한도·W4 금지)이면 code 를 비우고 이유를 돌려준다.
//   3) 키가 없거나·수업 코드가 틀리거나·모델 호출이 실패하거나·검사에 걸리면 클라이언트는 ponyAssistant(text, policy)(규칙 모드)로 대신 만든다.
//   프롬프트의 "부탁"만으로는 안전하지 않다 — 정책 값(속도 한도 등)은 모델에 맡기지 말고 2)의 결정적 검사로 막는다.
//
// 이 파일은 node·브라우저·번들러 어디서나 쓸 수 있게 node 모듈을 import 하지 않는다.
import { blockText } from '../bridge/sim/kits/ponybot/assistant.js';

export const OUTPUT_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['code', 'explanation', 'warnings'],
  properties: { code: { type: 'string' }, explanation: { type: 'string' }, warnings: { type: 'array', items: { type: 'string' } } },
};

const rangeOf = (p) => (p.min != null || p.max != null ? `${p.min ?? ''}~${p.max ?? ''}` : '');

function typeOf(ns, p) {
  if (ns.enums?.some(e => e.name === p.type)) return `${ns.name}.${p.type}`;
  return p.type || (p.default !== undefined && !isNaN(Number(p.default)) ? 'number' : 'any');
}

// 블록 한 줄 = 함수 시그니처 + 범위·기본값 + 한국어 블록 이름. 숨김(hidden) 함수는 뺀다.
export function buildBlockSyntax(blocks) {
  const out = [];
  for (const ns of blocks.namespaces || []) {
    if (ns.name === '(global)') continue;
    const groups = new Map();
    for (const f of ns.functions || []) {
      if (f.hidden) continue;
      const sig = f.params.map(p => {
        const r = rangeOf(p);
        return `${p.name}: ${typeOf(ns, p)}${r ? ` (${r})` : ''}${p.default != null && p.default !== '' ? ` = ${p.default}` : ''}`;
      }).join(', ');
      const ret = f.returns && f.returns !== 'void' ? ` -> ${f.returns}` : '';
      const line = `${ns.name}.${f.name}(${sig})${ret}  // ${blockText(f)}`;
      const g = f.group || '기타';
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(line);
    }
    for (const [g, lines] of groups) out.push(`## ${g}`, ...lines, '');
    const enums = (ns.enums || []).map(e => {
      const mem = e.members.map(m => `${m.name}${m.block_en ? `(${m.block_en})` : ''}`).join(' | ');
      return `${ns.name}.${e.name}: ${mem}`;
    });
    if (enums.length) out.push('## enum (이 값만 쓸 수 있어요)', ...enums, '');
  }
  return out.join('\n').trim();
}

// 정책 문장은 교사가 값을 정했을 때(null 아님)만 넣는다. 스킬·코드가 값을 정하지 않는다.
export function buildPolicyText(policy = {}) {
  const lines = [];
  const has = (v) => typeof v === 'number' && isFinite(v);
  if (has(policy.maxSpeed)) lines.push(`- 속도(speed)는 ${policy.maxSpeed} 이하로만 쓴다(이 수업의 한도).`);
  if (has(policy.defaultSpeed)) lines.push(`- 문장에 속도 숫자가 없으면 속도 ${policy.defaultSpeed}을 쓴다.`);
  if (has(policy.defaultSeconds)) lines.push(`- 문장에 시간이 없고 "계속"도 아니면 ${policy.defaultSeconds}초 움직이고 멈춘다.`);
  if (has(policy.autoStopMs)) lines.push(`- 계속 움직이는 동작은 ${policy.autoStopMs}ms 뒤 자동으로 멈추게 만든다.`);
  if (has(policy.nearCm)) lines.push(`- "가까우면"에 숫자가 없으면 ${policy.nearCm}cm를 기준으로 한다.`);
  if (has(policy.radioTimeoutMs)) lines.push(`- 계속 움직이는 라디오 동작은 ${policy.radioTimeoutMs}ms 동안 신호가 없으면 멈추게 만든다.`);
  if (Array.isArray(policy.forbid) && policy.forbid.length) lines.push(`- 다음 블록·네임스페이스는 쓰지 않는다: ${policy.forbid.join(', ')}`);
  return lines.length ? ['# 이 수업의 설정(선생님이 정한 값)', ...lines].join('\n') : '';
}

export function buildSystemPrompt(blocks, policy = {}, kitName = '교구') {
  const ext = blocks.extension || {};
  const parts = [
    `너는 마이크로비트로 움직이는 ${kitName}(MakeCode 확장 ${ext.id || ''} ${ext.version || ''})용 코드 도우미다. 초등·중학생이 한국어로 하고 싶은 일을 말하면 MakeCode JavaScript를 만든다.`,
    '출력은 JSON 하나: {"code": 코드 문자열, "explanation": 쉬운 한국어 설명(영어 코드명 대신 블록 한국어 이름 사용), "warnings": [주의할 점]}. 부적절하거나 만들 수 없는 요청이면 code는 빈 문자열이고 이유를 explanation에 쓴다.',
    '# 코드 규칙 (블록으로 바뀌는 JS만)',
    [
      '- 콜백은 function () { } 로 쓴다. 화살표 함수(=>)·class·async·템플릿 문자열(`)은 쓰지 않는다.',
      '- 변수는 let 으로 맨 위에서 선언한다. 반복은 for (let i = 0; i < n; i++) / while / basic.forever(function () { }) 만 쓴다.',
      '- 코드 맨 위에 한 줄 주석으로 무엇을 하는 코드인지 쓴다.',
      '- 아래 "블록 문법"에 있는 함수·enum 값만 쓴다. 없는 함수·enum 을 만들지 않는다. 숫자 인자는 표시된 범위 안에서 쓴다.',
      '- 움직이는 동작은 한 번이면 이동 → basic.pause(밀리초) → 모든 모터 정지 순서로 쓴다. 켜자마자 계속 움직이는 코드를 만들면 warnings 에 책상 끝(낭떠러지)·멈춤 방법을 알린다.',
      '- 버튼 핸들러·라디오 핸들러에는 값만 기록하고 움직임은 basic.forever 한 곳에서 처리하는 편이 안전하다. 핸들러 안에서 긴 basic.pause 는 쓰지 않는다.',
      '- 거리센서(ping)는 반사가 없으면 0 또는 최댓값(기본 500)을 돌려준다. 이 값은 "아주 멀다"가 아니라 "못 읽음"으로 보고 멈춘다.',
      '- 포니봇 화면(OLED)에는 영어·숫자만 쓴다(한글은 확인 전). 컬러센서 블록은 aiPonybot.initColorSensor 로 초기화한 뒤 쓴다.',
      '- 개인정보(이름·학교·전화번호)는 코드·설명에 넣지 않는다.',
    ].join('\n'),
    '# 블록 문법 (이 표에서만 고른다)',
    buildBlockSyntax(blocks),
    '# micro:bit 기본 블록 (표 밖, 그대로 사용 가능)',
    'input.onButtonPressed(Button.A | Button.B | Button.AB, function () { }) / basic.pause(ms) / basic.forever(function () { }) / basic.showIcon(IconNames.Heart 등) / basic.clearScreen() / input.runningTime() / radio.setGroup(n) / radio.onReceivedNumber(function (받은수) { })',
  ];
  const pol = buildPolicyText(policy);
  if (pol) parts.push(pol);
  return parts.join('\n\n');
}
