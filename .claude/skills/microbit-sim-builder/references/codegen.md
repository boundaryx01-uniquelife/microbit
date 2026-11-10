# ③ 코드 생성 — 규칙 도우미(오프라인 워크플로) + Claude API 모드


## 1. 아키텍처

### 1-0. 모드 결정 (UI, `index.html`)
- 상태 변수: `aiAvail`(서버에 키+수업코드 설정됨), `aiOn = aiAvail && 수업코드 입력됨`.
- 시작 시 `checkAi()` = `GET /api/robodog-assistant` -> `{configured, needsCode, setup?}`.
  네트워크 오류나 `!r.ok`면 `{available:false, reason:'offline'}`, `configured:false`면 `reason:'not_configured'`.
- 배지 `#askMode`: `AI 도우미 (Claude)` / `규칙 도우미 · AI는 수업 코드가 있어야 켜져요` / `규칙 도우미`.
  `#askClass`(password 입력)는 `aiAvail`이 아니면 disabled이고 placeholder는 "관리자 설정 필요".
- 수업 코드는 `sessionStorage['robodog-class-code']`에만 저장한다. 예전 `localStorage` 값은 시작할 때 지운다.
- `#askBtn` 클릭 분기:
  1. `aiAvail && !aiOn` -> AI를 호출하지 않고 규칙 도우미를 쓰며 "수업 코드를 넣어야 AI가 켜져요" 경고를 맨 앞에 붙인다.
  2. `aiOn` -> `askAi(text, 고치기체크 ? $('code').value : '', 수업코드)`. 성공하면 `showAnswer({...r, suggestions: ruleAssistant(text).suggestions}, '🤖 AI:')`.
  3. `askAi` 예외 -> `e.code`를 한국어 이유로 바꾸고(`class_code`, `rate_limited`, `api_rate_limited`, `too_many_wrong_codes`, `not_configured`, `bad_key`, `too_long` 등) `ruleAssistant(text)`로 대신 만든다. 이유는 `warnings`에 unshift한다. `class_code` 오류면 코드 입력칸에 포커스를 준다.
  4. 그 외 -> `ruleAssistant(text)`.
- 결과 표시 `showAnswer(r, source)`: 설명 / `warnings` `<li>` / 비슷한 예제 링크(`suggestions` -> `DEMOS` 재생) / `#askCode`(`<details>` "만든 코드 보기").
  코드가 있으면 `ensureBabel().then(() => compile(r.code))`로 시뮬레이터 컴파일을 시도하고, 실패하면 "코드에 문법 오류가 있어요" 경고를 맨 위에 넣는다.
  코드가 없으면 실행·삽입 버튼을 숨긴다.
- 버튼: `▶ 시뮬레이터에서 실행` -> `runCode(code)`. `🧩 이 코드로 바꾸기` -> `confirm` 후 `$('code').value = code; save()`, 이어서 MakeCode 편집기로 import(1.5초 폴링 `mcImport`).
- "지금 코드 고치기"(`#askFix`) 체크 시에만 현재 JS 칸 내용을 `currentCode`로 보낸다. 규칙 도우미는 이 체크를 무시한다(항상 새로 만든다. 기존 코드를 고치지 못함).

### 1-a. 규칙 기반 오프라인 흐름 (`ruleAssistant(text)` -> `{code, explanation, warnings, suggestions}`)
브라우저 안에서만 동작하며 외부 호출이 없다. 단계는 다음과 같다.
1. **입력 검사**: 빈 입력이면 안내문. 300자 초과면 거절. AI 카메라·카드·색 인식 정규식(`카드|카메라|AI|…(보|인식|구분)`)에 걸리면 코드를 만들지 않고 "예제 03으로 가라"는 안내를 준다(`suggestExamples`).
2. **트리거(언제) 탐지**: `TRIGGERS`는 `{re, kind, arg?}` 배열이다. kind는 `robotbtn`(본체 버튼), `btn`(A/B/AB), `radio`(숫자 N, 또는 "라디오 A 버튼" -> 1·2), `near`(가까우면), `else`(멀면·아니면), `forever`(계속).
   전부 `g` 플래그로 훑어 `marks[{at,end,kind,arg}]`를 만들고, 겹친 것을 제거한다(AB가 A보다 우선). 버튼·라디오 뒤의 `forever`는 앞 트리거의 `always=true`로 흡수한다.
   `누르면` 계열 문구가 있는데 어느 트리거에도 안 잡히면 "어느 버튼인지 알려 주세요"로 거절한다(추측 금지).
