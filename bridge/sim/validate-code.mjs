#!/usr/bin/env node
// 블록 표(extract-blocks.py 출력)로 MakeCode JS를 결정적으로 검사한다.
// 규칙 도우미·AI 도우미 출력, 예제 .ts에 같은 검사를 쓴다(모델의 "약속"에 맡기지 않음).
//
//   node validate-code.mjs --blocks kit.blocks.json [--babel bridge/sim/lib/babel.min.js] [--policy policy.json] file.ts [...]
//   import { validateCode } from './validate-code.mjs'   // 브라우저: validateCode(src, blocks, { Babel: window.Babel })
//
// 검사(오류 = 실제 MakeCode에서 안 되거나 확장 범위 밖, 경고 = 블록 변환이 깨질 수 있음·정책):
//  E1 표에 없는 함수(ns.fn)          E2 표에 없는 enum 멤버       E3 숫자 인자가 확장 범위(min..max) 밖
//  E4 인자 개수 초과                 E5 문법 오류                E6 네임스페이스 안 enum을 짧은 이름으로 씀
//  W1 숨김(hidden) 함수              W2 블록으로 안 바뀌는 문법(화살표 함수·템플릿 문자열·class)
//  W3 정책 위반(policy.json — 사용자가 정한 값만. 이 스크립트에는 기본 한도가 없다)
//  W4 금지 네임스페이스(policy.forbid, 예: "music.*")
//
// policy.json 예(값은 교사가 정한다):
//   { "max": { "aiPonybot.runMecanum.speed": 150 }, "forbid": ["music.*"] }
// 교사용 policy.json(예: maxSpeed)은 도우미가 이 모양으로 바꿔 넘긴다(어느 인자가 '속도'인지는 교구마다 다름).
// strictPolicy:true = W3·W4를 오류로(도우미 출력용). 예제 점검은 기본(경고)으로.
// 배포: 이 파일을 사이트 안(예: bridge/sim/validate-code.mjs)에 복사해 브라우저·서버 함수가 import — 원본은 스킬, 복사 후 diff로 동기 확인.
// 한계: 표에는 확장 블록만 있다 → basic·input·radio·IconNames 등 기본 블록은 검사하지 않는다.

// node 모듈은 아래 loadBabel·CLI에서만 동적으로 불러온다 → 같은 파일을 브라우저에서도 import 가능

export function indexBlocks(blocks) {
  const fns = new Map(), enums = new Map(), bare = new Map();   // bare: 네임스페이스 안 enum의 짧은 이름 → ns
  for (const ns of blocks.namespaces || []) {
    for (const f of ns.functions || []) fns.set(`${ns.name}.${f.name}`, f);
    for (const e of ns.enums || []) {
      const members = new Set(e.members.map(m => m.name));
      if (ns.name === '(global)') enums.set(e.name, members);            // 전역 enum(MotorType.Forward)
      else { enums.set(`${ns.name}.${e.name}`, members); bare.set(e.name, ns.name); }   // aiPonybot.Mecanum.Forward
    }
  }
  const nsNames = new Set((blocks.namespaces || []).map(n => n.name).filter(n => n !== '(global)'));
  for (const k of [...bare.keys()]) if (enums.has(k)) bare.delete(k);   // 같은 이름의 전역 enum이 있으면 제외
  return { fns, enums, nsNames, bare };
}

const dotted = (n) => {
  if (!n) return null;
  if (n.type === 'Identifier') return n.name;
  if (n.type === 'MemberExpression' && !n.computed && n.property.type === 'Identifier') {
    const o = dotted(n.object); return o ? `${o}.${n.property.name}` : null;
  }
  return null;
};
const numValue = (n) => {
  if (!n) return null;
  if (n.type === 'NumericLiteral') return n.value;
  if (n.type === 'UnaryExpression' && n.operator === '-' && n.argument.type === 'NumericLiteral') return -n.argument.value;
  return null;
};
const lineOf = (n) => (n.loc ? n.loc.start.line - 1 : 0);   // 감싼 줄 하나 빼기

