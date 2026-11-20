# 자동 시험

Playwright(크로미움)가 필요합니다.

| 스크립트 | 내용 | 실행 |
|---|---|---|
| `bridge-e2e.js` | 가짜 카메라·가짜 Web Serial로 AI 브리지 전 과정(27항목) | `cd bridge && python3 -m http.server 8765` 후 `node tests/bridge-e2e.js` |
| `ai-sim-link.js` | AI 브리지 ↔ 로보독 시뮬레이터 같은 컴퓨터 연결: 인식 전엔 0을 안 보냄, 탭 가림(0) 안내(5항목) | `cd bridge && python3 -m http.server 8765` 후 `node tests/ai-sim-link.js` |
| `model-compat.js` | 동봉 모델과 TF Hub 대체 모델의 특징값 일치 | 위 서버 실행 후 `node tests/model-compat.js` |
| `sim-e2e.js` | 시뮬레이터 51항목(예제·시연, 걷기·회전 수치, 자세, 공식 다리 표본, 라디오 감시·잠금, 장애물, 추락, 무한 반복, 경고, 3D, AI 브리지 연동, 좁은 화면, MakeCode 편집기 연동) | 위 서버 실행 후 `node tests/sim-e2e.js` |
| `assistant-ui.js` | 로보독 도우미 화면 25항목(규칙 도우미, AI 응답·실패 시 전환, 빈 입력·오류 안내, 편집기 화면 배치) — AI 서버 응답은 가짜로 대신 | 위 서버 실행 후 `node tests/assistant-ui.js` |
| `rule-assistant.mjs` | 규칙 도우미 안전 규칙 50항목(속도 30, 계속 걷기 자동 멈춤, 거리 0 멈춤, 라디오 2초 감시, 모르는 버튼 거절 등) | `node tests/rule-assistant.mjs` |
| `intro-docs.js` | 첫 화면 44항목(인트로 영상 자동 재생·자막·건너뛰기·다시 보기·엔딩 정지 화면·움직임 줄이기·영상 못 받을 때·화면 크기별 시작 카드·공유 미리보기)과 수업 자료 페이지(링크·내려받기·인쇄) | 위 서버 실행 후 `node tests/intro-docs.js` |
| `physical-ai-intro.js` | 사이트 첫 화면(교구 선택) 인트로 'Physical AI with micro:bit' 25항목(미리 보기 시각별 장면·결정성, 전체 화면 재생→건너뛰기·Esc→카드, 카드 자리 고정, 다시 보기, 같은 탭 재방문·움직임 줄이기 정지 로고, 390px, 카드 링크·포니봇 공식 그림, mp4) | 위 서버 실행 후 `node tests/physical-ai-intro.js` |
| `assistant-function.mjs` | 도우미 서버 함수 23항목(가짜 Claude API 서버, 요금 없음) | `node tests/assistant-function.mjs` |
| `ponybot-assistant-function.mjs` | 포니봇 도우미 서버 함수 29항목(가짜 Claude API 서버, 요금 없음): 같은 키·수업 코드 게이트, 블록 표에서 만든 프롬프트, AI 코드 서버 재검사(없는 블록·범위 밖 → 422) | `node tests/ponybot-assistant-function.mjs` |
| `lessons-web.js` | 웹 슬라이드 뷰어 98항목(목록·넘기기·교사 모드·함께 보기·휴대폰) | 위 서버 실행 후 `node tests/lessons-web.js` |
| `lesson-sync.js` | 슬라이드 함께 보기(교사 → 학생 화면 따라가기) 19항목 | 위 서버 실행 후 `node tests/lesson-sync.js` |
| `sim-layout.js` · `sim-devices.js` · `sim-examples.js` | 시뮬레이터 화면 배치 7 · 장치(버튼·센서) 17 · 예제 28항목 | 위 서버 실행 후 각각 `node tests/<이름>.js` |
| `ponybot-sim.js` | 포니봇(통합 시뮬레이터 `/sim/?kit=ponybot`) 73항목(메카넘 앞·옆·대각선·회전 수치, 거리 500=못 읽음, 라인·색 센서, 예제 7개, 지도·편집기, 도우미 코드 실행, 390px) — 서버를 스스로 띄움 | `node tests/ponybot-sim.js` |
| (도구) `tools/render-ponybot-intro.js` | 포니봇 인트로 영상(`bridge/ponybot/assets/intro.mp4`, 20초)을 `bridge/ponybot/intro/intro.js`에서 다시 굽기. `INTRO_TEST=1`이면 몇 장만 | 서버 실행 후 `node tools/render-ponybot-intro.js` |
| `ponybot-say.js` | 포니봇 '말로 코드 만들기' 예시 2가지 + AI 모드 17항목: 문장(`?say=1·2`) → 규칙 도우미 코드 → 시뮬레이터에서 실제 움직임(옆으로 주차·대각선 / 선 따라가다 초록에서 쉬고 빨강에서 멈춤·앞이 막히면 기다림), AI 모드(가짜 서버 응답: 수업 코드·AI 코드 표시·검사 실패 시 규칙 도우미) | 서버 실행 후 `node tests/ponybot-say.js` |
| `ponybot-stop500.js` | 포니봇 '피하고 계속 가' 코드: 피한 뒤 앞이 트이면 거리 500(못 읽음)으로 코드대로 멈추고, 시뮬레이터가 멈춘 이유를 한 번 알려 줌 5항목 | 서버 실행 후 `node tests/ponybot-stop500.js` |
| `ponybot-bluetooth.js` | 포니봇 블루투스 예제(05, 제조사 예제의 ID45→ID5 고친 것): `?ex=` 열기, 🔵 블루투스 줄로 ID2·ID5·stop 보내 움직임 확인, OLED data, MakeCode 프로젝트에 bluetooth(라디오 빼고) 8항목 | 서버 실행 후 `node tests/ponybot-bluetooth.js` |
| `sim-arrow.js` | `basic.showArrow` 8방향(포니봇·로보독) 11항목 | 서버 실행 후 `node tests/sim-arrow.js` |
| `ponybot-trip.js` | 포니봇 센서 칸 '이동 거리'·'작동 시간'과 멈춘 뒤 요약(평균 cm/초) 6항목 | 서버 실행 후 `node tests/ponybot-trip.js` |
| `lessons-go.js` | 수업 슬라이드 '바로 가기' 단추: 다운로드·앱 열기를 시키는 장마다 단추가 있고, 시뮬레이터 예제·미션·AI 브리지·웹앱이 실제로 열림(4개 수업) | 서버 실행 후 `node tests/lessons-go.js` |
| `brand-icons.js` | 페이지마다 머리글 로고·탭 아이콘(메인·포니봇·로보독) 10항목 | 서버 실행 후 `node tests/brand-icons.js` |
| `ponybot-mission-fold.js` | 미션 칸 접기: 펼친 칸은 코드 위를 덮지 않고, 블록 편집기를 누르면 한 줄로 접힘·[펼치기] 6항목 | 서버 실행 후 `node tests/ponybot-mission-fold.js` |
| `ponybot-3d-microbit.js` | 포니봇 3D: 꽂힌 마이크로비트 5×5 LED가 코드 화면과 같고 거울 반전 없음 6항목 | 서버 실행 후 `node tests/ponybot-3d-microbit.js` |
| `sim-howto-fold.js` | 따라 하기 칸 접기(로보독·포니봇): 블록 편집기를 누르면 한 줄로·[펼치기] 7항목 | 서버 실행 후 `node tests/sim-howto-fold.js` |
| `bridge-mbcode.js` | 로보독 AI 브리지 '마이크로비트 코드 받기'(USB 수신기·로보독 코드 복사·파일·시뮬레이터 `?ex=` 열기, 포니봇에서는 숨김) 9항목 | 서버 실행 후 `node tests/bridge-mbcode.js` |
| `ponybot-mission.js` | 포니봇 미션(행동 판정) 5개·39항목: 처음 코드·'그럴듯하지만 행동이 다른 코드'는 통과 못 함, 고친 코드는 통과, 예상 공개 시점, 도움말 단계, 통과 기록이 슬라이드에 표시, 돌아가기 주소 제한, 이야기·퀴즈 장 | 서버 실행 후 `node tests/ponybot-mission.js` |
| `sim-responsive.js` | 시뮬레이터 반응형: 좁은 화면(iPhone·iPad 세로)에서 무대가 편집기와 함께 보임·무대 높이 상한, 넓은 화면(PC·전자칠판·iPad 가로)에서 무대 고정·1600px 이상 확대, 실행·정지·처음으로 한 줄, 가로 넘침 없음, 터치 44px, `?ex=` 예제 선택 표시·모르는 id 안내 | Range 지원 서버 후 `node tests/sim-responsive.js` |
| `ponybot-view.js` | (620·800px 한 줄 구성 포함) 포니봇 시뮬레이터 화면 구성(한 화면: 위쪽 3D·2D − ＋ 전체 로봇 따라가기 한 줄 / 라디오 0~9 / [마이크로비트·OLED] / [센서·바퀴 명령])·2D 휠 확대·오른쪽 버튼 이동(페이지 스크롤 없음)·3D 확대/축소·선 닫기(시작점 누르기·단추)·편집 도구 접이식 위치 25항목 | Range 지원 서버(`node .claude/skills/microbit-kit-site/scripts/rangeserve.js bridge 8765`) 후 `node tests/ponybot-view.js` |
| `sim-unified.js` | 교구 고르기 시험: 옛 `/ponybot/sim/` 넘김, 두 교구 화면 요소·오류 0·390px, 실행 뒤 입력 안내(A 버튼·라디오·본체 버튼)와 눌렀을 때 움직임, 진짜 MakeCode 편집기에서 포니봇 예제 7개가 블록으로 보임(인터넷 필요, `--no-makecode` 로 건너뜀) — 서버를 스스로 띄움 | `node tests/sim-unified.js` |
| `ponybot-assistant.mjs` | 포니봇 말로 코드 만들기 94항목(블록 표 검사·범위 밖 자르기·정책 null=한도 없음·모르는 말 경고·프롬프트 생성·복사본 동기) | `node tests/ponybot-assistant.mjs` |
| `sim-compare.js` · `sim-dance-shots.js` | 2D·3D 비교, 춤 동작 화면 캡처(육안 확인) | 위 서버 실행 후 |
| `sim-shots.js` | 3D 자세 화면 캡처(육안 확인) | `node tests/sim-shots.js` |
| `build-sim-examples.js` | `makecode/*.ts` → `bridge/sim/examples.js` 생성 | 예제를 고친 뒤 실행 |
| `makecode-blocks.js` | 실제 makecode.microbit.org에서 확장 추가 → JS 붙여넣기 → 블록 변환 확인 | `node tests/makecode-blocks.js makecode/03_ai-traffic-dog.ts ext` (00번은 `ext` 없이) |

※ 영상 탐색이 필요한 `intro-docs.js`는 Range 요청을 지원하는 서버에서 돌려야 합니다(`python3 -m http.server`는 안 됨 — 운영 주소를 넣어 `node tests/intro-docs.js https://microbit-bridge.netlify.app/` 로 돌려도 됩니다). 여러 시험을 동시에 돌리면 CPU 부하로 시간에 민감한 항목이 가끔 실패하니 하나씩 돌리세요.