3. **구간 분할**: `segs = [{kind:'start', text}, {kind, arg, always, text}…]`. 트리거 사이의 글이 그 트리거의 동작이 된다. "앞으로 계속 걸어"처럼 `forever` 앞뒤가 한 동작이면 병합한다.
4. **구간 -> 동작**: `build(text)`가 `splitPhrases`(`하고 / 한 다음 / 그리고 / , . ! ? / → / …고`로 분할)를 호출하고, 각 구절을 `actionsOf(phrase)`에 넘긴다.
   `actionsOf`는 키워드별 if 사슬이다. 걷기·회전·자세·불빛(`COLORS`)·표정(`FACES`)·소리(`SOUNDS`, `SAYS`)·춤·점프·마이크로비트 화면·기다리기가 있다.
   항목마다 `{at(구절 안 위치), n, lines[], d(설명)}`을 만들고 `at` 순으로 정렬해 말한 순서를 지킨다.
   "N번 반복"은 `for` 루프로 감싼다(춤은 자체 반복이 있어 제외). 이해 못 한 구절은 `unknown[]`에 모아 경고한다.
5. **조립**: `code=['robodog.gesture(deflib.Posture.Ready)']`(준비 자세), `tail[]`(이벤트·`basic.forever`), `expl[]`(설명).
   - `btn` -> `input.onButtonPressed`. `always`면 토글 변수 + `basic.forever`.
   - 계속 걷기(`walker`) -> `걷는중`/`시작시간` 변수, 토글, 10초 자동 멈춤 `input.runningTime() - 시작시간 > 10000`.
   - `robotbtn` 및 `takeToggle()` -> `robodog.getButton()`을 바로 전 값(`본체이전`)과 비교하는 50ms 폴링. 꽂은 마이크로비트의 A·B는 가려지므로 본체 버튼을 먼저 배정한다.
   - `radio` -> `신호`/`마지막신호`/`이전신호`/`잠금`, `radio.setGroup(1)`, 수신 핸들러는 기록만 하고 처리는 `forever` 한 곳에서 한다. 2초 무신호면 멈추고, 잠금 버튼을 둔다.
   - `near` -> `거리 == 0`이면 멈춤, `거리 < cm`이면 상태 1(1회), 그 외 상태 2. 멀 때 `Backward`는 `stop`으로 바꾼다.
6. **마무리**: 연속 빈 줄 제거, 맨 위에 `// 로보독 도우미가 만든 코드: <요청 60자>` 주석, 꼬리 경고(A·B 가려짐, 모르는 조각, 계속 걷기 10초). 의미 있는 줄이 준비 자세뿐이면 `code=''`와 `CAN_DO` 안내를 준다.
7. **추천**: `suggestExamples(text)` = `EXAMPLE_HINTS[{id,title,re,why}]` 중 최대 3개.

주요 자료구조: `SPEED`, `COLORS/FACES/SOUNDS/SAYS`(`[정규식, enum 이름, 한국어 블록 이름]`), `TRIGGERS`, `EXAMPLE_HINTS`, `CAN_DO`(문자열), `SAMPLE_REQUESTS`(예시 칩 5개, 시험에서도 재사용).

