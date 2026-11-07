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
| `cards` | `title`, `cards`: [{`head`, `color`?, `badge`?, `lines`: [문장]}], `footer`? | 2~4개 카드 가로 배치 |
| `flow` | `title`, `nodes`: [{`label`, `sub`?, `tag`?, `color`?}], `strip`?: [문장], `image`? | 상자 → 화살표 → 상자. `strip` 은 아래 작은 띠(→로 이어짐). `loop`: true 면 마지막→처음 돌아가는 화살표 |
| `question` | `title`, `big`(큰 질문), `sub`?, `image`? | 큰 물음표 또는 큰 글 + 그림 |
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

## 쓸 수 있는 그림 (bridge/lessons/assets)
story_hello(하트 눈 인사) · story_card(AI가 초록 카드를 봄) · story_microbit(마이크로비트 숫자 3 + 전파) · story_walk(걷는 로보독) · story_stop(빨간 카드 앞 멈춤) · sim_robodog3d(로보독 3D) · sim_page(시뮬레이터 화면) · ai_start(AI 브리지 첫 화면) · ai_green(초록 → 3. 초록 카드 100%) · ai_orange(주황 → 노랑 100%, 자신 있게 틀림)
새 그림이 꼭 필요하면 파일 이름과 무엇을 찍을지를 보고서에 적으세요(직접 만들지 말 것).
