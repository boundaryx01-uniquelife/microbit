// 코드 → 이 코드를 시험하는 데 필요한 장치·기물
// 시뮬레이터는 이 목록으로 장면(장애물·AI 신호 카드·본체 버튼 표시)과 조작 패널을 맞춰 보여 줌
export const DEVICE_INFO = {
  tof:     { icon: '📏', label: '거리센서 + 장애물', how: '앞에 장애물(상자)을 놓았어요. 2D 보기에서 끌어 옮기거나 지워 보며 반응을 확인하세요', panel: 'pEnv' },
  radio:   { icon: '📡', label: '라디오 숫자 받기(리모컨·AI 신호)', how: '[라디오로 숫자 보내기]의 숫자 버튼 = 리모컨 버튼이에요. AI 신호 코드라면 로보독 앞에 놓은 색 카드가 숫자를 보내요(카메라 흉내)', panel: 'pRadio' },
  button:  { icon: '🔘', label: '로보독 본체 버튼', how: '[본체 버튼 누르기]를 누르세요', panel: 'pSensor' },
  mbBtn:   { icon: '🅰', label: '마이크로비트 A·B 버튼', how: '실물에선 등에 꽂으면 가려져요. 로보독 코드라면 본체 버튼으로 바꾸세요', panel: 'pMb', warn: true },
  battery: { icon: '🔋', label: '배터리', how: '배터리 막대를 움직여 보세요', panel: 'pSensor' },
  tilt:    { icon: '📐', label: '기울기·방향', how: '시뮬레이터는 평평한 곳만 흉내 내요(기울기 0)', panel: 'pSensor' },
  sound:   { icon: '🔊', label: '소리', how: '[소리 켜기]를 켜면 비슷한 신호음이 나요', panel: 'pEnv' },
  mbLed:   { icon: '🔲', label: '마이크로비트 LED', how: '실물에선 꽂으면 잘 안 보일 수 있어요. 로보독 눈으로도 보여 주세요', panel: 'pMb' },
  fixed:   { icon: '🌡', label: '빛·온도·소리 센서', how: '시뮬레이터에서는 고정값이에요(실물에서 확인)', panel: 'pMb', warn: true },
  aicam:   { icon: '📷', label: 'AI 카메라(무선 확장)', how: '색 인식 모드면 앞 30°·100cm 안의 색 물체를 알아봐요(색→번호는 환경의 AI 카메라 설정, 실물 확인 필요). 얼굴·QR은 늘 "인식 없음"', panel: 'pSensor', warn: true },
};

// 주석·문자열은 지우고 찾음(설명 글에 블록 이름이 있어도 오인하지 않게)
function strip(code) {
  return String(code || '')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/g, '""');
}