### 1-b. Claude API 모드 (`robodog-assistant.mjs`)
- 라우트 `/api/robodog-assistant`(`config.path`).
- **GET**: `{ok, configured: isReady(), needsCode:true, setup?:'no_class_code'}`. `isReady()`는 `ANTHROPIC_API_KEY`가 있고 `ASSISTANT_CLASS_CODE`가 비어 있지 않은 경우다.
- **POST** 요청: `{request, currentCode?, classCode}`.
- 처리 순서(순서가 중요하다):
  1. `!isReady()` -> 503 `not_configured`.
  2. JSON 파싱 실패 -> 400 `bad_json`.
  3. IP별 속도 제한(1분 6회, `hits` Map) -> 429 `rate_limited`. 수업 코드 확인보다 먼저 세어 코드 추측도 막는다.
  4. 오답 잠금(10분 안에 5회 틀리면) -> 429 `too_many_wrong_codes`. 코드 비교는 `sha256` + `timingSafeEqual`이고 앞뒤 공백은 무시한다. 틀리면 401 `class_code`.
  5. `request`는 trim 후 비면 400 `empty`, 600자 초과면 400 `too_long`. `currentCode`는 6000자로 자른다.
  6. 프롬프트 구성: `currentCode`가 있으면 "지금 코드: ```…``` / 요청: … (지금 코드를 고치는 요청이면 고친 전체 코드를, 새 요청이면 새 코드를)", 없으면 "요청: …". 보내는 것은 학생 문장과(고치기 모드일 때) 현재 코드뿐이다.
  7. 호출: `client.beta.messages.create({model: ROBODOG_MODEL||'claude-sonnet-5-5', max_tokens:4000, betas:['server-side-fallback-2026-07-01'], fallbacks:'default', output_config:{effort:'low', format:{type:'json_schema', schema:{code,explanation,warnings}}}, system:[{text:SYSTEM, cache_control:{type:'ephemeral'}}], messages})`.
     JSON 스키마(`additionalProperties:false`)를 강제하고 시스템 프롬프트를 캐시한다. 테스트에서는 `ANTHROPIC_BASE_URL`로 가짜 서버를 가리킨다.
  8. 응답 처리: `stop_reason==='refusal'` -> 200 `{code:'', refused:true, 친절한 안내}`. `max_tokens` -> 502 `too_long_output`. text 블록을 이어 `JSON.parse` 하고 실패하면 502 `bad_output`.
     정규화로 `code/explanation`은 `String()`, `warnings`는 배열 최대 8개로 하고 `model`, `usage{in,cached,out}`을 덧붙인다.
  9. 예외: `AuthenticationError` -> 503 `bad_key`, `RateLimitError` -> 429 `api_rate_limited`, `BadRequestError` -> 502 `bad_request`, 기타 `APIError` -> 502 `api_error`, 나머지 500.
- SYSTEM 프롬프트 구성(고정 문자열, 약 3천 토큰):
  1) 역할·JSON 출력 규약, 영어 코드명 대신 MakeCode 한국어 블록 이름으로 설명, 부적절한 요청은 code 빈 문자열.
  2) 코드 규칙(블록으로 바뀌는 문법만, 화살표 함수·class·템플릿 문자열·async 금지, 준비 자세 먼저, **속도 30 이하**, 한 번 이동은 `pause` 후 `stop`, 본체 버튼 규칙, 계속 걷기 10초 자동 정지, 거리센서 규칙, 맨 위 한 줄 주석, `music.*` 금지).
  3) 유선 확장 `kocoafab/robodog` 블록 시그니처 목록(enum 포함, 범위, 한국어 블록 이름 주석).
  4) 무선 확장 `kocoafab/robodog-radio`(카메라·QR, `rfBand`).
  5) micro:bit 기본 블록. 6) AI 브리지 연동 패턴.
- **AI 출력 후처리는 서버에도 UI에도 코드 레벨 안전 검사가 없다.** 서버는 형식 정규화만 하고, UI는 `compile()` 문법·정의 검사만 한다(아래 5절).

## 2. 키트 전용 vs 범용, 단일 블록 표 제안

### 키트 전용(로보독)
| 위치 | 내용 |
|---|---|
| `assistant.js` | `robodog.*`/`deflib.*` 문자열 전부, `COLORS/FACES/SOUNDS/SAYS` 매핑, `actionsOf`의 동작 사슬(자세·다리·춤·점프), 걷기 시간(`rotation` 72도/초 가정, `pause(1550)` 등), 본체 버튼(`getButton`)·`getTof` 거리 규칙, `EXAMPLE_HINTS`(예제 id), `CAN_DO`, `SAMPLE_REQUESTS`, 카드·카메라 안내문 |
| SYSTEM | 로봇 소개문, 두 확장의 블록 시그니처·enum·한국어 블록 이름, 실물 확인 사항(A·B 가려짐, 거리 0=못 읽음), "AI 브리지" 절 |
| UI/서버 | 문구(로보독), `/api/robodog-assistant` 경로, 환경 변수 이름 `ROBODOG_MODEL` |

