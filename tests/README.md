# 자동 시험

Playwright(크로미움)가 필요합니다.

| 스크립트 | 내용 | 실행 |
|---|---|---|
| `bridge-e2e.js` | 가짜 카메라·가짜 Web Serial로 AI 브리지 전 과정(27항목) | `cd bridge && python3 -m http.server 8765` 후 `node tests/bridge-e2e.js` |
| `model-compat.js` | 동봉 모델과 TF Hub 대체 모델의 특징값 일치 | 위 서버 실행 후 `node tests/model-compat.js` |
| `sim-e2e.js` | 시뮬레이터 51항목(예제·시연, 걷기·회전 수치, 자세, 공식 다리 표본, 라디오 감시·잠금, 장애물, 추락, 무한 반복, 경고, 3D, AI 브리지 연동, 좁은 화면, MakeCode 편집기 연동) | 위 서버 실행 후 `node tests/sim-e2e.js` |
| `assistant-ui.js` | 로보독 도우미 화면 25항목(규칙 도우미, AI 응답·실패 시 전환, 빈 입력·오류 안내, 편집기 화면 배치) — AI 서버 응답은 가짜로 대신 | 위 서버 실행 후 `node tests/assistant-ui.js` |
| `rule-assistant.mjs` | 규칙 도우미 안전 규칙 50항목(속도 30, 계속 걷기 자동 멈춤, 거리 0 멈춤, 라디오 2초 감시, 모르는 버튼 거절 등) | `node tests/rule-assistant.mjs` |
| `intro-docs.js` | 첫 화면 44항목(인트로 영상 자동 재생·자막·건너뛰기·다시 보기·엔딩 정지 화면·움직임 줄이기·영상 못 받을 때·화면 크기별 시작 카드·공유 미리보기)과 수업 자료 페이지(링크·내려받기·인쇄) | 위 서버 실행 후 `node tests/intro-docs.js` |
| `assistant-function.mjs` | 도우미 서버 함수 23항목(가짜 Claude API 서버, 요금 없음) | `node tests/assistant-function.mjs` |
| `lessons-web.js` | 웹 슬라이드 뷰어 87항목(목록·넘기기·교사 모드·함께 보기·휴대폰) | 위 서버 실행 후 `node tests/lessons-web.js` |
| `lesson-sync.js` | 슬라이드 함께 보기(교사 → 학생 화면 따라가기) 19항목 | 위 서버 실행 후 `node tests/lesson-sync.js` |
| `sim-layout.js` · `sim-devices.js` · `sim-examples.js` | 시뮬레이터 화면 배치 7 · 장치(버튼·센서) 17 · 예제 28항목 | 위 서버 실행 후 각각 `node tests/<이름>.js` |
| `sim-compare.js` · `sim-dance-shots.js` | 2D·3D 비교, 춤 동작 화면 캡처(육안 확인) | 위 서버 실행 후 |
| `sim-shots.js` | 3D 자세 화면 캡처(육안 확인) | `node tests/sim-shots.js` |
| `build-sim-examples.js` | `makecode/*.ts` → `bridge/sim/examples.js` 생성 | 예제를 고친 뒤 실행 |
| `makecode-blocks.js` | 실제 makecode.microbit.org에서 확장 추가 → JS 붙여넣기 → 블록 변환 확인 | `node tests/makecode-blocks.js makecode/03_ai-traffic-dog.ts ext` (00번은 `ext` 없이) |

※ 영상 탐색이 필요한 `intro-docs.js`는 Range 요청을 지원하는 서버에서 돌려야 합니다(`python3 -m http.server`는 안 됨 — 운영 주소를 넣어 `node tests/intro-docs.js https://microbit-bridge.netlify.app/` 로 돌려도 됩니다). 여러 시험을 동시에 돌리면 CPU 부하로 시간에 민감한 항목이 가끔 실패하니 하나씩 돌리세요.
