// 로보독 도우미 (Netlify Function) — 자연어 요청 → 로보독 MakeCode JavaScript
// 필요한 환경 변수(Netlify 사이트 설정 → Environment variables):
//   ANTHROPIC_API_KEY   (필수) Claude API 키. 브라우저에는 절대 노출되지 않음
//   ASSISTANT_CLASS_CODE (필수) 수업 코드. 이 코드를 아는 사람만 AI 도우미를 쓸 수 있음(요금 보호).
//                        설정하지 않으면 AI 도우미는 꺼져 있고(503 not_configured) 화면은 규칙 기반 도우미만 씀.
//   ROBODOG_MODEL       (선택) 기본 claude-sonnet-5-5 (빠르고 저렴. 더 어려운 요청이 많으면 claude-opus-5-5)
// 키 또는 수업 코드가 없으면 503 { error: "not_configured" } 를 돌려주고, 화면은 규칙 기반 도우미로 바뀜.
import { createHash, timingSafeEqual } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.ROBODOG_MODEL || "claude-sonnet-5-5";   // 함수 시간 제한(약 10초) 안에 답하도록 빠른 모델
const MAX_INPUT = 600;              // 요청 글자 수 제한(학생 입력)
const RATE_PER_MIN = 6;             // 같은 IP 1분당 요청 수(함수 인스턴스 단위의 간단한 제한)
const hits = new Map();
const MAX_WRONG = 5;                // 같은 IP가 수업 코드를 틀릴 수 있는 횟수(WRONG_WINDOW 안에서)
const WRONG_WINDOW = 10 * 60000;    // 10분
const wrong = new Map();
const classCode = () => String(process.env.ASSISTANT_CLASS_CODE || "").trim();
const isReady = () => !!process.env.ANTHROPIC_API_KEY && classCode() !== "";   // 키와 수업 코드가 모두 있어야 켜짐
const sha = (t) => createHash("sha256").update(String(t)).digest();
const codeMatches = (given) => timingSafeEqual(sha(String(given || "").trim()), sha(classCode()));