### 범용(키트가 바뀌어도 거의 그대로)
- 서버: 수업 코드 게이트, 속도 제한, 오답 잠금, 입력 길이 제한, 구조화 출력(JSON schema), 거절·오류 매핑, 캐시, 폴백. 상수와 SYSTEM 문자열만 교체하면 된다.
- 규칙 엔진의 골격: 입력 검사 -> 트리거 탐지 -> 구간 분할 -> 구절 분할 -> 동작 조립 -> 꼬리 경고 -> 추천. 한국어 접속 분할 `splitPhrases`, 조사 `ro/eun`, `speedOf/secOf`.
- UI: 모드 판정, 수업 코드 칸, 폴백, `showAnswer`, 문법 검사.
- 규칙 엔진의 트리거 템플릿(버튼 토글, 라디오 수신 + 무신호 정지 + 잠금, 거리 상태 기계, 계속 걷기 10초 정지)은 "움직이는 키트" 전반에 재사용할 수 있다. 다만 이동 블록이 다르면 `walk/continuous/hasMove`를 손봐야 한다.

### 단일 블록 표 제안 (`kit.blocks.json`)
```json
{
  "kit": "robodog",
  "extensions": [{"id":"kocoafab/robodog","pin":"331dd39","mode":"wired"},
                 {"id":"kocoafab/robodog-radio","pin":"4a50d45","mode":"radio"}],
  "namespaces": [{
    "namespace": "robodog",
    "functions": [
      {"name":"move","params":[{"n":"dir","enum":"MoveDirection"},{"n":"speed","range":[0,100],"policy":"speed"}],
       "block_ko":"앞/뒤로 걷기 [방향] 속도 [속도]","kind":"action","needsStop":true},
      {"name":"bodyLed","params":[{"n":"r","range":[0,255]},{"n":"g","range":[0,255]},{"n":"b","range":[0,255]}],"block_ko":"몸통 LED"},
      {"name":"getTof","returns":"number","unit":"unverified","zeroMeans":"no_read","block_ko":"거리센서 값"}
    ],
    "enums": {"deflib.MoveDirection":[{"id":"Forward","ko":"앞으로"},{"id":"Backward","ko":"뒤로"}],
              "deflib.SoundEffect":[{"id":"Bark","ko":"멍멍","words":["짖","멍멍","왈왈"]}]}
  }],
  "forbidden": ["music.*","=>","`","class ","async "],
  "inputs": {"deviceButton":"robodog.getButton()","microbitAB":"hidden_when_mounted"},
  "policy_ref": "policy.json"
}
```
- `words`(한국어 트리거 낱말)와 `ko`(블록 이름)를 enum 항목마다 두면 `COLORS/FACES/SOUNDS/SAYS`를 이 표에서 `[RegExp(words.join('|')), id, '[ko]']`로 생성할 수 있다.
- SYSTEM의 "블록 시그니처" 절도 같은 표로 생성한다. `name(params…)  // block_ko` 한 줄, enum은 `A|B|C`, 범위는 `0~100`, 주석에 한국어 이름. 현재 손으로 쓴 문장과 표가 어긋나는 일을 막는다.
- 생성 순서는 빌드 스크립트 한 개로 한다. 표 -> (1) `assistant.vocab.js` 상수, (2) `system-blocks.txt` -> 함수의 SYSTEM에 import(esbuild가 번들), (3) 시험의 "표에 있는 모든 enum이 SYSTEM에 있고, 규칙 코드가 쓰는 모든 `ns.fn`이 표에 있다" 일치 검사.
- 새 키트에서 새로 쓰는 것: 표 + 템플릿 몇 개(`start`·`btn`·`radio`·`near`·`forever` 조립기의 키트별 본문, 걷기 한 번 `move+pause+stop` 같은 "한 동작" 패턴) + 키트 규칙 문단(실물 확인 사항) + `EXAMPLE_HINTS`/`CAN_DO`/`SAMPLE_REQUESTS`.
- `actionsOf`의 if 사슬은 표만으로는 만들 수 없다("춤", "점프" 같은 합성 동작). 표에 `macros:[{words, lines, desc}]` 항목을 두어 합성 동작도 데이터화하는 것이 좋다.

