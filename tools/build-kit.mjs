#!/usr/bin/env node
// 교구별 첫 화면: kits/<slug>/kit.json → bridge/<slug>/index.html + 예제(.ts)·수업 꾸러미 복사
// 사용법: node tools/build-kit.mjs [slug]   (slug 없으면 kits/ 아래 전부)
// 로보독은 기존 bridge/robodog/index.html·sim/·docs/ 를 그대로 쓴다(page=false).
// 마지막에 모든 kit.json 의 hub 항목으로 사이트 메인(bridge/index.html, 교구 선택 화면)을 만든다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KITS = path.join(ROOT, 'kits');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const firstTitle = (src) => {
  for (const line of src.split('\n')) {
    const m = line.match(/^\/\/\s*(.*)$/); if (!m) continue;
    const t = m[1].trim();
    if (!t || !/[가-힣A-Za-z0-9]/.test(t)) continue;
    return t.replace(/^\[[^\]]*\]\s*/, '');
  }
  return '';
};

const ALL = fs.readdirSync(KITS).filter((d) => fs.existsSync(path.join(KITS, d, 'kit.json')))
  .map((d) => JSON.parse(fs.readFileSync(path.join(KITS, d, 'kit.json'), 'utf8')));
const slugs = process.argv[2] ? [process.argv[2]] : ALL.filter((k) => k.page).map((k) => k.slug);
for (const slug of slugs) {
  const kit = ALL.find((k) => k.slug === slug);
  if (!kit || !kit.page) { console.warn(`⚠ ${slug}: page=true 인 교구만 첫 화면을 만듦`); continue; }
  const OUT = path.join(ROOT, 'bridge', slug);
  fs.rmSync(path.join(OUT, 'makecode'), { recursive: true, force: true });
  fs.rmSync(path.join(OUT, 'materials'), { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT, 'makecode'), { recursive: true });

  // 예제: 교구 예제 + 공용 USB 수신기
  const exDir = path.join(KITS, slug, 'makecode');
  const examples = [{ f: '00_bridge-receiver.ts', src: path.join(ROOT, 'makecode', '00_bridge-receiver.ts'), shared: true }]
    .concat(fs.readdirSync(exDir).filter((f) => f.endsWith('.ts')).sort().map((f) => ({ f, src: path.join(exDir, f) })));
  for (const e of examples) fs.copyFileSync(e.src, path.join(OUT, 'makecode', e.f));
  const exList = examples.map((e) => {
    const t = e.shared ? 'USB 마이크로비트(컴퓨터에 꽂는 것) — 확장 없이' : firstTitle(fs.readFileSync(e.src, 'utf8'));
    return `<li><a href="makecode/${e.f}" download>${e.f}</a> <span class="note">${esc(t)}</span></li>`;
  }).join('');

  // 수업 꾸러미
  let pkgHtml = '';
  for (const d of kit.materials || []) {
    const dir = path.join(ROOT, 'materials', d);
    if (!fs.existsSync(dir)) { console.warn(`⚠ ${slug}: materials/${d} 없음`); continue; }
    const files = fs.readdirSync(dir).filter((f) => /\.(pptx|docx|pdf)$/.test(f)).sort();
    if (!files.length) continue;
    fs.mkdirSync(path.join(OUT, 'materials', d), { recursive: true });
    files.forEach((f) => fs.copyFileSync(path.join(dir, f), path.join(OUT, 'materials', d, f)));
    pkgHtml += `<h3>${esc(d.replace(/_/g, ' '))}</h3><ul class="dl">` + files.map((f) => `<li><a href="materials/${encodeURIComponent(d)}/${encodeURIComponent(f)}" download>${esc(f)}</a></li>`).join('') + '</ul>';
  }
  const lessons = (kit.lessons || []).map((l) => `<a href="${esc(l.href)}"><b>${esc(l.title)}</b><span>웹 슬라이드 (교사 모드: 대본 표시)</span></a>`).join('');
  const ext = kit.extensions.basic;
  const unverified = (kit.unverified || []).map((u) => `<li>${esc(u)}</li>`).join('');

  const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(kit.name.replace(/^AI /, ""))} AI 교실 · 수업 자료</title>
