// docs/*.md → bridge/docs/*.html (사이트에서 읽고 인쇄하는 수업 자료) + makecode/*.ts 복사
// 실행: node tools/build-docs.mjs   (docs를 고친 뒤 다시 실행하고 함께 커밋)
import fs from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = path.join(ROOT, 'docs'), OUT = path.join(ROOT, 'bridge', 'docs');
// 예전에 만든 파일이 남지 않게(이름이 바뀐 슬라이드 등) 복사 대상 폴더는 비우고 다시 만듦
fs.rmSync(path.join(OUT, 'makecode'), { recursive: true, force: true });
fs.rmSync(path.join(OUT, 'materials'), { recursive: true, force: true });
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
body{font-size:17px;line-height:1.75;--page-w:1100px}
.subnav{position:sticky;top:58px;z-index:10;background:color-mix(in srgb,var(--bg) 92%,transparent);backdrop-filter:blur(8px);border-bottom:1px solid var(--line)}
.subnav .in{max-width:1100px;margin:0 auto;padding:8px 16px;display:flex;gap:8px;align-items:center}
.subnav nav{display:flex;gap:6px;overflow-x:auto;flex:1;min-width:0;scrollbar-width:thin}
.subnav nav a{white-space:nowrap;text-decoration:none;font-size:14px;font-weight:600;padding:5px 12px;border-radius:999px;border:1px solid var(--line);color:var(--muted);background:var(--surface)}
.subnav nav a:hover{color:var(--ink);border-color:var(--line-strong)}
.subnav nav a[aria-current]{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}
.subnav button{font-size:14px;min-height:34px;padding:5px 12px;border-radius:999px;white-space:nowrap}
@media (max-width:720px){.subnav{top:0}}
main{max-width:900px;margin:0 auto;padding:24px 16px 60px}
h1{font-size:32px;line-height:1.3;margin:10px 0 18px;letter-spacing:-0.025em} h2{font-size:23px;margin:36px 0 10px;padding-top:6px;border-top:2px solid var(--line)} h3{font-size:19px;margin:24px 0 6px}
code{background:var(--code);border-radius:5px;padding:1px 6px;font-size:.88em;font-family:ui-monospace,Consolas,"D2Coding",monospace}
pre{background:var(--code);border-radius:10px;padding:12px 14px;overflow:auto;line-height:1.5} pre code{padding:0;background:none}
.tbl{overflow-x:auto;margin:12px 0} table{border-collapse:collapse;width:100%;font-size:15.5px;line-height:1.6;background:var(--card)}
th,td{border:1px solid var(--line);padding:7px 10px;vertical-align:top;text-align:left} th{background:var(--code)}
blockquote{margin:12px 0;padding:8px 14px;border-left:4px solid var(--accent);background:var(--card);border-radius:0 10px 10px 0}
li{margin:3px 0} img{max-width:100%} hr{border:0;border-top:1px solid var(--line);margin:28px 0}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px;margin:10px 0 26px}
.cards a{display:block;text-decoration:none;color:var(--ink);background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:16px 18px;box-shadow:var(--shadow-sm);transition:border-color .15s,box-shadow .2s,transform .2s}
.cards a:hover{border-color:var(--accent);box-shadow:var(--shadow-md);transform:translateY(-1px)} .cards b{display:block;font-size:18px} .cards span{display:block;color:var(--muted);font-size:14.5px;line-height:1.5;margin-top:4px}
.dl{columns:2 260px;padding-left:20px} .note{color:var(--muted);font-size:14.5px}
@media print { header,.subnav,.noprint{display:none} body{background:#fff;color:#000;font-size:12pt} main{max-width:none;padding:0} a{color:#000;text-decoration:none}
  h2{break-after:avoid} table,pre,blockquote{break-inside:avoid} th{background:#eee} code{background:#f2f2f2}
  pre{background:#fff;border:1px solid #999;font-size:12pt;line-height:2.1;white-space:pre-wrap}   /* 활동지: 글씨 쓸 칸 넉넉히 */ }
`;
const page = (title, active, body) => `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · 로보독 수업 자료</title>
<link rel="stylesheet" href="../assets/brand.css"><link rel="icon" href="../assets/favicon.svg" type="image/svg+xml"><style>${CSS}</style></head>
<body><header class="gnb"><div class="gnb-in">
<a class="brand" href="../"><svg aria-hidden="true" viewBox="0 0 32 32"><rect width="32" height="32" rx="9" fill="#2456e5"/><path d="M22.2 5.6a5.6 5.6 0 0 1 4.3 3.4" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round" opacity=".85"/><rect x="4.5" y="10.5" width="23" height="13" rx="6.5" fill="#fff"/><rect x="8" y="13.2" width="6.6" height="7.6" rx="2.2" fill="#111827"/><rect x="17.4" y="13.2" width="6.6" height="7.6" rx="2.2" fill="#111827"/><circle cx="11.3" cy="17" r="1.6" fill="#8fd8ff"/><circle cx="20.7" cy="17" r="1.6" fill="#8fd8ff"/></svg>
<span>로보독 AI 교실<small>코코아팹 협력 · 피지컬 AI 수업</small></span></a>
<nav aria-label="주 메뉴"><a href="../">처음</a><a href="../sim/">시뮬레이터</a><a href="../ai.html">AI 브리지</a><a href="./" aria-current="page">수업 자료</a></nav>
</div></header>
<div class="subnav"><div class="in"><nav aria-label="수업 자료 목록">${['index', ...docs.map(d => d.slug)].map(s => `<a href="${s}.html"${s === active ? ' aria-current="page"' : ''}>${s === 'index' ? '전체' : SHORT[s] || s}</a>`).join('')}</nav>
<button onclick="print()">🖨 인쇄</button></div></div>
<main>${body}</main>
<footer class="site-foot">빅아이 로보독은 코코아팹의 제품이며, 이 교육 자료는 코코아팹과 협력해 만들었습니다.</footer></body></html>`;

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
// 예제 설명: 첫 번째 '실제 글자가 있는' 주석 줄(=====, ----- 같은 장식 줄은 건너뜀), [..] 꼬리표는 떼고 번호 제목만
const firstComment = (src) => {
  for (const line of src.split('\n')) {
    const m = line.match(/^\/\/\s*(.*)$/); if (!m) continue;
    const t = m[1].trim();
    if (!t || !/[가-힣A-Za-z0-9]/.test(t)) continue;
    return t.replace(/^\[(?:로보독 마이크로비트|무선 확장)\]\s*/, '').replace(/^\[([^\]]*)\]\s*/, '$1 · ');
  }
  return '';
};
let idx = `<h1>수업 자료</h1><p class="note">로보독 + 마이크로비트 피지컬 AI 수업안·활동지·운영 가이드입니다. 각 문서는 [🖨 인쇄]로 종이나 PDF로 저장할 수 있어요.</p><div class="cards"><a href="../lessons/"><b>웹 슬라이드로 보기 →</b><span>수업 슬라이드를 브라우저에서 바로 보여 줘요 (교사 모드: 대본 표시)</span></a></div>`;
for (const [g, ids] of GROUPS) {
  idx += `<h2>${g}</h2><div class="cards">` + ids.map(id => docs.find(d => d.slug === id)).filter(Boolean)
    .map(d => `<a href="${d.slug}.html"><b>${esc(SHORT[d.slug] || d.title)}</b><span>${esc(d.title)}</span><span>${esc(blurb(d.md))}</span></a>`).join('') + '</div>';
}
// 수업 꾸러미(슬라이드·활동지·진행표·준비물) 복사 + 목록
const PKG = path.join(ROOT, 'materials');
const pkgs = fs.existsSync(PKG) ? fs.readdirSync(PKG).filter(d => fs.statSync(path.join(PKG, d)).isDirectory()) : [];
if (pkgs.length) {
  idx += `<h2>바로 쓰는 수업 꾸러미</h2><p class="note">수업 슬라이드(발표자 노트에 교사 대본), 학생 활동지, 교사용 진행표, 인쇄용 준비물(색 카드는 컬러 인쇄). 한글·파워포인트에서 열립니다.</p>`;
  for (const d of pkgs) {
    const files = fs.readdirSync(path.join(PKG, d)).filter(f => /\.(pptx|docx|pdf)$/.test(f)).sort((a, b) => (/pptx$/.test(b) - /pptx$/.test(a)) || a.localeCompare(b));
    if (!files.length) continue;
    fs.mkdirSync(path.join(OUT, 'materials', d), { recursive: true });
    files.forEach(f => fs.copyFileSync(path.join(PKG, d, f), path.join(OUT, 'materials', d, f)));
    idx += `<h3>${esc(d.replace(/_/g, ' '))}</h3><ul class="dl">` + files.map(f => `<li><a href="materials/${encodeURIComponent(d)}/${encodeURIComponent(f)}" download>${esc(f)}</a></li>`).join('') + '</ul>';
  }
}
idx += `<h2>MakeCode 예제 내려받기</h2><p class="note">파일을 내려받아 makecode.microbit.org → 가져오기, 또는 JavaScript 탭에 붙여넣으세요. 로보독 확장(kocoafab/robodog)이 필요합니다. 06~08은 무선 확장(kocoafab/robodog-radio)용입니다.</p><ul class="dl">`
  + tsFiles.map(f => { const first = firstComment(fs.readFileSync(path.join(ROOT, 'makecode', f), 'utf8')); return `<li><a href="makecode/${f}" download>${f}</a> <span class="note">${esc(first.slice(0, 60))}</span></li>`; }).join('') + '</ul>';
fs.writeFileSync(path.join(OUT, 'index.html'), page('수업 자료', 'index', idx));
console.log(`docs ${docs.length}개, 예제 ${tsFiles.length}개 → bridge/docs/`);