## 3. 안전·개인정보 설계

### 현재 구현
- **키**: `ANTHROPIC_API_KEY`는 Netlify 환경 변수에만 있고 브라우저로 가지 않는다.
- **수업 코드 게이트**(`ASSISTANT_CLASS_CODE`, 필수): 서버가 모든 POST에서 확인한다. 설정이 없으면 AI가 꺼지고(GET `configured:false`) 규칙 도우미만 쓴다. `sha256` + `timingSafeEqual`이며, 클라이언트는 `sessionStorage`에만 저장한다.
- **남용 방어**: IP당 1분 6회, 오답 5회/10분 잠금, 입력 600자, `currentCode` 6000자, `max_tokens` 4000. `hits`/`wrong`은 함수 인스턴스 메모리라 서버리스에서는 인스턴스마다 따로 센다(완전한 방어 아님, 문서에도 명시). 비용 상한은 Anthropic 콘솔의 월 사용 한도에 의존한다(문서에서 안내).
- **브라우저에서 나가는 텍스트**: 규칙 모드는 전혀 나가지 않는다("글은 이 컴퓨터 밖으로 나가지 않아요"). AI 모드는 학생 문장 600자와, "지금 코드 고치기" 체크 시 현재 코드 6000자가 Netlify 함수 -> Anthropic으로 간다. 이름·학교·전화번호를 쓰지 말라는 경고가 AI 모드에서만 표시된다.
  `askFix` 체크 여부로 코드 전송을 제어하므로 기본값은 "코드 안 보냄"이다. 코드 안에 학생 문자열(`showString`)이 들어 있을 수 있다는 점은 안내에 없다.
- **정책 값(속도 상한 등)의 현재 위치와 문제**: 속도 30은 `SPEED.max`(assistant.js), SYSTEM 문장 "30 이하", `docs/08` 문서에 세 번 따로 하드코딩되어 있다. 10초 자동 정지(`10000`), 라디오 무신호 2초, 거리 `20`cm 기본값, 요청 길이 300(규칙)/600(AI), 속도 제한 6/분, 오답 5회/10분도 같은 식이다.
  소유자 지침상 속도 상한 같은 정책은 교사가 정하는 값이므로 하드코딩된 결정이 아니라 설정 값이어야 한다.
- **제안: `policy.json` 한 곳**(교사가 Netlify 환경 변수 `ROBODOG_POLICY`나 레포의 파일로 조정, 기본값은 현재 값)
  ```json
  {"maxSpeed":30,"defaultSpeed":25,"autoStopMs":10000,"radioTimeoutMs":2000,
   "tofDefaultCm":20,"maxChars":{"rule":300,"ai":600},"currentCodeMax":6000,
   "rate":{"perMin":6,"wrongMax":5,"wrongWindowMs":600000}, "forbid":["music.*"]}
  ```
  규칙 엔진은 `policy`를 import해 `SPEED`를 만들고, 함수는 같은 값을 SYSTEM에 `${policy.maxSpeed}`로 끼워 넣는다. GET 응답에 공개 가능한 값(`maxSpeed`, `maxChars`)을 실어 UI 안내문도 같이 바꾼다. 학급마다 다른 값이 필요하면 수업 코드별 정책(`{코드: policy}`)도 가능하다.
- **AI 출력 후처리(제안)**: 현재 AI 출력에는 "속도 30 이하"가 프롬프트 부탁으로만 걸려 있다. 정책이 설정 값이라면 모델에 맡기지 말고 결정적 검사를 둔다.
  `lint(code, policy)`를 규칙 모드와 AI 모드가 공유하게 한다. 항목은 `move(…, N)`의 N 상한 검사(초과 시 클램프하고 경고), `move` 뒤에 `stop` 존재, `music.`·`=>`·템플릿 문자열 금지, 표에 없는 `robodog.*`/enum 거절(환각 방지), `while(true)`에 `pause` 없음, 거리 규칙에서 0 처리, 길이 상한.
  서버 단에서 실행해 `warnings`에 "코드를 N으로 줄였어요"를 덧붙이면 가장 안전하다(UI는 우회될 수 있다).

## 4. 시험 구조와 새 키트용 대응물

