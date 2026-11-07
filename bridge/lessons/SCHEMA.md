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
- `ch` (숫자): 몇 번째 차시인지. 바닥글 "피지컬 AI 교실 · {ch}차시"
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
| `flow` | `title`, `nodes`: [{`label`, `sub`?, `tag`?, `color`?}], `strip`?: [문장], `image`? | 상자 → 화살표 → 상자. `strip` 은 아래 작은 띠(→로 이어짐). `loop`: true 면 마지막→처음 돌아가는 화살표 |
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

## 글자 강조
`image` 형식의 `points`·`callout` 안에서 `**낱말**` 로 감싸면 웹은 노란 형광펜, PPT 는 그냥 글자(표시 `**` 는 자동 제거).

## 글자 크기 규칙 (시험이 검사함)
웹 1280×720 기준 슬라이드 본문 글자는 모두 20px 이상(바닥글 제외). 글이 길어 자동 축소(viewer.js shrink)가 0.85 아래로 내려가면 안 됨 →
코딩(`code`) 장은 단계 3개 이하·짧은 문장, 자세한 설명은 `notes` 의 진행에 넣기.

## 쓸 수 있는 그림 (bridge/lessons/assets)
story_hello · story_card · story_microbit · story_walk · story_stop · sim_robodog3d · sim_page(시뮬레이터 전체, 작게 보임) · ai_start · ai_green · ai_orange(AI 전체 화면, 작게 보임)
확대본(권장): ai_start_crop(사진 모으기 칸 2개) · ai_green_crop · ai_orange_crop(카메라 + '노랑 100%' 결과) · sim_examples · sim_controls(실행·정지 줄) · robodog_eyes_3(로보독 눈에 모둠번호 3, 시뮬레이터 3D 캡처)
그림 아이콘(직접 그린 평면 그림): icon_vacuum · icon_car · icon_delivery · icon_guide(안내견+신호등) · icon_think(물음표) · icon_change(속도 30→15)
