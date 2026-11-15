// 포니봇 도우미 (Netlify Function) — 자연어 요청 → 포니봇(aiPonybot) MakeCode JavaScript
// 로보독 도우미와 같은 환경 변수를 그대로 쓴다(따로 설정할 것 없음):
//   ANTHROPIC_API_KEY    (필수) Claude API 키. 브라우저에는 절대 노출되지 않음
//   ASSISTANT_CLASS_CODE (필수) 수업 코드. 이 코드를 아는 사람만 AI 도우미를 쓸 수 있음(요금 보호)
//   PONYBOT_MODEL        (선택) 없으면 ROBODOG_MODEL, 그것도 없으면 claude-sonnet-5-5
// 프롬프트는 블록 표(kits/ponybot/blocks.json)와 정책(policy.json)에서 만든다(손으로 베끼지 않음).
// 모델이 만든 코드는 서버에서 checkPonyCode(블록 표·정책 검사)로 다시 확인하고, 걸리면 422 invalid_code → 화면은 규칙 도우미로 대신 만든다.
import { createHash, timingSafeEqual } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import Babel from "../../bridge/sim/lib/babel.min.js";
import blocks from "../../kits/ponybot/blocks.json" with { type: "json" };
import policy from "../../kits/ponybot/policy.json" with { type: "json" };
import { validateCode } from "../../bridge/sim/validate-code.mjs";
import { configurePony, ponyAssistant, checkPonyCode, SAMPLE_REQUESTS } from "../../bridge/sim/kits/ponybot/assistant.js";
import { buildSystemPrompt, OUTPUT_SCHEMA } from "../../tools/build-assistant-prompt.mjs";

const MODEL = process.env.PONYBOT_MODEL || process.env.ROBODOG_MODEL || "claude-sonnet-5-5";
const MAX_INPUT = 600;
const RATE_PER_MIN = 6;
const hits = new Map();
const MAX_WRONG = 5;
const WRONG_WINDOW = 10 * 60000;
const wrong = new Map();
const classCode = () => String(process.env.ASSISTANT_CLASS_CODE || "").trim();
const isReady = () => !!process.env.ANTHROPIC_API_KEY && classCode() !== "";
const sha = (t) => createHash("sha256").update(String(t)).digest();
const codeMatches = (given) => timingSafeEqual(sha(String(given || "").trim()), sha(classCode()));

configurePony({ blocks, validateCode, Babel });

// 본보기 2개: 규칙 도우미가 같은 블록 표로 만든 코드(검사 통과분)를 그대로 보여 준다 — 손으로 쓴 예시가 블록 표와 어긋나지 않게
const EXAMPLES = SAMPLE_REQUESTS.slice(0, 2).map((q) => ({ q, code: ponyAssistant(q, policy).code })).filter((e) => e.code);
const SYSTEM = [
  buildSystemPrompt(blocks, policy, "포니봇"),
  [
    "# 포니봇에서 자주 쓰는 구성",
    "- 메카넘 바퀴라서 몸을 돌리지 않고 옆·대각선으로 갈 수 있다. \"옆으로\"·\"대각선\" 요청은 돌기 대신 메카넘 이동 블록을 쓴다.",
    "- 포니봇에 꽂은 마이크로비트의 A·B 버튼은 그대로 쓴다(실물에서 손이 닿는지는 확인 전 — 필요하면 warnings 에 적는다).",
    `- 컬러센서는 맨 위에서 한 번 aiPonybot.initColorSensor(aiPonybot.SensorVersion.${policy.colorSensorVersion || "V2"}) 로 초기화한다.`,
    "- 여러 조건(선 따라가기 + 색 + 거리)을 한꺼번에 다룰 때는 basic.forever 한 곳에서 우선순위 순서(멈춤 조건 → 기다림 조건 → 이동)로 판단한다.",
  ].join("\n"),
  ...(EXAMPLES.length ? ["# 본보기 (형식 참고용 — 요청이 다르면 그대로 베끼지 않는다)\n" + EXAMPLES.map((e) => `요청: ${e.q}\n코드:\n${e.code}`).join("\n\n")] : []),
].join("\n\n");

