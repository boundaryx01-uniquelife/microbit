// 소개 영상 소리(기본 꺼짐): Web Audio로 만든 잔잔한 배경음 + 효과음, Web Speech로 자막 읽어 주기.
// 외부 소리 파일 없음. 지원하지 않는 기기에서는 supported가 false이고 모든 함수가 조용히 아무 일도 하지 않음.
export function createAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  const speech = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  const api = { supported: !!AC, speech, on: false, enable, disable, toggle, sfx, speak, stopSpeak, pause, resume };
  let ctx = null, master = null, musicBus = null, timer = 0, nextT = 0, step = 0, paused = false, voice = null;

  const CH = [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]];   // C, Am, F, G 느낌 (반음 간격)
  const PENT = [0, 2, 4, 7, 9, 12, 14, 16];
  const hz = (semi) => 261.63 * Math.pow(2, semi / 12);

  function tone(f, t0, dur, { type = 'sine', vol = 0.2, bus = master, a = 0.01, glide = 0 } = {}) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t0);
    if (glide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f * glide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(bus); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function noise(t0, dur, { f0 = 800, f1 = 3000, vol = 0.15 } = {}) {
    const n = Math.floor(ctx.sampleRate * dur), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const s = ctx.createBufferSource(); s.buffer = b;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2; bp.frequency.setValueAtTime(f0, t0); bp.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(bp); bp.connect(g); g.connect(master); s.start(t0); s.stop(t0 + dur);
  }
  function music() {   // 앞으로 0.6초 분량을 미리 예약
    if (!ctx || paused) return;
    const beat = 0.6;
    while (nextT < ctx.currentTime + 0.6) {
      const bar = Math.floor(step / 4) % 4, k = step % 4, ch = CH[bar];
      if (k === 0) ch.forEach((s, i) => tone(hz(s - 12), nextT, beat * 4.2, { type: 'sine', vol: 0.05, bus: musicBus, a: 0.4 }));
      const n = PENT[(step * 3 + bar * 2) % PENT.length] + (ch[0] > -4 ? 0 : -3);
      if ((step % 2 === 0) || k === 3) tone(hz(ch[k % 3] + 12 + (k === 3 ? 7 : 0)), nextT, beat * 1.6, { type: 'triangle', vol: 0.06, bus: musicBus, a: 0.02 });
      void n;
      nextT += beat; step++;
    }
  }
  function enable() {
    if (!AC) return false;
    try {
      if (!ctx) {
        ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
        musicBus = ctx.createGain(); musicBus.gain.value = 0.9; musicBus.connect(lp); lp.connect(master);
      }
      ctx.resume && ctx.resume();
      api.on = true; paused = false; nextT = ctx.currentTime + 0.1; step = 0;
      clearInterval(timer); timer = setInterval(music, 150); music();
      sfx('pop');
      return true;
    } catch (e) { api.on = false; return false; }
  }
  function disable() {
    api.on = false; clearInterval(timer); stopSpeak();
    if (ctx) try { ctx.suspend(); } catch (e) {}
  }
  function toggle() { api.on ? disable() : enable(); return api.on; }
  function pause() { paused = true; if (ctx && api.on) try { ctx.suspend(); } catch (e) {} if (speech) try { speechSynthesis.pause(); } catch (e) {} }
  function resume() {
    paused = false;
    if (ctx && api.on) { try { ctx.resume(); } catch (e) {} nextT = Math.max(nextT, ctx.currentTime + 0.05); }
    if (speech) try { speechSynthesis.resume(); } catch (e) {}
  }
  function sfx(name) {
    if (!ctx || !api.on || paused) return;
    const t = ctx.currentTime + 0.01;
    try {
      switch (name) {
        case 'pop': tone(520, t, 0.14, { type: 'sine', vol: 0.22, glide: 1.8 }); break;
        case 'question': tone(480, t, 0.18, { type: 'triangle', vol: 0.2 }); tone(560, t + 0.2, 0.18, { type: 'triangle', vol: 0.2 }); tone(740, t + 0.4, 0.3, { type: 'triangle', vol: 0.2, glide: 1.25 }); break;
        case 'shutter': noise(t, 0.09, { f0: 3000, f1: 6000, vol: 0.12 }); tone(1800, t, 0.05, { type: 'square', vol: 0.04 }); break;
        case 'whoosh': noise(t, 0.4, { f0: 500, f1: 2600, vol: 0.1 }); break;
        case 'tick': tone(880 + Math.random() * 200, t, 0.12, { type: 'sine', vol: 0.15 }); break;
        case 'ding': [784, 988, 1319].forEach((f, i) => tone(f, t + i * 0.11, 0.5, { type: 'sine', vol: 0.2 })); break;
        case 'radio': [0, 0.13, 0.26].forEach((d, i) => tone(1100 + i * 220, t + d, 0.09, { type: 'square', vol: 0.06 })); break;
        case 'wake': tone(330, t, 0.3, { type: 'triangle', vol: 0.18, glide: 2 }); break;
        case 'tada': [523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * 0.09, 0.9, { type: 'triangle', vol: 0.16 })); break;
        case 'bark': tone(420, t, 0.12, { type: 'sawtooth', vol: 0.07, glide: 0.6 }); tone(420, t + 0.18, 0.12, { type: 'sawtooth', vol: 0.07, glide: 0.6 }); break;
      }
    } catch (e) {}
  }
  function pickVoice() {
    try {
      const vs = speechSynthesis.getVoices();
      voice = vs.find(v => /^ko/i.test(v.lang)) || null;
    } catch (e) {}
  }
  if (speech) { pickVoice(); try { speechSynthesis.addEventListener('voiceschanged', pickVoice); } catch (e) {} }
  function speak(text) {
    if (!speech || !api.on || paused) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(String(text).replace(/["“”]/g, ''));
      u.lang = 'ko-KR'; if (voice) u.voice = voice; u.rate = 1.0; u.pitch = 1.1; u.volume = 1;
      speechSynthesis.speak(u);
    } catch (e) {}
  }
  function stopSpeak() { if (speech) try { speechSynthesis.cancel(); } catch (e) {} }
  return api;
}
