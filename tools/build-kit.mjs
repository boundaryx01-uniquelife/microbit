#!/usr/bin/env node
// 교구별 첫 화면: kits/<slug>/kit.json → bridge/<slug>/index.html + 예제(.ts)·수업 꾸러미 복사
// 사용법: node tools/build-kit.mjs [slug]   (slug 없으면 kits/ 아래 전부)
// 기본 교구(로보독)는 기존 bridge/index.html·docs/ 를 그대로 쓰므로 여기서 만들지 않는다.
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

const slugs = process.argv[2] ? [process.argv[2]] : fs.readdirSync(KITS).filter((d) => fs.existsSync(path.join(KITS, d, 'kit.json')));
for (const slug of slugs) {
  const kit = JSON.parse(fs.readFileSync(path.join(KITS, slug, 'kit.json'), 'utf8'));
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
<nav aria-label="주 메뉴"><a href="./" aria-current="page">처음</a><a href="../ai.html?kit=${slug}">AI 브리지</a><a href="../">다른 교구(로보독)</a></nav>
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