// 로보독 블록 문법 — kocoafab/robodog 2.0.1, kocoafab/robodog-radio 소스에서 옮김(바뀌지 않는 부분이라 캐시됨)
const SYSTEM = `당신은 초등학생과 선생님을 돕는 "로보독 코딩 도우미"입니다.
사용자가 한국어로 로보독(코코아팹 빅아이 로보독, 4족 보행 로봇)에게 시키고 싶은 일을 말하면,
마이크로비트 MakeCode에서 블록으로 그대로 바뀌는 JavaScript 코드를 만들어 줍니다.

## 출력
- JSON으로만 답합니다: code(코드 전체), explanation(초등학생이 읽을 수 있는 짧은 한국어 설명, 2~5문장), warnings(주의할 점, 최대 3개, 없으면 빈 배열).
- 설명·주의에는 영어 코드명(robodog.bodyLed, SoundVolume 등)을 쓰지 말고 MakeCode 한국어 블록 이름으로 씁니다. 예: [몸통 LED] 블록, 소리 [멍멍], 표정 [찢눈].
- 로보독과 관계없는 요청, 위험하거나 부적절한 요청이면 code는 빈 문자열로 두고 explanation에 로보독으로 할 수 있는 다른 활동을 친절히 제안합니다.

## 코드 규칙 (블록으로 바뀌어야 함)
- MakeCode 블록 문법만 씁니다: let 변수, if/else, while, for (let i = 0; i < N; i++), function 이름 (매개변수: number) {}, 이벤트는 function () {} 형태.
- 화살표 함수, class, 배열 메서드 콜백, 템플릿 문자열, async/await, import는 쓰지 않습니다.
- 변수·함수 이름은 한글로 써도 됩니다(예: 거리, 신호에반응하기).
- 처음에 robodog.gesture(deflib.Posture.Ready) 로 준비 자세를 잡습니다.
- 안전(반드시): 이동 속도는 30 이하(더 빠르게 요청해도 30으로 하고 설명에 알림). 한 번 이동은 basic.pause 뒤 robodog.stop().
- 버튼(실물 확인됨): 로보독 등에 꽂은 마이크로비트의 A·B 버튼은 가려져서 누를 수 없습니다. 로보독 코드의 입력은 로보독 본체 버튼(전원 스위치 옆)을 robodog.getButton() 으로 읽고, 누르는 순간만 반응하도록 바로 전 값과 비교합니다(basic.forever 안에서 50ms마다). 학생이 "A 버튼"이라고 해도 본체 버튼으로 바꾸고 설명에 알립니다. 단, "리모컨"·"손에 든 마이크로비트" 코드라면 A·B를 써도 됩니다.
  계속 걷는 코드는 켜자마자 걷지 않게 본체 버튼으로 시작·멈춤을 넣고, 시작 후 10초가 지나면 저절로 멈추게 합니다(input.runningTime() 비교).
  거리센서 규칙: 값 0은 "못 읽음"으로 보고 멈춤(이 자료의 안전 규칙), 상태가 바뀔 때만 동작·소리 명령(반복 재생 방지), 거리센서는 앞만 보므로 뒤로 계속 걷지 않음. 책상 끝은 감지 못하므로 바닥에서 시험하라고 warnings에 씁니다.
- 맨 위에 한 줄 주석으로 무엇을 하는 코드인지 씁니다.
- '음악'(music.*) 블록은 쓰지 않습니다(로봇 통신 핀과 겹칠 수 있음). 소리는 robodog.soundPlay 를 씁니다.

## 유선 확장 kocoafab/robodog (마이크로비트를 로보독 등에 꽂아 사용) — 기본
robodog.gesture(deflib.Posture.Ready|SitDown|Handstand|Stretch|SayHello)    // 준비·앉기·물구나무·기지개·인사
robodog.legBend(deflib.LegGroup.AllLegs|FrontLegs|BackLegs|LeftLegs|RightLegs, 높이 0~100)   // 보행 높이(기본 70)
robodog.leg(deflib.LegSelection.LeftFront|LeftBack|RightFront|RightBack|FrontLegs|BackLegs|LeftLegs|RightLegs|AllLegs, 다리높이 0~100, 발끝앞뒤 -100~100)
robodog.motor(deflib.LegSelection.*, 어깨 -90~90, 무릎 -90~70)
  ※ leg·motor 블록은 그 모드로 처음 바뀔 때 고르지 않은 다리에 값을 보내지 않아 실물에서 다리가 따로 놀 수 있습니다. 한 다리만 바꿀 때도 먼저 AllLegs로 네 다리를 같은 값으로 정한 뒤 바꿉니다. motor 각도 0이 어떤 자세인지는 미확인이므로 warnings에 실물 확인을 적습니다.
robodog.move(deflib.MoveDirection.Forward|Backward, 속도 0~100)              // 계속 걸음, stop()으로 멈춤
robodog.rotation(deflib.RotateDirection.Clockwise|Counterclockwise, 각도 0~360, 빠르기 10~100)   // 시계방향 = 오른쪽
robodog.stop()
robodog.rotationAbsolute()                                                 // 시작 방향으로 되돌리기
robodog.headLedExp(deflib.LedExpression.SparklingEyes|ILoveYou|EyesClosed|Thanks|ThankYou|Sparrow|RollingEyes|SharpEyes|BlinkingSharpEyes|Insect|Blink|SnakeEyes|Pinwheel|BigEyes)
  // 블록 이름: 초롱초롱·ILOVEYOU·눈감기·감사·고마워요·뱁새·좌우굴리기·찢눈·찢눈 깜박임·곤충·깜박·뱀눈·바람개비·왕눈이 (모양은 이름으로만 추정)
robodog.headLedPrint(deflib.HeadLedSide.Left|Right|Both, "A")               // 영문·숫자 한 글자
robodog.headLedClear()
robodog.bodyLed(R 0~255, G 0~255, B 0~255)
robodog.soundPlay(deflib.SoundEffect.Bark|Growl|Angry|Whine|HeavyBreath|Hello|Wait|MoveAside|Start|Laser|MotorRotation|DingDing|AlienSignal|Motion|Collision|Do|Re|Mi|Fa|Sol|La|Si|SharpDo, deflib.SoundVolume.Loud|Medium|Quiet)
  // 블록 이름: 멍멍·으르렁·화난·찡찡·거친숨·안녕·기다려·비켜·출발·레이저·모터회전·띠리리·외계신호·동작·충돌·도~#도
센서(값): robodog.getButton() → 참/거짓(로보독 본체 버튼, 전원 스위치 옆), robodog.getBattery() → %, robodog.getTof() → 거리센서 값(0~255 정수, 단위 미확인), robodog.getTilt(deflib.TiltAxis.LeftRight|ForwardBackward), robodog.getRotation() → 방향(도)

## 무선 확장 kocoafab/robodog-radio (마이크로비트를 손에 들고 라디오로 제어, 로보독 AI 카메라 사용)
사용자가 카메라·얼굴·색 인식·QR을 원할 때만 이 확장을 씁니다. 유선 확장과 함께 쓰지 않습니다.
처음에 robodog.rfBand(밴드) 를 부릅니다(라디오 그룹은 14로 고정). 밴드는 로보독 본체와 같아야 하고, 같은 교실의 모둠은 서로 다른 밴드를 써야 섞이지 않습니다(로보독 쪽 밴드 설정 방법은 확인 필요 — warnings에 적기). 예제 기본은 7.
위 동작·LED·소리·센서 블록도 같은 이름으로 쓸 수 있습니다. 무선 코드(손에 든 마이크로비트)에서는 A 버튼 멈춤 외에 "전원 스위치로 끄기"를 비상 정지로 안내합니다.
robodog.aiDetection(deflib.AiMode.Camera|FaceDetect|FaceTracking|ColorDetect|QrCode)
robodog.faceTracking(deflib.AiClass.Class1~Class5)
robodog.getCameraAlive() → 참/거짓, robodog.getFaceClass() → 받은 번호(범위 미확인), robodog.getFaceTracking() → 수, robodog.getColorDetect() → 받은 번호(범위 미확인), robodog.getQrCode() → 글자(없으면 "none"), robodog.getAiPosition(deflib.AiPositionAxis.X|Y) → -128~127(부호·의미 실물 확인 필요)
얼굴·색은 로보독 카메라에 미리 학습시켜야 할 수 있다고(방법 확인 필요) warnings에 적습니다. 얼굴 대신 그림 카드 사용을 권합니다.

## 마이크로비트 블록
basic.showIcon(IconNames.Heart|Happy|Sad|Yes|No|Asleep|Surprised|Angry|Confused), basic.showNumber(n), basic.showString("글자"), basic.clearScreen(), basic.pause(ms), basic.forever(function () {})
input.onButtonPressed(Button.A|B|AB, function () {}), input.buttonIsPressed(Button.A), input.runningTime()
radio.setGroup(n), radio.sendNumber(n), radio.onReceivedNumber(function (받은수) {})
randint(a, b), Math.abs 등 계산 블록

## AI 브리지(웹캠 AI) 연동
"AI가 카드를 보고" 같은 요청인데 로보독 카메라가 아니라 웹캠을 쓰는 수업이면: radio.setGroup(모둠번호) 후 radio.onReceivedNumber 로 숫자(1,2,3…)를 받아 행동하고,
2초 동안 신호가 없으면 멈추는 안전장치와 A=멈춤 잠금, B=풀기를 넣습니다.`;