export function detectDevices(code) {
  const c = strip(code), out = [];
  const has = (re) => re.test(c);
  if (has(/robodog\.getTof\s*\(/)) out.push('tof');
  if (has(/radio\.onReceived(Number|Value|String)\s*\(/)) out.push('radio');
  if (has(/robodog\.getButton\s*\(/)) out.push('button');
  if (has(/input\.(onButtonPressed|buttonIsPressed)\s*\(/)) out.push('mbBtn');
  if (has(/robodog\.getBattery\s*\(/)) out.push('battery');
  if (has(/robodog\.(getTilt|getRotation)\s*\(/)) out.push('tilt');
  if (has(/robodog\.soundPlay\s*\(/)) out.push('sound');
  if (has(/basic\.(showNumber|showString|showIcon|showLeds|plotLeds)\s*\(|led\.(plot|unplot|toggle)\s*\(/)) out.push('mbLed');
  if (has(/input\.(lightLevel|temperature|soundLevel|acceleration|compassHeading)\s*\(/)) out.push('fixed');
  if (has(/robodog\.(aiDetection|faceTracking|getFaceClass|getFaceTracking|getColorDetect|getQrCode|getAiPosition)\s*\(/)) out.push('aicam');
  return out;
}

// 라디오로 받은 숫자 → 카드 모양(이 자료의 약속: 1 빨강, 2 노랑, 3 초록, 4 배경)
export function radioCard(n) {
  return ({ 1: { name: '빨강', color: '#e5484d', ink: '#fff' }, 2: { name: '노랑', color: '#f2b300', ink: '#111827' },
    3: { name: '초록', color: '#1fa463', ink: '#fff' }, 4: { name: '배경', color: '#7a8499', ink: '#fff' } })[n]
    || { name: String(n), color: '#2456e5', ink: '#fff' };
}

// 실행 중 안내 한 줄
export function runHint(devs) {
  const parts = [];
  if (devs.includes('button')) parts.push('로보독 본체 버튼');
  if (devs.includes('radio')) parts.push('라디오 숫자');
  if (devs.includes('tof')) parts.push('장애물');
  if (devs.includes('battery')) parts.push('배터리 막대');
  if (!devs.includes('button') && devs.includes('mbBtn')) parts.push('A·B 버튼');
  return parts.length ? parts.join(' · ') + '(으)로 시험해 보세요' : '로보독 움직임을 지켜보세요';
}

// ------------------------------------------------------------
// 코드 → 장면에 있어야 할 것 (props.js ensureFor 의 needs 목록)
//   'distance'      거리센서(getTof)         → 앞에 상자
//   'object:<색>'   색 인식(getColorDetect)·AI 신호 카드 코드 → 앞에 그 색 물체(카드)
// ------------------------------------------------------------
const AI_BLOCKS = /robodog\.(aiDetection|faceTracking|getFaceClass|getFaceTracking|getColorDetect|getQrCode|getAiPosition)\s*\(/;
const COLOR_WORDS = [['red', /빨강|빨간|붉은|\bred\b/i], ['yellow', /노랑|노란|\byellow\b/i], ['green', /초록|녹색|\bgreen\b/i], ['blue', /파랑|파란|\bblue\b/i]];
const CLASS_NAME = /(?:deflib\.AiClass\.Class)?(\d)/.source;
const ID = '[\\p{L}\\p{N}_$]+';

// AI 브리지(웹캠 카드 → 라디오 숫자)를 받는 코드인가: 라디오 숫자 받기 + AI·카드 설명 + AI 카메라 블록은 없음
export function usesAiCards(code) {
  const c = strip(code);
  return /radio\.onReceivedNumber\s*\(/.test(c) && !AI_BLOCKS.test(c) && /\bAI\b|브리지|카드|신호등|웹캠/.test(String(code || ''));
}

// aiClass: 색 → 번호(설정값). getColorDetect() 결과를 비교하는 번호를 거꾸로 색으로 바꿔 그 색 물체를 요구
export function needsFromCode(code, aiClass = { red: 1, yellow: 2, green: 3, blue: 4 }) {
  const c = strip(code), needs = [];
  if (/robodog\.getTof\s*\(/.test(c)) needs.push('distance');
  if (/robodog\.getColorDetect\s*\(/.test(c)) {
    const inv = {}; for (const [color, n] of Object.entries(aiClass)) if (n) inv[n] = color;
    const nums = new Set(), add = (m) => { if (m) nums.add(Number(m)); };
    for (const m of c.matchAll(new RegExp(`getColorDetect\\s*\\(\\s*\\)\\s*[!=]==?\\s*${CLASS_NAME}`, 'g'))) add(m[1]);
    for (const m of c.matchAll(new RegExp(`${CLASS_NAME}\\s*[!=]==?\\s*robodog\\.getColorDetect\\s*\\(`, 'g'))) add(m[1]);
    for (const m of c.matchAll(new RegExp(`(${ID})\\s*=\\s*robodog\\.getColorDetect\\s*\\(`, 'gu'))) {
      for (const k of c.matchAll(new RegExp(`(?<![\\p{L}\\p{N}_$])${m[1].replace(/\$/g, '\\$')}\\s*[!=]==?\\s*${CLASS_NAME}`, 'gu'))) add(k[1]);
    }
    let colors = [...nums].map(n => inv[n]).filter(Boolean);
    if (!colors.length) colors = COLOR_WORDS.filter(([, re]) => re.test(String(code || ''))).map(([k]) => k);   // 번호를 못 찾으면 주석·글자의 색 이름
    if (!colors.length) colors = ['red'];
    for (const k of [...new Set(colors)]) needs.push('object:' + k);
  }
  if (usesAiCards(code)) needs.push('object:red', 'object:green');
  return needs;
}