export function validateCode(src, blocks, { Babel, policy = {}, strictPolicy = false } = {}) {
  if (!Babel) throw new Error('Babel이 필요합니다(bridge/sim/lib/babel.min.js)');
  const { fns, enums, nsNames, bare } = indexBlocks(blocks);
  const errors = [], warnings = [];
  const forbid = (policy.forbid || []).map(p => p.replace(/\*$/, ''));
  const plugin = () => ({
    visitor: {
      CallExpression(p) {
        const name = dotted(p.node.callee); if (!name) return;
        const ns = name.split('.').slice(0, -1).join('.');
        const at = lineOf(p.node);
        forbid.forEach(f => { if (name.startsWith(f)) warnings.push({ code: 'W4', line: at, msg: `${name}: 이 수업에서 쓰지 않기로 한 블록` }); });
        if (!nsNames.has(ns)) return;                       // 기본 블록(basic, input…)은 여기서 검사하지 않음
        const f = fns.get(name);
        if (!f) { errors.push({ code: 'E1', line: at, msg: `${name}: 확장에 없는 블록` }); return; }
        if (f.hidden) warnings.push({ code: 'W1', line: at, msg: `${name}: 블록 목록에 안 보이는(숨김) 함수` });
        const args = p.node.arguments;
        if (args.length > f.params.length) errors.push({ code: 'E4', line: at, msg: `${name}: 인자 ${args.length}개(최대 ${f.params.length})` });
        args.forEach((a, i) => {
          const prm = f.params[i]; if (!prm) return;
          const v = numValue(a);
          if (v !== null && prm.min !== null && prm.min !== undefined && v < prm.min)
            errors.push({ code: 'E3', line: at, msg: `${name}(${prm.name}=${v}): 확장 범위 ${prm.min}~${prm.max} 밖` });
          if (v !== null && prm.max !== null && prm.max !== undefined && v > prm.max)
            errors.push({ code: 'E3', line: at, msg: `${name}(${prm.name}=${v}): 확장 범위 ${prm.min}~${prm.max} 밖` });
          const lim = policy.max && policy.max[`${name}.${prm.name}`];
          if (v !== null && lim !== undefined && Math.abs(v) > lim)
            warnings.push({ code: 'W3', line: at, msg: `${name}(${prm.name}=${v}): 수업 설정 한도 ${lim} 초과` });
        });
      },
      MemberExpression(p) {
        if (p.parentPath.isMemberExpression() || p.parentPath.isCallExpression({ callee: p.node })) return;
        const name = dotted(p.node); if (!name) return;
        const owner = name.split('.').slice(0, -1).join('.'), member = name.split('.').pop();
        if (bare.has(owner)) { errors.push({ code: 'E6', line: lineOf(p.node), msg: `${name}: ${bare.get(owner)}.${owner}.${member}로 써야 함(네임스페이스 빠짐)` }); return; }
        if (enums.has(owner) && !enums.get(owner).has(member))
          errors.push({ code: 'E2', line: lineOf(p.node), msg: `${name}: ${owner}에 없는 값(있는 값: ${[...enums.get(owner)].join(', ')})` });
      },
      'ArrowFunctionExpression|TemplateLiteral|ClassDeclaration'(p) {
        warnings.push({ code: 'W2', line: lineOf(p.node), msg: `${p.node.type}: 블록으로 바뀌지 않을 수 있음` });
      },
    },
  });
  try {
    Babel.transform(`async function __main() {\n${src}\n}`, {
      filename: 'main.ts', presets: [['typescript', { allExtensions: true }]], plugins: [plugin], sourceType: 'script',
    });
  } catch (e) {
    errors.push({ code: 'E5', line: 0, msg: '문법 오류: ' + String(e.message).split('\n')[0] });
  }
  if (strictPolicy) {   // 도우미 출력: 정책 위반은 경고가 아니라 거절
    for (let i = warnings.length - 1; i >= 0; i--) if (warnings[i].code === 'W3' || warnings[i].code === 'W4') errors.push(...warnings.splice(i, 1));
  }
  return { ok: errors.length === 0, errors, warnings };
}

export async function loadBabel(file) {
  const fs = await import('node:fs'), vm = await import('node:vm');
  const ctx = { window: {}, self: {}, console };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(file, 'utf8'), ctx);
  return ctx.Babel || ctx.window.Babel || ctx.self.Babel;
}

// ---- CLI ----
if (typeof process !== 'undefined' && process.argv && import.meta.url === `file://${process.argv[1]}`) {
  const fs = await import('node:fs'), path = await import('node:path');
  const a = process.argv.slice(2), opt = {}, files = [];
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--strict') opt.strict = true; else if (a[i].startsWith('--')) opt[a[i].slice(2)] = a[++i]; else files.push(a[i]);
  }
  if (!opt.blocks || !files.length) { console.error('사용법: node validate-code.mjs --blocks kit.blocks.json [--babel babel.min.js] [--policy policy.json] [--strict] file.ts ...'); process.exit(2); }
  const babelPath = opt.babel || ['bridge/sim/lib/babel.min.js', 'sim/lib/babel.min.js'].find(p => fs.existsSync(p));
  if (!babelPath) { console.error('--babel 경로를 주세요(@babel/standalone babel.min.js)'); process.exit(2); }
  const Babel = await loadBabel(babelPath);
  const blocks = JSON.parse(fs.readFileSync(opt.blocks, 'utf8'));
  const policy = opt.policy ? JSON.parse(fs.readFileSync(opt.policy, 'utf8')) : {};
  let bad = 0;
  for (const f of files) {
    const r = validateCode(fs.readFileSync(f, 'utf8'), blocks, { Babel, policy, strictPolicy: !!opt.strict });
    const tag = r.ok ? 'OK ' : 'ERR';
    console.log(`${tag} ${path.basename(f)}  오류 ${r.errors.length} · 경고 ${r.warnings.length}`);
    [...r.errors, ...r.warnings].forEach(x => console.log(`   ${x.code} ${x.line}행 ${x.msg}`));
    if (!r.ok) bad++;
  }
  process.exit(bad ? 1 : 0);
}
