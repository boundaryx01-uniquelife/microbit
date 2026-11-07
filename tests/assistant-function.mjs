// 도우미 서버 함수 오프라인 시험: 가짜 Claude API 서버로 요청 형식·응답 처리·오류 처리를 확인 (실제 API 호출·요금 없음)
// 실행: node tests/assistant-function.mjs
import http from 'node:http';

let last = null, mode = 'ok';
const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', c => body += c);
  req.on('end', () => {
    last = { url: req.url, headers: req.headers, body: JSON.parse(body || '{}') };
    const send = (status, obj) => { res.writeHead(status, { 'content-type': 'application/json', 'request-id': 'req_test' }); res.end(JSON.stringify(obj)); };
    if (mode === 'ratelimit') return send(429, { type: 'error', error: { type: 'rate_limit_error', message: 'slow down' } });
    if (mode === 'auth') return send(401, { type: 'error', error: { type: 'authentication_error', message: 'bad key' } });
    const payload = mode === 'refusal' ? { content: [], stop_reason: 'refusal' } : {
      content: [{ type: 'text', text: JSON.stringify({ code: '// 앞으로 걷기\nrobodog.gesture(deflib.Posture.Ready)\nrobodog.move(deflib.MoveDirection.Forward, 25)\nbasic.pause(2000)\nrobodog.stop()', explanation: '앞으로 2초 걸어요.', warnings: [] }) }],
      stop_reason: 'end_turn',
    };
    send(200, { id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-5-5', usage: { input_tokens: 10, output_tokens: 20, cache_read_input_tokens: 5000 }, ...payload });
  });
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${server.address().port}`;
process.env.ANTHROPIC_API_KEY = 'test-key';
process.env.ASSISTANT_CLASS_CODE = '1234';
const { default: handler } = await import('../netlify/functions/robodog-assistant.mjs');

const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${detail}`); };
const call = async (body, ip = '1.1.1.1') => {
  const req = new Request('http://localhost/api/robodog-assistant', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
  const r = await handler(req, { ip });
  return { status: r.status, body: await r.json() };
};

let r = await call({ request: '앞으로 2초 걸어', classCode: '1234' });
check('정상 응답 200 + 코드', r.status === 200 && r.body.code.includes('robodog.move'), JSON.stringify(r.body).slice(0, 80));
check('모델 claude-opus-5-5', last.body.model === 'claude-opus-5-5');
check('구조화 출력(json_schema)', last.body.output_config && last.body.output_config.format && last.body.output_config.format.type === 'json_schema');
check('effort medium', last.body.output_config.effort === 'medium');
check('거절 대비 fallbacks: "default" + 베타 헤더', last.body.fallbacks === 'default' && String(last.headers['anthropic-beta']).includes('server-side-fallback-2026-07-01'), String(last.headers['anthropic-beta']));
check('시스템 프롬프트 캐시(cache_control)', Array.isArray(last.body.system) && last.body.system[0].cache_control && last.body.system[0].cache_control.type === 'ephemeral');
check('키는 서버에서만 헤더로 전송', last.headers['x-api-key'] === 'test-key' || String(last.headers['authorization'] || '').includes('test-key'), Object.keys(last.headers).filter(k => /key|auth/i.test(k)).join(','));

r = await call({ request: '앞으로', classCode: 'wrong' });
check('수업 코드 틀리면 401', r.status === 401);
r = await call({ request: 'x'.repeat(700), classCode: '1234' });
check('너무 긴 요청 400', r.status === 400 && r.body.error === 'too_long');
mode = 'refusal'; r = await call({ request: '이상한 요청', classCode: '1234' }, '2.2.2.2');
check('거절 응답을 친절한 안내로', r.status === 200 && r.body.refused === true && r.body.code === '');
mode = 'ratelimit'; r = await call({ request: '앞으로', classCode: '1234' }, '3.3.3.3');
check('API 429 → 429', r.status === 429, JSON.stringify(r.body));
mode = 'auth'; r = await call({ request: '앞으로', classCode: '1234' }, '4.4.4.4');
check('잘못된 키 → 503 bad_key', r.status === 503 && r.body.error === 'bad_key');
mode = 'ok';
let limited = false;
for (let i = 0; i < 8; i++) { const x = await call({ request: '앞으로', classCode: '1234' }, '5.5.5.5'); if (x.status === 429) limited = true; }
check('같은 IP 1분 6회 초과 시 429', limited);
delete process.env.ANTHROPIC_API_KEY;
r = await call({ request: '앞으로', classCode: '1234' }, '6.6.6.6');
check('키가 없으면 503 not_configured', r.status === 503 && r.body.error === 'not_configured');

server.close();
const fail = results.filter(x => !x).length;
console.log(`\n${results.length - fail}/${results.length} PASS`);
process.exit(fail ? 1 : 0);
