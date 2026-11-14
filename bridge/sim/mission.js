// 미션 모드(?mission=<id>): 예상 고르기 → 실행 → 로봇 '행동'으로 자동 확인 → 3단계 도움말 → 배운 점.
// 코드 글자를 검사하지 않는다 — 시뮬레이터 로봇의 위치·방향·멈춤을 매 프레임 재서 판정한다(추정 모델, 실물 확인은 따로).
// 통과 기록은 이 브라우저에만 저장(localStorage 'pai:mission:<id>'). 수업 슬라이드의 mission 장이 같은 키를 읽는다.
const RAD = Math.PI / 180;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const missionKey = (id) => 'pai:mission:' + id;

export function attachMission(mission, ctx) {
  const { robot, runner, host, applyCode, backUrl } = ctx;
  // ---- 측정
  let m = null, prevRun = false, lastT = performance.now(), passed = false, hintN = 0, picked = null;
  const fresh = () => ({ pressed: { A: false, B: false }, x0: robot.x, y0: robot.y, h0: robot.heading, forward: 0, side: 0, maxForward: 0, maxSide: 0, minSide: 0, path: 0, headDev: 0, moved: false, still: 0, home: 0, bumped: false, px: robot.x, py: robot.y,
    t: 0, tA: -1, dist: 500, minDist: 500,                       // 실행 뒤 지난 초, A 버튼 뒤 지난 초, 앞 물체까지 참 거리(cm, 없으면 500)
    radio: {}, lastRadio: null, sinceRadio: -1, seg: {}, cur: null });   // 받은 라디오 숫자별 횟수, 마지막 숫자, 그 뒤 지난 초, 숫자별 '받은 뒤 움직인 만큼'
  m = fresh();
  const origPress = runner.press.bind(runner);
  runner.press = (btn) => { if (runner.running && m) { if (btn === 'AB') m.pressed.A = m.pressed.B = true; else m.pressed[btn] = true; if (btn !== 'B' && m.tA < 0) m.tA = 0; } return origPress(btn); };
  const origRadio = runner.radioReceive.bind(runner);
  runner.radioReceive = (n) => {
    if (runner.running && m) { m.radio[n] = (m.radio[n] || 0) + 1; m.lastRadio = n; m.sinceRadio = 0; m.seg[n] = { x: robot.x, y: robot.y, dx: 0, dy: 0, moved: false, done: false }; m.cur = n; }
    return origRadio(n);
  };
  function sample(now) {
    const dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
    if (runner.running && !prevRun) { m = fresh(); if (!passed) setResult(''); }
    prevRun = runner.running;
    const dx = robot.x - m.x0, dy = robot.y - m.y0, h = m.h0 * RAD;
    m.forward = dx * Math.sin(h) - dy * Math.cos(h); m.side = dx * Math.cos(h) + dy * Math.sin(h);
    m.maxForward = Math.max(m.maxForward, m.forward); m.maxSide = Math.max(m.maxSide, m.side); m.minSide = Math.min(m.minSide, m.side);
    const step = Math.hypot(robot.x - m.px, robot.y - m.py); m.px = robot.x; m.py = robot.y;
    if (step < 30) m.path += step;   // [처음으로]로 순간 이동한 것은 세지 않음
    let dh = ((robot.heading - m.h0) % 360 + 540) % 360 - 180; m.headDev = Math.max(m.headDev, Math.abs(dh));
    const moving = robot.pwm.some((v) => v !== 0) || step / Math.max(dt, 1e-3) > 0.5;
    if (moving) { m.moved = true; m.still = 0; } else if (m.moved) m.still += dt;
    m.home = Math.hypot(dx, dy); if (robot.bumped) m.bumped = true;
    if (runner.running) { m.t += dt; if (m.tA >= 0) m.tA += dt; if (m.sinceRadio >= 0) m.sinceRadio += dt; }
    const d = robot.sonarTrue(); m.dist = isFinite(d) ? d : 500; m.minDist = Math.min(m.minDist, m.dist);
    const sg = m.cur !== null ? m.seg[m.cur] : null;
    if (sg && !sg.done) { sg.dx = robot.x - sg.x; sg.dy = robot.y - sg.y; if (moving) sg.moved = true; else if (sg.moved && m.still >= 0.7) sg.done = true; }
    render();
    requestAnimationFrame(sample);
  }
  // ---- 화면
  const box = document.createElement('section'); box.id = 'missionBox'; box.className = 'mission'; box.setAttribute('aria-label', '미션');
  const p = mission.predict;
  box.innerHTML = `
    <div class="m-head"><span class="m-tag">${mission.star ? '도전' : '미션'}</span><h2>${esc(mission.title)}</h2>${backUrl ? `<a class="m-back" href="${esc(backUrl)}">← 슬라이드로</a>` : ''}</div>
    ${mission.story ? `<p class="m-story">${esc(mission.story)}</p>` : ''}
    <p class="m-goal"><b>목표</b> ${esc(mission.goal)}</p>
    <fieldset class="m-predict"><legend>① 먼저 예상해요 — ${esc(p.q)}</legend>
      ${p.choices.map((c, i) => `<label><input type="radio" name="mpredict" value="${i}"> ${esc(c)}</label>`).join('')}
      <p class="m-pmsg" id="mPredictMsg" aria-live="polite"></p></fieldset>
    <div class="m-checks"><b>② 실행하고 확인해요</b> <span class="note" style="margin:0">${esc(mission.how || '▶ 실행을 누른 뒤 오른쪽 A 버튼')} · 로봇이 한 일로 자동 확인</span>
      <ul id="mChecks">${mission.checks.map((c, i) => `<li data-i="${i}"><span class="m-ic" aria-hidden="true">○</span> <span>${esc(c.label)}</span> <small></small></li>`).join('')}</ul></div>
    <div class="m-foot"><button type="button" id="mHint">💡 도움말 (0/3)</button><button type="button" id="mReset">미션 코드로 되돌리기</button><span class="est" id="mSim">시뮬레이터 판정 · 실물 확인은 따로</span></div>
    <ol class="m-hints" id="mHints" aria-live="polite"></ol>
    <div class="m-result" id="mResult" aria-live="polite" hidden></div>`;
  host.prepend(box);
  const $ = (id) => box.querySelector('#' + id);
  const lis = [...box.querySelectorAll('#mChecks li')];
  function render() {
    let all = true;
    mission.checks.forEach((c, i) => {
      const ok = !!c.test(m); all = all && ok;
      const li = lis[i], ic = li.firstElementChild;
      if (li.dataset.ok !== String(ok)) { li.dataset.ok = String(ok); ic.textContent = ok ? '✓' : '○'; li.classList.toggle('ok', ok); }
      const t = c.now ? c.now(m) : ''; const sm = li.lastElementChild; if (sm.textContent !== t) sm.textContent = t;
    });
    if (all && !passed && runner.running) pass();
  }
  function setResult(html, cls) { const r = $('mResult'); r.hidden = !html; r.className = 'm-result ' + (cls || ''); r.innerHTML = html; }
  function pass() {
    passed = true;
    const right = picked === null ? null : picked === p.answer;
    try { localStorage.setItem(missionKey(mission.id), JSON.stringify({ pass: true, predict: picked, predictRight: right, hints: hintN, t: Date.now() })); } catch (e) { /* 저장 못 해도 진행 */ }
    setResult(`<b>🎉 통과!</b> ${esc(mission.learn)}<br><span class="m-real">🔧 실물로 다시 확인: ${esc(mission.real)}</span>${backUrl ? `<br><a class="m-go" href="${esc(backUrl)}">슬라이드로 돌아가기 →</a>` : ''}`, 'ok');
    box.classList.add('passed');
  }
  box.querySelectorAll('input[name=mpredict]').forEach((r) => r.addEventListener('change', () => {
    picked = +r.value; box.querySelectorAll('input[name=mpredict]').forEach((x) => { x.disabled = true; });
    $('mPredictMsg').textContent = '예상을 골랐어요. 이제 ▶ 실행하고 A 버튼을 눌러 직접 확인해요.';
    box.classList.add('predicted'); revealPredict();
  }));
  // 예상 결과는 처음 한 번 실행해 본 뒤(로봇이 움직인 뒤)에 알려 줌
  let told = false;
  function revealPredict() { if (told || picked === null || !m.moved) return; told = true; $('mPredictMsg').innerHTML = (picked === p.answer ? '<b>예상이 맞았어요!</b> ' : `<b>예상과 달랐어요.</b> 실제로는 "${esc(p.choices[p.answer])}" — `) + esc(p.why); }
  setInterval(revealPredict, 400);
  $('mHint').onclick = () => {
    if (hintN >= mission.hints.length) return;
    const li = document.createElement('li'); li.textContent = mission.hints[hintN++]; $('mHints').appendChild(li);
    $('mHint').textContent = `💡 도움말 (${hintN}/${mission.hints.length})`; if (hintN >= mission.hints.length) $('mHint').disabled = true;
  };
  $('mReset').onclick = () => { if (confirm('미션 처음 코드로 되돌릴까요? 지금 고친 코드는 사라져요.')) applyCode(mission.code); };
  window.__noAutoSetup = !!mission.noAuto;   // 빈 바닥 미션: 코드가 거리를 읽어도 상자를 자동으로 놓지 않음
  requestAnimationFrame(sample);
  return { get metrics() { return m; }, get passed() { return passed; }, mission };
}
