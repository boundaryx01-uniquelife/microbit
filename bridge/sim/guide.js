// 실행 뒤 "지금 무엇을 눌러야 하나" 안내 — 교구와 무관(코드를 읽어 마이크로비트 버튼·라디오·본체 버튼 입력을 찾음)
//  inputGuide(code, { how, kit }) → { buttons:['A'|'B'|'AB'], radio:boolean, nums:number[], robot:boolean, text, waitHint }
//  how = 예제의 한 줄 설명(예: "A 버튼으로 출발. 책(벽)에 가까워지면 멈춰요.")
//  text(HTML) 가 빈 글자이면 입력이 필요 없는 코드(스스로 계속 움직임)

function strip(code) {   // 주석·글자는 지우고 찾음(설명 글에 블록 이름이 있어도 오인하지 않게)
  return String(code || '')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`/g, '""');
}

const esc = (t) => String(t).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

export function inputGuide(code, { how = '', kit = 'robodog' } = {}) {
  const c = strip(code), g = { buttons: [], radio: false, nums: [], robot: false, text: '', waitHint: false };
  for (const m of c.matchAll(/input\.onButtonPressed\s*\(\s*Button\.(AB|A|B)\b/g)) if (!g.buttons.includes(m[1])) g.buttons.push(m[1]);
  if (/input\.buttonIsPressed\s*\(/.test(c) && !g.buttons.length) g.buttons.push('A');
  g.radio = /radio\.onReceived(Number|Value|String)\s*\(/.test(c);
  g.robot = kit === 'robodog' && /robodog\.getButton\s*\(/.test(c);
  // 예제 설명(how)이 있으면 거기 나온 버튼만 안내(예: B 는 '멈춤 잠금'일 뿐이라 안내하지 않음)
  if (how) g.buttons = g.buttons.filter(b => new RegExp('(^|[^A-Za-z])' + b + '(?![A-Za-z])').test(how));
  if (g.radio) {
    const nums = new Set();
    for (const m of String(how).matchAll(/(?<![\d.])(\d)\s*=/g)) nums.add(Number(m[1]));
    g.nums = [...nums].sort((a, b) => a - b);
  }
  // 화면 글자(스크롤)가 입력 받기 등록보다 먼저 있으면 글자가 다 지나간 뒤에야 입력이 들어감
  const first = c.search(/input\.onButtonPressed\s*\(|radio\.onReceived(Number|Value|String)\s*\(/);
  g.waitHint = first > 0 && /\bbasic\.(showString|showNumber)\s*\(/.test(c.slice(0, first));

  const parts = [];
  const names = g.buttons.map(b => (b === 'AB' ? 'A+B' : b));
  if (g.robot) parts.push('<b>본체 버튼 누르기</b>를 눌러 보세요');
  if (names.length) parts.push(`<b>${names.join(' · ')} 버튼</b>을 눌러 ${names.length === 1 && names[0] === 'A' ? '출발하세요' : '보세요'}`);
  if (g.radio) parts.push(g.nums.length ? `<b>라디오 숫자 ${g.nums.join(' · ')}</b>을 눌러 보세요` : '<b>라디오 숫자</b>를 눌러 보세요');
  if (parts.length) {
    g.text = parts.join(' / ');
    if (g.waitHint) g.text += ' (화면 글자가 다 지나간 뒤 눌러요)';
    if (how) g.text += ` — ${esc(how)}`;
  } else if (how) g.text = `누를 것은 없어요. ${esc(how)}`;
  return g;
}
