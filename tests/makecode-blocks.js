// MakeCode 웹 편집기에서 확장 추가 → JS 붙여넣기 → 블록 변환 확인
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = __dirname + '/mc';
fs.mkdirSync(OUT, { recursive: true });
const file = process.argv[2];
const needExt = process.argv[3] === 'ext';
const name = require('path').basename(file, '.ts');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const shot = (s) => p.screenshot({ path: `${OUT}/${name}_${s}.png` });
  await p.goto('https://makecode.microbit.org/?lang=ko#editor', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await p.waitForSelector('#blocksEditor, .blocklySvg', { timeout: 120000 });
  await p.waitForTimeout(4000);
  // 닫을 수 있는 대화상자 닫기
  for (const sel of ['button:has-text("닫기")', 'button:has-text("Close")', '.closeIcon']) {
    const el = await p.$(sel); if (el) { try { await el.click({ timeout: 2000 }); } catch (e) {} }
  }
  if (needExt) {
    // 확장 추가: 설정(톱니) 메뉴 → 확장
    await p.click('[data-ns="addpackage"]', { timeout: 20000 });
    await p.waitForTimeout(3000);
    await shot('ext_dialog');
    const search = await p.waitForSelector('input[placeholder*="검색"]', { timeout: 30000 });
    const inp = p.locator('.extensions-browser input').first();
    console.log('inputs:', await p.locator('.extensions-browser input').count());
    await inp.fill('kocoafab/robodog');
    console.log('value:', await inp.inputValue());
    await inp.press('Enter');
    await p.waitForTimeout(10000);
    await shot('ext_search');
    const card = p.locator('.extensions-browser .common-card, .extensions-browser [class*="card"]').filter({ hasText: /robodog/i }).first();
    if (!(await card.count())) { console.log('RESULT ext card not found'); await b.close(); return; }
    console.log('card text:', (await card.innerText()).replace(/\n/g, ' ').slice(0, 80));
    await card.click();
    await p.waitForTimeout(12000);
    await shot('ext_added');
  }
  // JavaScript 탭으로 전환
  await p.click('div.javascript-menuitem', { timeout: 20000 });
  await p.waitForTimeout(4000);
  const code = fs.readFileSync(file, 'utf8');
  await p.evaluate((c) => {
    const ed = window.monaco && window.monaco.editor.getModels()[0];
    if (ed) ed.setValue(c);
  }, code);
  await p.waitForTimeout(5000);
  // 에러 표시 개수
  const markers = await p.evaluate(() => window.monaco ? window.monaco.editor.getModelMarkers({}).filter(m => m.severity >= 8).map(m => `${m.startLineNumber}: ${m.message}`) : ['no monaco']);
  await shot('js');
  // 블록 탭으로 전환
  await p.click('div.blocks-menuitem', { timeout: 20000 });
  await p.waitForTimeout(6000);
  await shot('blocks');
  const dialog = await p.$('.ui.modal.visible, .ui.dimmer.visible .modal');
  const dialogText = dialog ? (await dialog.innerText()).slice(0, 300) : '';
  const blockCount = await p.evaluate(() => document.querySelectorAll('.blocklyDraggable').length);
  const ws = await p.evaluate(() => {
    // 변환 안 된 코드는 원문 텍스트(robodog., deflib., radio., =, ;)가 블록 글자로 남음
    const texts = Array.from(document.querySelectorAll('.blocklyText')).map(t => t.textContent);
    const raw = texts.filter(t => /robodog\.|deflib\.|radio\.|basic\.|input\.|serial\.|;|=>/.test(t));
    return { textItems: texts.length, rawCodeTexts: raw.slice(0, 5) };
  });
  console.log(JSON.stringify({ name, jsErrors: markers, dialog: dialogText, blockCount, ws }, null, 1));
  await b.close();
})().catch(e => { console.log('FAIL', e.message); process.exit(1); });