| 시험 | 방식 | 확인 내용 |
|---|---|---|
| `tests/rule-assistant.mjs` (약 45건, 브라우저 불필요) | `assistant.js`를 임시 `.mjs`로 복사해 import 후 `ruleAssistant(문장)` 호출, 정규식으로 코드·설명·경고 검사 | 예시 문장 5개가 코드를 만든다. 속도 30 클램프, 조사(30으로/80은), 계속 걷기 10초 정지·켜자마자 안 걸음, 어느 버튼인지 모르면 거절, 본체 버튼 `getButton`, 거리 0 멈춤·상태 변화 시만 명령·뒤로 계속 걷기 거절, 라디오 2초 무신호·잠금·핸들러 안 `pause` 금지, 화살표 함수·`` ` `` 금지, 문장 순서, 카드·색 -> AI 카메라 안내, 모르는 조각 경고, 긴 입력 거절 |
| `tests/assistant-function.mjs` (Node) | 로컬 `http` 가짜 Claude 서버 + `ANTHROPIC_BASE_URL`, `new Request()`로 핸들러 직접 호출(`{ip}` 컨텍스트 주입) | 모델 기본값, `json_schema`·`effort:low`·`fallbacks`·베타 헤더·`cache_control`·키 헤더, 수업 코드 401·공백 허용, 5회 오답 잠금(맞는 코드도 막힘), GET configured 조합, 코드 미설정 503, 600자 400, 거절/429/401 매핑, IP 속도 제한, 키 없음 503 |
| `tests/assistant-ui.js` (Playwright) | `page.route('**/api/robodog-assistant')`로 GET/POST 응답을 가짜로 대체 | 키 없음 -> 규칙 배지·칸 잠김, 생성·실행 후 `__sim.runner.press('A')`로 몸통 LED 확인, 코드 넣기, 빈 입력, Enter, 칩, AI 가능 + 코드 없음 -> POST 없음, 코드 입력 -> AI 배지, 요청 본문에 `classCode`·`currentCode` 포함, 401 -> 규칙 폴백, 편집기 모드 레이아웃 |

시험에 **없는** 것: AI 출력의 안전 검사(속도 상한 등), JSON 파싱 실패(`bad_output`), `max_tokens`, 타임아웃, `bad_request`, 프롬프트 내용 자체(SYSTEM이 블록 표와 맞는지).

### 새 키트용 대응물 작성법
1. **규칙 시험**: 키트 이름만 바꾸고 `SAMPLE_REQUESTS` 전부 + 안전 규칙마다 "하지 말아야 할 것" 부정 단언(예: 속도 `<= policy.maxSpeed`, 시작하자마자 이동 없음)을 쓴다. 표 일치 시험을 추가한다(규칙 코드의 모든 식별자가 표에 있음, SYSTEM에 표의 모든 enum이 있음).
2. **함수 시험**: 그대로 재사용하고 환경 변수·경로·기본 모델만 키트에 맞춘다. 추가로 `bad_output`(깨진 JSON), `max_tokens`, 서버 지연 모드를 가짜 서버에 넣는다.
3. **AI 출력 정책 시험**: 가짜 서버가 `move(…, 100)`·`music.playTone`·화살표 함수가 든 코드를 돌려주는 모드에서 `lint`가 클램프·거절하는지 확인한다.
4. **UI 시험**: 라우트 모킹 구조 그대로, 시뮬레이터 `__sim` 훅의 센서·LED 이름만 바꾼다. 가능하면 모든 `SAMPLE_REQUESTS`를 만든 뒤 `runCode`가 오류 없이 도는지 확인한다.
5. **실측 확인**: 새 키트 코드가 실제 MakeCode에서 컴파일되는지 시험하는 단계를 따로 둔다. 시뮬레이터 통과는 이를 보장하지 않는다.

## 5. 함정(Pitfalls)
- **모델 시간 초과**: Netlify 함수는 약 10초 제한이다. 코드가 `effort:'low'`와 Sonnet 기본값, 문서의 "실측 약 6초"로 버틴다. 클라이언트 `fetch`에 `AbortController` 타임아웃이 없어 함수가 504를 주면 `r.json()` 실패 -> `http_504`로 폴백된다. `ROBODOG_MODEL`을 Opus로 바꾸면 시간 초과가 날 수 있다. 개선안은 클라이언트 타임아웃(약 12초) + 폴백, Netlify Background Function이나 스트리밍이다. 서버에도 SDK `timeout`/`maxRetries` 설정이 없다. SDK 기본 재시도가 10초 제한을 넘길 수 있으므로 `maxRetries:0`과 짧은 `timeout`을 권한다.
- **JSON 파싱**: 구조화 출력(`json_schema`)을 쓰지만 `JSON.parse` 실패(`bad_output`)와 `max_tokens`(`too_long_output`)는 502다. UI의 이유 표에 이 코드가 없으면 일반 문구로 간다. `code` 문자열 안의 이스케이프와 줄바꿈은 스키마 덕분에 안정적이나, 폴백 모델이 다른 모델로 응답할 수 있다(`fallbacks:'default'`, 응답의 `model` 필드로 확인).
- **MakeCode에는 되고 시뮬레이터에는 안 되는 코드(또는 반대)**: UI의 `compile()`은 Babel 변환과 시뮬레이터 런타임에서 컴파일하는 것이라, MakeCode의 정적 타입 검사와 다르다. AI가 존재하지 않는 `robodog.xxx`나 enum을 만들어도 시뮬레이터는 `warnProxy`로 경고만 하고 넘어갈 수 있고, 실제 MakeCode에서 블록으로 안 바뀔 수 있다(표 기반 `lint`로 막아야 함). `Math.abs` 외 `Math.*`, 문자열 메서드, 배열 콜백, 변수 선언 위치(`let`이 최상위에만 허용) 등 MakeCode "블록 변환 가능한 JS" 한계가 있다. 시뮬레이터 `runtime.js`는 `move`를 -100~100으로만 클램프하므로 속도 30 규칙은 시뮬레이터가 지켜 주지 않는다.
- **`music.*` 충돌**: 로보독에서는 `music`이 통신 핀 P0과 겹칠 수 있어 SYSTEM이 금지하고, 시뮬레이터는 `musicWarn` 프록시로 경고만 한다(`runtime.js` l.639-640). 규칙 도우미는 `music.*`를 만들지 않으며 `lint`로 AI 출력에서도 막아야 한다.
- **정책 값 중복**: 30·10초·2초가 `assistant.js`, SYSTEM, 문서에 따로 있다(3절 `policy.json`으로 일원화).
- **규칙 엔진의 한국어 취약점**: 정규식 우선순위에 의존한다(예: `앉|누워`가 "눕다"까지 앉기로 대응, `슬퍼` -> 눈감기 대체). 신조어·오타·띄어쓰기에 약해서 "이 부분은 알아듣지 못했어요"가 많이 나올 수 있다. 시험이 이런 회귀를 막는다. 새 동작을 넣으면 같은 구절의 다른 규칙과 겹치는지(`at` 정렬, `else if` 순서) 확인한다.
- **규칙 모드는 "코드 고치기"를 못 한다**: `askFix`는 AI에서만 효과가 있고 UI에 그런 안내가 없다.
- **IP 속도 제한의 한계**: 서버리스 인스턴스별 메모리라 분산되면 우회된다. 교실 NAT(한 IP에 학생 다수)에서는 오히려 6회/분이 모자라 정당한 사용자를 막을 수 있다(정책 값으로 노출 필요). 오답 잠금도 같은 IP의 학생 전체에 영향을 준다.
- **프라이버시 문구**: 개인정보 경고는 AI 모드에서만 나온다. 고치기 모드에서 코드가 전송된다는 점과 로그·보관 정책(Anthropic 쪽)은 교사 안내문에 추가하는 것이 좋다.
- **프롬프트-규칙 불일치**: SYSTEM의 "A·B는 쓰지 않음(본체 버튼)" 규칙과 규칙 엔진의 동작은 같은 문서에서 나왔지만 따로 구현되어 있어 한쪽만 고치면 어긋난다(표 + 정책 일원화의 근거).
- **MakeCode 확장 버전 고정**: 문서에 유선 `331dd39`, 무선 `4a50d45`로 고정되어 있다. 블록 표는 이 버전에 묶어 두어야 하며, 확장이 바뀌면 표 재생성과 시험 재실행이 필요하다.
