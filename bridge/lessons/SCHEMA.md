# 수업 슬라이드 데이터 형식 (한 원본 → 웹 슬라이드 + PPT)

슬라이드 내용은 `bridge/lessons/data/<id>.json` 한 곳에만 씁니다.
- 웹: `bridge/lessons/index.html?l=<id>` 가 이 파일을 읽어 보여 줌(학생은 같이 보기, 교사 모드는 노트 표시)
- PPT: `node tools/build-slides.mjs` 가 같은 파일로 `materials/<pkg>/<id>_수업슬라이드.pptx` 를 만듦
이미지는 `bridge/lessons/assets/` 의 PNG 파일 이름(확장자 없이)으로 가리킵니다.

## 파일 전체
```json
{
  "id": "2차시",                      // 주소에 쓰는 이름 (파일 이름과 같게)
  "title": "2차시 소개형 — AI가 보고, 로봇이 움직여요",
  "pkg": "2차시_소개형",              // materials/ 아래 폴더 이름
  "target": "초등 5~6학년 · 40분 × 2",
  "chapters": [ { "n": 1, "title": "로보독을 만나요" }, { "n": 2, "title": "AI 신호등 안내견" } ],
  "slides": [ { "ch": 1, "type": "cover", ... , "notes": "..." } ]
}
```

## 공통 필드 (모든 슬라이드)
- `ch` (숫자): 패키지 안에서 몇 교시인지. 바닥글 "{패키지 짧은 이름} · {ch}교시"(예: "2차시 소개형 · 1교시", 제목의 " — " 앞부분), 제목 위 오른쪽 머리표 "{ch}교시 · 장 안 순서/장 전체"(cover 제외). cover 의 `sub` 는 "2차시 소개형 · 1교시" 형식
- `type`: 아래 형식 중 하나
- `title`: 화면 제목 (cover 는 큰 제목)
- `notes`: 교사 대본. 형식 `[시간] 발문: … / 예상 답: … / 진행: … / 주의: …` (웹 교사 모드·PPT 발표자 노트)
- 글은 초등 5~6학년 눈높이, 한 화면 한 메시지, 영어 코드 이름 쓰지 않기(필요하면 블록 이름을 한국어로).

