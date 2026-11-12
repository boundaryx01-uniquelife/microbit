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
| `physical-ai-intro.js` | 사이트 첫 화면(교구 선택) 인트로 'Physical AI with micro:bit' 25항목(미리 보기 시각별 장면·결정성, 전체 화면 재생→건너뛰기·Esc→카드, 카드 자리 고정, 다시 보기, 같은 탭 재방문·움직임 줄이기 정지 로고, 390px, 카드 링크·포니봇 공식 그림, mp4) | 위 서버 실행 후 `node tests/physical-ai-intro.js` |
| `assistant-function.mjs` | 도우미 서버 함수 23항목(가짜 Claude API 서버, 요금 없음) | `node tests/assistant-function.mjs` |
| `lessons-web.js` | 웹 슬라이드 뷰어 87항목(목록·넘기기·교사 모드·함께 보기·휴대폰) | 위 서버 실행 후 `node tests/lessons-web.js` |
| `lesson-sync.js` | 슬라이드 함께 보기(교사 → 학생 화면 따라가기) 19항목 | 위 서버 실행 후 `node tests/lesson-sync.js` |
| `sim-layout.js` · `sim-devices.js` · `sim-examples.js` | 시뮬레이터 화면 배치 7 · 장치(버튼·센서) 17 · 예제 28항목 | 위 서버 실행 후 각각 `node tests/<이름>.js` |
| `ponybot-sim.js` | 포니봇(통합 시뮬레이터 `/sim/?kit=ponybot`) 73항목(메카넘 앞·옆·대각선·회전 수치, 거리 500=못 읽음, 라인·색 센서, 예제 7개, 지도·편집기, 도우미 코드 실행, 390px) — 서버를 스스로 띄움 | `node tests/ponybot-sim.js` |
| `ponybot-view.js` | 포니봇 시뮬레이터 화면 구성(한 화면: 위쪽 3D·2D − ＋ 전체 로봇 따라가기 한 줄 / 라디오 0~9 / [마이크로비트·OLED] / [센서·바퀴 명령])·2D 휠 확대·오른쪽 버튼 이동(페이지 스크롤 없음)·3D 확대/축소·선 닫기(시작점 누르기·단추)·편집 도구 접이식 위치 25항목 | Range 지원 서버(`node .claude/skills/microbit-kit-site/scripts/rangeserve.js bridge 8765`) 후 `node tests/ponybot-view.js` |
| `sim-unified.js` | 교구 고르기 시험: 옛 `/ponybot/sim/` 넘김, 두 교구 화면 요소·오류 0·390px, 실행 뒤 입력 안내(A 버튼·라디오·본체 버튼)와 눌렀을 때 움직임, 진짜 MakeCode 편집기에서 포니봇 예제 7개가 블록으로 보임(인터넷 필요, `--no-makecode` 로 건너뜀) — 서버를 스스로 띄움 | `node tests/sim-unified.js` |
| `ponybot-assistant.mjs` | 포니봇 말로 코드 만들기 76항목(블록 표 검사·범위 밖 자르기·정책 null=한도 없음·모르는 말 경고·프롬프트 생성·복사본 동기) | `node tests/ponybot-assistant.mjs` |
| `sim-compare.js` · `sim-dance-shots.js` | 2D·3D 비교, 춤 동작 화면 캡처(육안 확인) | 위 서버 실행 후 |
| `sim-shots.js` | 3D 자세 화면 캡처(육안 확인) | `node tests/sim-shots.js` |
| `build-sim-examples.js` | `makecode/*.ts` → `bridge/sim/examples.js` 생성 | 예제를 고친 뒤 실행 |
| `makecode-blocks.js` | 실제 makecode.microbit.org에서 확장 추가 → JS 붙여넣기 → 블록 변환 확인 | `node tests/makecode-blocks.js makecode/03_ai-traffic-dog.ts ext` (00번은 `ext` 없이) |

※ 영상 탐색이 필요한 `intro-docs.js`는 Range 요청을 지원하는 서버에서 돌려야 합니다(`python3 -m http.server`는 안 됨 — 운영 주소를 넣어 `node tests/intro-docs.js https://microbit-bridge.netlify.app/` 로 돌려도 됩니다). 여러 시험을 동시에 돌리면 CPU 부하로 시간에 민감한 항목이 가끔 실패하니 하나씩 돌리세요.