const json = (status, body) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
});

export default async (req, context) => {
  if (req.method === "GET") return json(200, { ok: true, configured: isReady(), needsCode: true, ...(process.env.ANTHROPIC_API_KEY && !classCode() ? { setup: "no_class_code" } : {}) });
  if (req.method !== "POST") return json(405, { error: "method" });
  if (!isReady()) return json(503, { error: "not_configured" });

  let body;
  try { body = await req.json(); } catch { return json(400, { error: "bad_json" }); }
  const ip = (context && context.ip) || req.headers.get("x-nf-client-connection-ip") || "unknown";
  const now = Date.now(), list = (hits.get(ip) || []).filter(t => now - t < 60000);
  if (list.length >= RATE_PER_MIN) return json(429, { error: "rate_limited" });
  list.push(now); hits.set(ip, list);

  const bad = (wrong.get(ip) || []).filter(t => now - t < WRONG_WINDOW);
  if (bad.length >= MAX_WRONG) return json(429, { error: "too_many_wrong_codes" });
  if (!codeMatches(body.classCode)) { bad.push(now); wrong.set(ip, bad); return json(401, { error: "class_code" }); }

  const request = String(body.request || "").trim();
  const currentCode = String(body.currentCode || "").slice(0, 6000);
  if (!request) return json(400, { error: "empty" });
  if (request.length > MAX_INPUT) return json(400, { error: "too_long", max: MAX_INPUT });

  const user = currentCode
    ? `지금 코드:\n\`\`\`\n${currentCode}\n\`\`\`\n\n요청: ${request}\n(지금 코드를 고치는 요청이면 고친 전체 코드를, 새 요청이면 새 코드를 주세요.)`
    : `요청: ${request}`;

  const client = new Anthropic();
  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",                              // 안전 분류기가 거절하면 서버가 다른 모델로 다시 시도
      output_config: { effort: "low", format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],   // 고정 프롬프트 캐시
      messages: [{ role: "user", content: user }],
    });
    if (response.stop_reason === "refusal") return json(200, { code: "", explanation: "이 요청은 도와줄 수 없어요. 포니봇이 앞·옆·대각선으로 가기, 돌기, 선 따라가기, 화면에 글자 쓰기로 할 수 있는 일을 말해 보세요.", warnings: [], refused: true });
    if (response.stop_reason === "max_tokens") return json(502, { error: "too_long_output" });
    const text = response.content.filter(b => b.type === "text").map(b => b.text).join("");
    let out;
    try { out = JSON.parse(text); } catch { return json(502, { error: "bad_output" }); }
    const code = String(out.code || "");
    const warnings = Array.isArray(out.warnings) ? out.warnings.map(String).slice(0, 8) : [];
    if (code) {
      // 프롬프트의 부탁만으로는 안전하지 않다 — 없는 블록·범위 밖 값·정책 위반은 여기서 결정적으로 막는다
      const chk = checkPonyCode(code, policy);
      if (!chk.ok) return json(422, { error: "invalid_code", detail: chk.errors.slice(0, 5).map(e => `${e.code}: ${e.msg}`) });
      for (const w of chk.warnings.slice(0, 3)) warnings.push(w.msg);
    }
    return json(200, {
      code, explanation: String(out.explanation || ""), warnings: warnings.slice(0, 8),
      model: response.model, usage: { in: response.usage.input_tokens, cached: response.usage.cache_read_input_tokens, out: response.usage.output_tokens },
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) return json(503, { error: "bad_key" });
    if (error instanceof Anthropic.RateLimitError) return json(429, { error: "api_rate_limited" });
    if (error instanceof Anthropic.BadRequestError) return json(502, { error: "bad_request", detail: error.message.slice(0, 200) });
    if (error instanceof Anthropic.APIError) return json(502, { error: "api_error", status: error.status });
    return json(500, { error: "server_error" });
  }
};

export const config = { path: "/api/ponybot-assistant" };