<meta name="description" content="${esc(kit.name)} × 마이크로비트 피지컬 AI 수업: 웹캠 AI 브리지, MakeCode 예제, 수업 꾸러미">
<link rel="stylesheet" href="../assets/brand.css"><link rel="icon" href="../assets/favicon.svg" type="image/svg+xml">
<style>
main{max-width:960px;margin:0 auto;padding:24px 16px 48px}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;margin:12px 0}
.cards a{display:flex;flex-direction:column;gap:4px;padding:16px;border-radius:12px;background:var(--surface,#fff);border:1px solid var(--line,#e3e7ef);text-decoration:none;color:inherit}
.cards a b{color:var(--accent,#2456E5);font-size:18px}
.note{color:var(--sub,#566077);font-size:14px}
ul.dl li{margin:6px 0}
.warnbox{border-left:4px solid #F2B300;background:#fff8e1;padding:12px 16px;border-radius:8px;color:#111827}
code{word-break:break-all}
</style></head>
<body><header class="gnb"><div class="gnb-in">
<a class="brand" href="./"><span>${esc(kit.name.replace(/^AI /, ''))} AI 교실<small>피지컬 AI 수업</small></span></a>
<nav aria-label="주 메뉴"><a href="./" aria-current="page">처음</a><a href="../ai.html?kit=${slug}">AI 브리지</a><a href="../">전체 교구</a></nav>
</div></header>
<main>
<h1>${esc(kit.name)} × 마이크로비트 AI 교실</h1>
<p class="note">카드를 웹캠으로 AI에게 가르치고 → 인식한 번호를 USB 마이크로비트가 라디오로 보내고 → ${esc(kit.name)}에 꽂은 마이크로비트가 받아 움직입니다.</p>
<div class="cards">
<a href="../ai.html?kit=${slug}"><b>AI 브리지 열기 →</b><span>크롬·엣지에서 웹캠 + USB 마이크로비트 연결</span></a>
${lessons}
</div>

<h2>수업 꾸러미</h2>
${pkgHtml || '<p class="note">준비 중입니다.</p>'}

<h2>MakeCode 예제 내려받기</h2>
<p class="note">makecode.microbit.org → 새 프로젝트 → 확장에 <code>https://github.com/${esc(ext.repo)}</code> 입력해 추가 → 내려받은 파일을 가져오기(또는 JavaScript 탭에 붙여넣기). <b>00_bridge-receiver</b>는 컴퓨터에 꽂는 마이크로비트용이라 확장이 필요 없습니다.</p>
<ul class="dl">${exList}</ul>

<h2>수업 전 꼭 확인할 것 (실물 미검증)</h2>
<div class="warnbox"><p>아래는 확장 코드로만 확인했고 실물로는 아직 확인하지 않았습니다. 수업 전에 선생님이 직접 확인해 주세요.</p><ul>${unverified}</ul>
<p>속도·가까움 기준 같은 값은 예시입니다(예제 기본 속도 ${esc(kit.policy.exampleSpeed)}, 범위 0~255). 교실 환경에 맞게 선생님이 정해 주세요.</p></div>
</main>
<footer class="site-foot">${esc(kit.name)}${esc(kit.josaEun || "은(는)")} ${esc(kit.vendor)}의 제품입니다. 확장 블록: ${esc(ext.repo)} (${esc(ext.license)}) · <a href="../NOTICE.md">오픈소스·출처 고지</a></footer>
</body></html>`;
  fs.writeFileSync(path.join(OUT, 'index.html'), html);
  console.log(`${slug}: bridge/${slug}/index.html, 예제 ${examples.length}개, 꾸러미 ${(kit.materials || []).length}개`);
}

// ---------- 사이트 메인: 교구 선택 화면 ----------
const hubKits = ALL.filter((k) => k.hub).sort((a, b) => a.hub.order - b.hub.order);
const card = (k) => {
  const h = k.hub, ready = h.status === 'ready';
  const links = (h.links || []).map(([t, u], i) => `<a href="${esc(u)}"${i === 0 ? ' class="go"' : ''}>${esc(t)}</a>`).join('');
  return `<article class="kit${ready ? '' : ' coming'}">
  <div class="pic">${h.image ? `<img src="${esc(h.image)}" alt="${esc(h.imageAlt || '')}" loading="lazy">` : ''}</div>
  <div class="body"><span class="badge${ready ? '' : ' wait'}">${esc(h.badge || (ready ? '' : '준비 중'))}</span>
  <h2>${ready ? `<a href="${esc(h.home)}">${esc(k.name)}</a>` : esc(k.name)}</h2>
  <p class="vendor">${esc(k.vendor)}</p><p>${esc(h.tagline)}</p>
  ${links ? `<nav class="links" aria-label="${esc(k.name)} 바로 가기">${links}</nav>` : '<p class="note">자료가 준비되면 이곳에 열려요.</p>'}</div>
</article>`;
};
const hub = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>피지컬 AI 교실 · 마이크로비트 교구 선택</title>
<meta name="description" content="웹캠으로 AI를 가르치고 마이크로비트로 로봇을 움직이는 피지컬 AI 수업. 교구를 골라 시작하세요.">
<meta name="theme-color" content="#0a2342">
<meta property="og:type" content="website"><meta property="og:locale" content="ko_KR">
<meta property="og:title" content="피지컬 AI 교실 · 마이크로비트 교구 선택">
<meta property="og:description" content="AI가 보고, 마이크로비트가 전하고, 로봇이 움직인다 — 교구별 수업 자료·AI 브리지·예제">
<meta property="og:url" content="https://microbit-bridge.netlify.app/">
<link rel="stylesheet" href="assets/brand.css"><link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
<style>
body{background:var(--bg,#F4F6FA)}
main{max-width:1100px;margin:0 auto;padding:28px 16px 56px}
.hero h1{font-size:clamp(26px,4.4vw,40px);line-height:1.25;margin:4px 0 10px}
.hero h1 em{font-style:normal;color:var(--accent,#2456E5)}
.hero p{color:var(--sub,#566077);max-width:720px;margin:0 0 6px}
.flow{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0 26px;padding:0;list-style:none}
.flow li{background:var(--surface,#fff);border:1px solid var(--line,#e3e7ef);border-radius:999px;padding:6px 14px;font-size:14px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px}
.kit{display:flex;flex-direction:column;background:var(--surface,#fff);border:1px solid var(--line,#e3e7ef);border-radius:18px;overflow:hidden}
.kit .pic{position:relative;aspect-ratio:16/9;background:#0a2342;overflow:hidden}
.kit .pic img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.kit .pic img[src*="icon_"]{object-fit:contain;padding:14px;box-sizing:border-box;background:#eef3ff}
.kit .body{padding:16px 18px 18px;display:flex;flex-direction:column;gap:6px;flex:1}
.kit h2{margin:2px 0 0;font-size:22px}.kit h2 a{color:inherit;text-decoration:none}.kit h2 a:hover{color:var(--accent,#2456E5)}
.kit p{margin:0}.vendor{color:var(--sub,#566077);font-size:14px}
.badge{align-self:flex-start;font-size:12px;font-weight:700;padding:3px 10px;border-radius:999px;background:#e6edfd;color:#1b3fb0}
.badge.wait{background:#fff3cd;color:#7a5b00}
.links{display:flex;flex-wrap:wrap;gap:8px;margin-top:auto;padding-top:10px}
.links a{padding:8px 12px;border-radius:10px;border:1px solid var(--line,#e3e7ef);text-decoration:none;color:var(--ink,#111827);font-size:15px}
.links a.go{background:var(--accent,#2456E5);border-color:transparent;color:#fff;font-weight:700}
.links a:hover{border-color:var(--accent,#2456E5)}
.kit.coming{opacity:.85}.kit.coming .pic{filter:grayscale(.6)}
.note{color:var(--sub,#566077);font-size:14px;margin-top:auto!important;padding-top:10px}
.links a:focus-visible,.kit h2 a:focus-visible{outline:3px solid var(--accent,#2456E5);outline-offset:2px}
</style></head>
<body><header class="gnb"><div class="gnb-in">
<a class="brand" href="./"><span>피지컬 AI 교실<small>마이크로비트 × 로봇 교구</small></span></a>
<nav aria-label="주 메뉴"><a href="./" aria-current="page">교구 선택</a><a href="ai.html">AI 브리지</a><a href="lessons/">수업 슬라이드</a></nav>
</div></header>
<main>
<section class="hero"><h1>내가 가르친 <em>AI</em>로 로봇을 움직여요</h1>
<p>웹캠으로 카드·물건을 AI에게 가르치고, 인식한 번호를 마이크로비트가 라디오로 전해 로봇이 움직입니다. 수업에 쓰는 교구를 골라 시작하세요.</p>
<ol class="flow" aria-label="수업 흐름"><li>① 문제 찾기</li><li>② AI 가르치기</li><li>③ 마이크로비트로 전달</li><li>④ 로봇 움직이기</li><li>⑤ 안전 점검</li></ol></section>
<div class="grid">
${hubKits.map(card).join('\n')}
</div>
</main>
<footer class="site-foot">${hubKits.filter((k) => k.hub.status === 'ready').map((k) => `${esc(k.name)}${esc(k.josaEun || "은(는)")} ${esc(k.vendor)}의 제품입니다.`).join(' ')} · <a href="NOTICE.md">오픈소스·출처 고지</a></footer>
</body></html>
`;
fs.writeFileSync(path.join(ROOT, 'bridge', 'index.html'), hub);
console.log(`메인: bridge/index.html, 교구 ${hubKits.length}개 (${hubKits.map((k) => k.slug + ':' + k.hub.status).join(', ')})`);
