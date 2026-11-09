# 키트 교체 대비 인벤토리 (kit-specific vs kit-agnostic)
기준: /home/user/microbit (git ls-files). 키트 = 빅아이 로보독(코코아팹), 확장 `kocoafab/robodog`(유선, 로봇 등에 꽂음) + `kocoafab/robodog-radio`(무선·AI카메라).

## 1. 영역별 표
| 영역 | 핵심 파일 | 키트 종속 | 무엇이 종속인가 | 노력 |
|---|---|---|---|---|
| AI 브리지(웹캠 분류→USB 시리얼) | bridge/ai.html, bridge/lib/*(tf, mobilenet, knn), bridge/model/* | no | 0~9 숫자 한 줄을 115200bps 시리얼(vendor 0x0d28)로 송신. 로봇 무관. (문구 "로보독"만 소량) | S |
| 라디오 프로토콜/수신기 | makecode/00_bridge-receiver.ts | partly | 프로토콜(시리얼 숫자 0~9→radio.sendNumber, 그룹번호, A=멈춤잠금)은 재사용. 주석의 "로보독 확장 넣지 마세요(P0/P1 시리얼 충돌)"는 키트 확장별 점검 필요. 숫자 의미(1빨강 2노랑 3초록 4배경, 0=정지)는 수업 약속 | S |
| MakeCode 예제 | makecode/*.ts 16개(00~23), bridge/docs/makecode/ 사본 | yes | 주석 `확장: kocoafab/robodog`, `robodog.gesture/move/stop/rotation/legBend/leg/motor/headLedExp/headLedPrint/bodyLed/soundPlay/getButton/getTof/getBattery/getTilt/getRotation/rfBand/aiDetection/...`, `deflib.Posture/MoveDirection/LedExpression/SoundEffect`, 속도 30 이하, 본체 버튼(A·B 가려짐), 눈 8x8 LED, 몸통 RGB. 구조(순차/반복/조건/라디오)는 재사용 | L |
| 시뮬: 런타임 | bridge/sim/runtime.js(682줄): `makeRobodogApi`, `Robot`, `World`, `Runner`, `EST`, `ASYNC_NS`, EXPRESSIONS/ICONS/EYE_*(8x8), SOUNDS, LEG_NAMES/LEG_SEL | partly | 인터프리터·Runner·World·폰트·micro:bit 5x5 LED·음 재생은 재사용. `makeRobodogApi` 전체, `ASYNC_NS`의 'robodog', EYE_* 눈 비트맵, EXPRESSIONS 14종, 4다리 인덱스, `EST`(walkCmPerSecAt100=15, turnDegPerSecAt100=120, servoDegPerSec=450, tofMax=255, radius=7) | M~L |
| 시뮬: 운동학 | bridge/sim/legs.js(99줄) | yes | 다리 4개, `PX`/`CM_PER_PX=0.045`/`GEOM`(몸 12.2cm, 윗다리 4.1, 아랫다리 4.9), `HEAD`, SAMPLES(높이·발끝→어깨·무릎 실측표), SPECIAL_REACH_CURVES, 각도 범위(어깨 ±90, 무릎 -90~70) | L (새 로봇은 새 운동학) |
| 시뮬: 3D 모델 | bridge/sim/view3d.js(307), lib/OrbitControls.js, lib/babel.min.js, bridge/samples3d.js(808줄, 로보독 3D 샘플) | yes(three 틀은 no) | 알약형 머리·몸통·4다리 메시, 카메라 위치(앞 -z 사선). three/Orbit/ babel은 재사용 | L |
| 시뮬: 2D 뷰 | bridge/sim/view2d.js(189) | partly | 위에서 본 몸통·다리, "로보독 얼굴"(LED 판 2개+카메라+거리센서 창, 정면 기준), 추락 배너 문구 | M |
| 시뮬: 장치 | bridge/sim/devices.js(56) | partly | `DEVICE_INFO`(재사용), `detectDevices` 정규식이 robodog.getTof/getButton/getBattery/getTilt/soundPlay/aiDetection… 에 묶임, `radioCard` 색 약속(1~4), 문구 "로보독 본체 버튼" | S~M |
| 블록→API 매핑 | bridge/sim/examples.js(250줄, 생성물), tests/build-sim-examples.js(makecode/*.ts→examples.js), runtime.js `compile()`(Babel 변환, `ASYNC_NS`로 await 삽입) | partly | 변환 틀·생성기 재사용. 매핑 대상(`robodog.*`, `deflib.*` enum 숫자: Posture 0~4, LegGroup 0~4, LegSelection 0~8 등)과 예제 목록이 키트 종속. `legBend`는 mapRange(0~100→20~90) 같은 값 변환 포함 | M |
| 도우미 규칙 엔진 | bridge/sim/assistant.js(353): `ruleAssistant`, `SPEED={default25,fast30,slow15,max30}`, COLORS/FACES/SOUNDS/SAYS, `CAN_DO`, `EXAMPLE_HINTS`, `SAMPLE_REQUESTS`, `askAi` | partly | 로직(문장 분리·TRIGGERS·안전 클램프·거리0 멈춤·라디오 2초 감시)은 재사용. 코드 생성 템플릿이 robodog.* 호출, 속도 30 한도, 본체 버튼 규칙, 동작 어휘(앉기·인사·물구나무·기지개), 파란/초록 몸통 LED·눈 표정 | M |
| 도우미 서버 함수 | netlify/functions/robodog-assistant.mjs(156): `SYSTEM` 프롬프트, `MODEL`(env ROBODOG_MODEL, 기본 claude-sonnet-5-5), ANTHROPIC_API_KEY | partly | SYSTEM 프롬프트의 블록 문법 전문(kocoafab/robodog 2.0.1·robodog-radio 소스 발췌), 안전 규칙(속도 30, 모든 이동 뒤 stop, music.* 금지(통신 핀 충돌), 거리센서 0=못 읽음, rfBand/그룹14), 한국어 블록명 표기. 요청/응답 JSON·오류 처리·모델 선택은 재사용. 함수 이름 자체가 robodog-assistant | M |
| 수업 데이터 JSON | bridge/lessons/data/{2차시,4차시,8차시,예제,index}.json, SCHEMA.md, lessons/viewer.js·assets(35 PNG) | partly | 스키마·뷰어는 재사용(no). 내용(로보독 소개, 코드 블록, 스크린샷, "본체 버튼" 지시)은 키트 종속; 8차시.json 111, 4차시.json 78회 언급. 이미지 PNG는 로봇 사진·MakeCode 화면 포함 | L(내용) |
| 문서 md→html | docs/00~10_*.md, tools/build-docs.mjs(136), bridge/docs/*.html(생성물), docs/img | partly | 빌더 재사용. 푸터·헤더 "코코아팹 협력/빅아이 로보독은 코코아팹의 제품" 상수, 09 예제 따라하기, 10 블록 한눈표(robodog 블록 표), 08 시뮬 안내 | M |
| 슬라이드/PPT | tools/build-slides.mjs(507), lessons/data/*.json, materials/<pkg>/ (pptx·docx·spec.md), materials/8차시_전체형/build/teacher.js | partly | 빌더·스키마 재사용(키트 어휘 거의 없음). materials 하위 docx/spec.md는 키트 본문(spec.md 157+90+41줄) | M |
| 아이콘/브랜드/로고 | bridge/assets/{brand.css,favicon.svg,logo.svg,fonts/pretendard*}, bridge/NOTICE.md, sim/lib/LICENSE-robodog-MIT.txt | partly | brand.css 토큰·Pretendard는 재사용. logo/favicon(로보독 얼굴)과 NOTICE(코코아팹 MIT 출처·상표 고지) 교체 | S |
| 인트로 영상/스토리 | bridge/index.html, ending.js, intro-logo.html, veo.html, assets/intro/{intro.mp4,og.png,veo-last.webp}, assets/story/* | yes | "로보독의 첫 산책" 서사, 8x8 LED 눈 엔딩 애니, 알약형 머리, og 메타·alt, Veo 영상. 다른 키트 = 전면 재제작(없으면 생략 가능) | L |
| 시험 | tests/*.js·*.mjs 18개, tests/mc/*.png | partly | e2e 틀·Playwright 도우미·레이아웃/브리지/뷰어/싱크 시험은 재사용. sim-e2e(걷기·회전 수치, 공식 다리 표본), rule-assistant(속도 30, 거리 0), assistant-function, sim-examples, makecode-blocks(확장 URL), sim-dance-shots는 키트 종속. tests/README.md 표의 숫자 갱신 | M |
| Netlify 설정 | netlify.toml, package.json(name robodog-microbit-ai), netlify/functions/lesson-sync.mjs | mostly no | publish=bridge, Permissions-Policy(serial/usb/camera), CSP-Report-Only(makecode.microbit.org·tfhub), 캐시 헤더는 재사용. 사이트 이름·함수 이름·주석만 교체. lesson-sync는 무관 | S |

## 2. 키워드 결합도 (git ls-files 대상, 파일 수 / 총 줄 수)
| 키워드 | 파일 수 | 줄 수 | 폴더별 파일 수 |
|---|---|---|---|
| robodog | 84 | 843 | bridge 39, makecode 15, docs 10, tests 9, materials 5, README/netlify/netlify.toml/package.json/package-lock.json/tools 각 1 |
| 로보독 | 97 | 1409 | bridge 50, makecode 15, docs 11, tests 8, materials 7, tools 3, README/netlify/netlify.toml 각 1 |
| kocoafab | 55 | 102 | bridge 28, makecode 11, docs 10, tests 1, materials 2, README/netlify/tools 각 1 |
| 코코아팹 | 36 | 77 | bridge 25, docs 4, materials 2, makecode 1, tests 1, README/netlify/tools 각 1 |
| 빅아이 | 24 | 39 | bridge 19, docs 2, README/netlify/tools 각 1 |
(파일 수 = 위 폴더별 합. 파일 수는 grep -l, 줄 수는 grep -I 일치 줄.)
- 5개 키워드 중 하나라도 있는 파일 중 bridge/docs 제외 시: makecode 16, tests 12, docs 11, bridge/sim 9, materials 7, bridge/lessons 7, tools 3, 루트 설정 3, 그 외 bridge 루트(index, ai, veo, intro-logo, ending, samples3d, NOTICE, assets) 8.
- 줄 수 상위: materials/8차시_전체형/spec.md 157, lessons/data/8차시.json 111, 4차시/spec.md 90, bridge/docs/10.html 90(=docs/10_블록_한눈표.md 64), lessons/4차시.json 78, sim/assistant.js 53, sim/index.html 48, sim/examples.js 47, netlify/functions/robodog-assistant.mjs 34, view/3d samples3d.js 31.
- 해석: 결합은 "넓게 얕게". 결정적 위치는 소수(runtime.js makeRobodogApi, legs.js, view3d/samples3d, assistant.js, 서버 SYSTEM, makecode/*.ts)이고, 나머지는 브랜드 문구. 생성물(bridge/docs/*.html, sim/examples.js, bridge/docs/makecode/*)이 중복 집계에 포함됨 -> 원본은 docs/*.md, makecode/*.ts.

## 3. kit/ 설정 폴더 제안
```
kit/
  kit.json        name·slug·한글명, vendor·상표 고지, MakeCode 확장 id(wired/radio), 마이크로비트 장착(등/가려진 버튼), 카피 상수
  api.json        블록 표: 한글 블록명 ↔ JS 호출 ↔ 인자 범위 ↔ 시뮬 핸들러 ↔ enum 값(deflib.*)
  safety.json     속도 한도(30), 책상 위 규칙, stop 의무, 거리 0 처리, 통신 핀 충돌 금지 API, 라디오 감시 시간
  sim.json        관절·다리 수, 링크 길이, 각도 범위, EST 상수, 거리센서 위치·최대값, 지원 센서/장치 목록
  sim/            운동학 표본(SAMPLES), 3D 메시 생성 모듈, 2D 얼굴 렌더러 (플러그인 인터페이스: pose(), draw2d(), build3d())
  brand.json      색 토큰, 마스코트·로고 SVG, 폰트, og 이미지, NOTICE
  examples.json   예제 id·순서·필요 장치·학년 수준 -> makecode/*.ts 와 sim/examples.js 생성
  prompts/        assistant SYSTEM 프롬프트 템플릿(api.json·safety.json 에서 생성), 규칙 엔진 동사 어휘표
  lessons/        차시 JSON 틀(키트 어휘 치환 변수)
```
목표: `kit/` 채움 + 생성 스크립트(build-sim-examples, build-docs, build-slides, 프롬프트 생성) 재실행 = 새 키트 사이트. 선행 작업은 runtime.js의 `makeRobodogApi`/Robot을 api.json 구동 어댑터로, 규칙 엔진 템플릿을 api.json 참조로 분리하는 것.

## 4. 새 키트 접수 체크리스트
1. 이름: 제품명·한글 표기·벤더·판매처·교육 연계 가능 여부, 로고/상표 사용 허락, 라이선스(확장이 MIT인지).
2. MakeCode: 확장 GitHub 주소·버전, 전체 블록·JS 목록(블록 한글명·인자 범위·enum), 유선/무선 확장 분리 여부, 마이크로비트 v1/v2·장착 방식.
3. 통신: 블록 시리얼/핀 점유(PC USB 시리얼 충돌 여부), 라디오 그룹·밴드 설정 방법, 센서·카메라 값 형식과 범위·단위.
4. 하드웨어 구성: 바퀴/다리 수, 구동 방식(차동, 서보), 관절 범위, 치수(몸·링크·바퀴), 무게, 속도 실측(속도 100일 때 cm/s, 회전 °/s), 안전 속도.
5. 입출력: 내장 버튼(위치·가림 여부), LED(종류·해상도·위치), 소리, 거리/라인/색 센서, 배터리, 카메라 유무.
6. 안전·환경: 책상 위 사용 가능 여부, 추락/충돌 대책, 정지 규칙, 센서 오류값 의미(예: 0), 교실 환경(와이파이·카메라·USB 권한).
7. 수업: 대상 학년·차시 수·시수, 달성 목표, 기존 교안·활동지 유무, 필수 활동(AI 인식 대상: 카드·색·얼굴·QR 등).
8. 자산: 제품 사진(정면·측면·위), 3D/CAD 또는 공식 시뮬레이터 링크, 홍보 영상, 매뉴얼, 브랜드 색.
9. 배포: 도메인·Netlify 계정, Claude API 키 사용 정책과 모델·예산, 도우미 사용 여부.
10. 검증: 실물 1대 확보 여부(블록 변환·동작 확인), 실측 요청 가능 항목(관절 표본, 거리값).