색 이름(`color`): `blue`(#2456E5) `red`(#E5484D) `yellow`(#F2B300) `green`(#1FA463) `orange`(#F08A24) `gray`(#7A8499) `ink`(#111827)

## 형식
| type | 필드 | 모양 |
|---|---|---|
| `cover` | `title`, `sub`, `image` | 파란 바탕 표지, 오른쪽 그림 |
| `goals` | `title`(기본 "오늘의 목표"), `items`: [문장] | 번호 붙은 큰 줄 2~4개 |
| `points` | `title`, `items`: [{`text`, `sub`?, `badge`?, `color`?}], `image`?, `imageSide`?("left"/"right", 기본 right), `footer`? | 번호(또는 badge 글자) 원 + 굵은 글 + 작은 설명. 그림이 있으면 옆에 |
| `cards` | `title`, `cards`: [{`head`, `color`?, `badge`?, `icon`?(그림 이름, 카드 위쪽 작은 그림·있으면 badge 는 생략), `lines`: [문장]}], `footer`? | 2~4개 카드 가로 배치 |
| `flow` | `title`, `nodes`: [{`label`, `sub`?, `tag`?, `color`?, `icon`?(그림 이름, 노드 위쪽)}], `strip`?: [문장], `image`? | 상자 → 화살표 → 상자. `strip` 은 아래 작은 띠(→로 이어짐). `loop`: true 면 마지막→처음 돌아가는 화살표 |
| `question` | `title`, `big`(큰 질문), `sub`?, `image`?, `caption`?(그림 위에 얹는 글) | 큰 물음표 또는 큰 글 + 그림 |
| `image` | `title`, `image`, `points`?: [문장], `callout`?(강조 상자 글) | 큰 그림 + 옆 짧은 설명 |
| `table` | `title`, `rows`: [{`badge`?, `color`?, `left`, `right`}], `image`? | 왼쪽 → 오른쪽 짝(예: 카드 → 로보독 행동) |
| `code` | `title`, `steps`: [{`text`, `sub`?}], `image`?, `tip`? | 블록 코딩 따라 하기 단계(번호) + 화면 그림 |
| `core` | `title`, `items`: [문장] | 어두운 바탕 핵심 정리 |
| `checklist` | `title`, `items`: [문장] | 네모 체크 칸 2×2 또는 목록 |

## 예시
```json
{ "ch": 2, "type": "table", "title": "2단계: 로보독에게 보내기", "image": "ai_green",
  "rows": [ { "badge": "1", "color": "red", "left": "빨강", "right": "멈추고 \"비켜!\"" },
            { "badge": "3", "color": "green", "left": "초록", "right": "천천히 출발" } ],
  "notes": "[시험 7'] 진행: [USB 마이크로비트 연결] → \"BBC micro:bit\" 선택 → 카드 보여 주기 / 주의: 로보독은 바닥이나 울타리 안에서" }
```

## 눌러 보는 장 (웹 전용 — PPT 에서는 정지 화면으로 바뀜)
| type | 필드 | 설명 |
|---|---|---|
| `story` | `image`, `alt`, `bubbles: [{who, text, x, y}]`, `caption`, `ask` | 그림 위 말풍선(x·y = 그림 안 가운데 위치 %, 그림 밖으로 나가지 않게), 오른쪽에 한 줄 설명. PPT: image 장 |
| `quiz` | `q`, `choices: [{t, ok, why}]`, `image?` | 보기를 누르면 맞음/틀림과 **보기마다 다른 설명**. 정답은 하나. PPT: points 장 + 노트에 정답 |
| `mission` | `mission`(미션 id), `goal`, `image?`, `star?`, `kit?` | [미션 시작]이 시뮬레이터 미션 화면(`sim/?kit=…&mission=…`)을 엶. 통과 기록(이 브라우저)을 '✓ 통과'로 표시. 미션 정의는 `bridge/sim/kits/<kit>/missions.js` |

미션은 **코드 글자가 아니라 로봇이 한 일**(이동 거리·몸 방향·멈춤)로 판정한다. 시뮬레이터는 추정 모델이므로 미션 뒤에 실물 확인 장을 둔다.

## 글자 강조
`image` 형식의 `points`·`callout` 안에서 `**낱말**` 로 감싸면 웹은 노란 형광펜, PPT 는 그냥 글자(표시 `**` 는 자동 제거).

## 글자 크기 규칙 (시험이 검사함)
웹 1280×720 무대 좌표 기준 머리표·바닥글 포함 보이는 글자 모두 20px 이상. 글이 길어 자동 축소(viewer.js shrink)가 0.85 아래로 내려가면 안 됨 →
코딩(`code`) 장은 단계 3개 이하·짧은 문장, 자세한 설명은 `notes` 의 진행에 넣기.

## 쓸 수 있는 그림 (bridge/lessons/assets)
story_hello · story_card · story_microbit · story_walk · story_stop · sim_robodog3d · sim_page(시뮬레이터 전체, 작게 보임) · ai_start · ai_green · ai_orange(AI 전체 화면, 작게 보임)
확대본(권장): ai_start_crop(사진 모으기 칸 2개) · ai_green_crop · ai_orange_crop(카메라 + '노랑 100%' 결과) · sim_examples · sim_controls(실행·정지 줄) · robodog_eyes_3(로보독 눈에 모둠번호 3, 시뮬레이터 3D 캡처)
그림 아이콘(직접 그린 평면 그림, 말 통일: 눈=파랑 icon_eye · 뇌=주황 icon_brain · 몸=초록 icon_body, 연결 USB=회색): icon_vacuum · icon_car · icon_delivery · icon_guide(안내견+신호등) · icon_think(물음표) · icon_change(속도 30→15) · icon_samenum(번호 3=3) · icon_teachcards(모둠 카드 1·2·3+빈 책상) · icon_numshow(눈에 번호 보이기) · icon_flash(다운로드→꽂기→켜기) · icon_debug(AI? 코드?) · sim_run(시뮬레이터 실행 화면 캡처)
포니봇 이야기 그림(제조사 바운더리엑스 활동 그림, 허락 범위 안에서 사용 — 원본·출처 `bridge/ponybot/assets/official/SOURCE.md`): pony_hero · pony_race · pony_relay · pony_circuit · pony_bowling · pony_robot · pony_icon(둥근 아이콘 — flow·cards 의 icon 용)
