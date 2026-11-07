// makecode/*.ts → bridge/sim/examples.js (시뮬레이터 예제 목록) 생성
// 실행: node tests/build-sim-examples.js
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const dir = path.join(root, 'makecode');
const titles = {
  '00_check-robodog': '0. 연결·배터리 점검 (수업 전)',
  '01_hello-robodog': '1. 안녕, 로보독 (순차)',
  '02_distance-rule': '2. 규칙으로 반응하기 (거리센서)',
  '03_ai-traffic-dog': '3. AI 신호등 안내견 (라디오)',
  '04_ai-team-template': '4. 우리 모둠 AI 로보독 (틀)',
  '05_motion-tour': '5. 동작 둘러보기',
};
const list = fs.readdirSync(dir).filter(f => f.endsWith('.ts') && titles[f.replace('.ts', '')])
  .sort().map(f => ({ id: f.replace('.ts', ''), title: titles[f.replace('.ts', '')], code: fs.readFileSync(path.join(dir, f), 'utf8') }));
const out = '// 자동 생성 파일 (tests/build-sim-examples.js) — 직접 고치지 마세요\nexport const EXAMPLES = ' + JSON.stringify(list, null, 1) + ';\n';
fs.writeFileSync(path.join(root, 'bridge', 'sim', 'examples.js'), out);
console.log('examples:', list.map(e => e.id).join(', '));
