// docs/*.md → bridge/docs/*.html (사이트에서 읽고 인쇄하는 수업 자료) + makecode/*.ts 복사
// 실행: node tools/build-docs.mjs   (docs를 고친 뒤 다시 실행하고 함께 커밋)
import fs from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = path.join(ROOT, 'docs'), OUT = path.join(ROOT, 'bridge', 'docs');
fs.mkdirSync(path.join(OUT, 'makecode'), { recursive: true });

const files = fs.readdirSync(SRC).filter(f => /^\d\d_.+\.md$/.test(f)).sort();
const slug = (f) => f.slice(0, 2);                       // 01_소개형_2차시.md → 01
const titleOf = (md) => (md.match(/^#\s+(.+)$/m) || [, ''])[1].replace(/[*`]/g, '').trim();
const docs = files.map(f => { const md = fs.readFileSync(path.join(SRC, f), 'utf8'); return { f, slug: slug(f), md, title: titleOf(md) }; });
const bySrc = new Map(docs.map(d => [d.f, d]));

// 예제 코드 복사
const tsFiles = fs.readdirSync(path.join(ROOT, 'makecode')).filter(f => f.endsWith('.ts')).sort();
for (const f of tsFiles) fs.copyFileSync(path.join(ROOT, 'makecode', f), path.join(OUT, 'makecode', f));

const esc = (s) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const GROUPS = [
  ['수업안', ['01', '02', '03', '06']],
  ['수업 준비·평가', ['04', '05', '08']],
  ['배경·검증', ['00', '07']],
];
const SHORT = { '00': '교안 분석', '01': '2차시 소개형', '02': '4차시 기본형', '03': '8차시 전체형', '04': '활동지·평가', '05': '운영 가이드', '06': '중·고 확장', '07': '검증 보고서', '08': '시뮬레이터 안내' };

function linkify(html) {
  // `docs/05_xxx.md`, `05_xxx.md` → 문서 링크 / `makecode/xx.ts` → 예제 내려받기
  html = html.replace(/<code>(?:docs\/)?(\d\d_[^<\s]+?\.md)<\/code>/g, (m, f) => bySrc.has(f) ? `<a href="${slug(f)}.html"><code>${esc(SHORT[slug(f)] || f)}</code></a>` : m);
  html = html.replace(/<code>makecode\/([\w.-]+\.ts)<\/code>/g, (m, f) => tsFiles.includes(f) ? `<a href="makecode/${f}" download><code>makecode/${f}</code></a>` : m);
  html = html.replace(/href="(?:\.\/)?(?:docs\/)?(\d\d_[^"#]+?\.md)(#[^"]*)?"/g, (m, f, h) => bySrc.has(decodeURIComponent(f)) ? `href="${slug(decodeURIComponent(f))}.html${h || ''}"` : m);
  html = html.replace(/href="(?:\.\.\/)?makecode\/([\w.-]+\.ts)"/g, 'href="makecode/$1"');
  html = html.replace(/<pre>/g, '<pre tabindex="0">');
  html = html.replace(/<table>/g, '<div class="tbl"><table>').replace(/<\/table>/g, '</table></div>');
  return html;
}

const CSS = `
:root { --bg:#f6f7fb; --card:#fff; --ink:#18202e; --muted:#566079; --line:#dde2ee; --accent:#2f6fe4; --accent-ink:#fff; --code:#eef1f7; --mark:#fff4c2; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg:#10141b; --card:#181d27; --ink:#e9edf5; --muted:#a3acc1; --line:#2b3242; --accent:#6b9bf5; --accent-ink:#0b0e14; --code:#222936; --mark:#4a3f12; } }
*{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--ink);font-family:"Pretendard","Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif;font-size:17px;line-height:1.75}
a{color:var(--accent)} header{position:sticky;top:0;z-index:5;background:var(--card);border-bottom:1px solid var(--line)}
.bar{max-width:1100px;margin:0 auto;padding:10px 16px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.bar .home{font-weight:800;text-decoration:none;color:var(--ink)} .bar nav{display:flex;gap:6px;overflow-x:auto;flex:1;min-width:0}
.bar nav a{white-space:nowrap;text-decoration:none;font-size:14px;padding:6px 10px;border-radius:999px;border:1px solid var(--line);color:var(--ink)}
.bar nav a[aria-current]{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}
.bar button{font:inherit;font-size:14px;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:999px;padding:6px 12px;cursor:pointer}
main{max-width:900px;margin:0 auto;padding:20px 16px 60px}
h1{font-size:30px;line-height:1.3;margin:10px 0 18px} h2{font-size:23px;margin:36px 0 10px;padding-top:6px;border-top:2px solid var(--line)} h3{font-size:19px;margin:24px 0 6px}
code{background:var(--code);border-radius:5px;padding:1px 6px;font-size:.88em;font-family:ui-monospace,Consolas,"D2Coding",monospace}
pre{background:var(--code);border-radius:10px;padding:12px 14px;overflow:auto;line-height:1.5} pre code{padding:0;background:none}
.tbl{overflow-x:auto;margin:12px 0} table{border-collapse:collapse;width:100%;font-size:15.5px;line-height:1.6;background:var(--card)}
th,td{border:1px solid var(--line);padding:7px 10px;vertical-align:top;text-align:left} th{background:var(--code)}
blockquote{margin:12px 0;padding:8px 14px;border-left:4px solid var(--accent);background:var(--card);border-radius:0 10px 10px 0}
li{margin:3px 0} img{max-width:100%} hr{border:0;border-top:1px solid var(--line);margin:28px 0}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px;margin:10px 0 26px}
.cards a{display:block;text-decoration:none;color:var(--ink);background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 16px}
.cards a:hover{border-color:var(--accent)} .cards b{display:block;font-size:18px} .cards span{display:block;color:var(--muted);font-size:14.5px;line-height:1.5;margin-top:4px}
.dl{columns:2 260px;padding-left:20px} .note{color:var(--muted);font-size:14.5px}
a:focus-visible,button:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
@media print { header,.noprint{display:none} body{background:#fff;color:#000;font-size:12pt} main{max-width:none;padding:0} a{color:#000;text-decoration:none}
  h2{break-after:avoid} table,pre,blockquote{break-inside:avoid} th{background:#eee} code{background:#f2f2f2}
  pre{background:#fff;border:1px solid #999;font-size:12pt;line-height:2.1;white-space:pre-wrap}   /* 활동지: 글씨 쓸 칸 넉넉히 */ }
`;
const page = (title, active, body) => `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · 로보독 수업 자료</title><style>${CSS}</style></head>
<body><header><div class="bar"><a class="home" href="../">🐶 로보독 AI 교실</a>
<nav aria-label="수업 자료">${['index', ...docs.map(d => d.slug)].map(s => `<a href="${s}.html"${s === active ? ' aria-current="page"' : ''}>${s === 'index' ? '전체' : SHORT[s] || s}</a>`).join('')}</nav>
<button onclick="print()">🖨 인쇄</button></div></header>
<main>${body}</main></body></html>`;

// 한국어 문서의 '5~6학년' 같은 물결표가 취소선(~글자~)으로 바뀌지 않게: 코드 밖의 홑 물결표를 문자로
// 또 **굵게** 가 괄호·기호 뒤 한글 앞에서 풀리지 않는 문제(마크다운 규칙)를 피하려고 <strong>으로 바꿈
const tilde = (md) => md.split(/(```[\s\S]*?```|`[^`\n]*`)/).map((part, i) => i % 2 ? part : part.replace(/~~|~/g, t => t === '~' ? '&#126;' : t).replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>')).join('');
let badLinks = 0;
for (const d of docs) {
  const html = page(d.title, d.slug, linkify(marked.parse(tilde(d.md))));
  // 주소 바로 뒤에 괄호·한글이 붙어 링크가 깨진 곳 찾기(예: (https://...)와) → md에서 <주소>로 감싸기
  for (const m of html.matchAll(/href="(https?:[^"]*)"/g)) if (/\)|%E[A-F]/i.test(m[1])) { badLinks++; console.warn(`⚠ ${d.f}: 깨진 링크 ${decodeURIComponent(m[1])}`); }
  fs.writeFileSync(path.join(OUT, `${d.slug}.html`), html);
}
if (badLinks) process.exitCode = 1;

const blurb = (md) => { const t = md.replace(/^#.*$/m, '').split('\n').map(l => l.replace(/^[-*>\s]+/, '').replace(/[*`#|]/g, '').trim()).filter(l => l && !/^-+$/.test(l))[0] || ''; return t.length > 90 ? t.slice(0, 88) + '…' : t; };
let idx = `<h1>수업 자료</h1><p class="note">로보독 + 마이크로비트 피지컬 AI 수업안·활동지·운영 가이드입니다. 각 문서는 [🖨 인쇄]로 종이나 PDF로 저장할 수 있어요.</p>`;
for (const [g, ids] of GROUPS) {
  idx += `<h2>${g}</h2><div class="cards">` + ids.map(id => docs.find(d => d.slug === id)).filter(Boolean)
    .map(d => `<a href="${d.slug}.html"><b>${esc(SHORT[d.slug] || d.title)}</b><span>${esc(d.title)}</span><span>${esc(blurb(d.md))}</span></a>`).join('') + '</div>';
}
idx += `<h2>MakeCode 예제 내려받기</h2><p class="note">파일을 내려받아 makecode.microbit.org → 가져오기, 또는 JavaScript 탭에 붙여넣으세요. 로보독 확장(kocoafab/robodog)이 필요합니다. 06~08은 무선 확장(kocoafab/robodog-radio)용입니다.</p><ul class="dl">`
  + tsFiles.map(f => { const first = (fs.readFileSync(path.join(ROOT, 'makecode', f), 'utf8').match(/^\/\/\s*(.+)$/m) || [, ''])[1]; return `<li><a href="makecode/${f}" download>${f}</a> <span class="note">${esc(first.slice(0, 60))}</span></li>`; }).join('') + '</ul>';
fs.writeFileSync(path.join(OUT, 'index.html'), page('수업 자료', 'index', idx));
console.log(`docs ${docs.length}개, 예제 ${tsFiles.length}개 → bridge/docs/`);