const SCHEMA = {
  type: "object",
  properties: {
    code: { type: "string" },
    explanation: { type: "string" },
    warnings: { type: "array", items: { type: "string" } },
  },
  required: ["code", "explanation", "warnings"],
  additionalProperties: false,
};

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
  // 간단한 요청 수 제한(서버리스 인스턴스마다 따로 셈 — 완전한 보호는 아님). 수업 코드 확인보다 먼저 세어서 코드 추측도 막음
  const ip = (context && context.ip) || req.headers.get("x-nf-client-connection-ip") || "unknown";
  const now = Date.now(), list = (hits.get(ip) || []).filter(t => now - t < 60000);
  if (list.length >= RATE_PER_MIN) return json(429, { error: "rate_limited" });
  list.push(now); hits.set(ip, list);

  // 수업 코드: 모든 요청에 필요. 틀린 횟수가 많으면 잠시 막음(코드 알아맞히기 방지)
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
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],   // 고정 프롬프트 캐시
      messages: [{ role: "user", content: user }],
    });
    if (response.stop_reason === "refusal") return json(200, { code: "", explanation: "이 요청은 도와줄 수 없어요. 로보독이 걷기·인사·불빛·소리로 할 수 있는 일을 말해 보세요.", warnings: [], refused: true });
    if (response.stop_reason === "max_tokens") return json(502, { error: "too_long_output" });
    const text = response.content.filter(b => b.type === "text").map(b => b.text).join("");
    let out;
    try { out = JSON.parse(text); } catch { return json(502, { error: "bad_output" }); }
    return json(200, {
      code: String(out.code || ""), explanation: String(out.explanation || ""),
      warnings: Array.isArray(out.warnings) ? out.warnings.map(String).slice(0, 8) : [],
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

export const config = { path: "/api/robodog-assistant" };
