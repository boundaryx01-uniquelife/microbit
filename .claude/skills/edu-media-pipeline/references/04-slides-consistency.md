# ④ 슬라이드·PPT 일관성

같은 구조가 반복되는 곳(카드 3~4개, 흐름 노드)에서 크기가 달라지면 학생·교사 모두 읽기 불편하다. 한 줄 안에서는 **머리 높이·머리 글자·본문 글자·본문 시작선**을 같게 한다.

## 웹(CSS)
```css
@supports (grid-template-rows: subgrid) {
  .cds { row-gap: 0; }                                   /* 카드 묶음(그리드) */
  .cd  { display: grid; grid-row: span 2; grid-template-rows: subgrid; }
  .cd.has-icon { grid-row: span 3; }                     /* 아이콘·머리·본문 */
}
```
subgrid가 없는 옛 브라우저는 기존 flex 배치로 그대로 동작.

## PPT 생성기(pptxgenjs 등)
- 머리 높이 = 그 줄 카드들의 필요 높이 **최댓값**.
- 머리 글자·본문 글자 크기 = 각 카드가 맞는 크기의 **최솟값**(측정은 경고 없이 조용히).
- 머리가 높아져 본문이 넘치면: 머리 아래 간격을 조금 줄이고, 네 칸 이상이면 번호 원을 작게. 학생용 최소 글자 크기는 낮추지 않는다.
- 빌드 경고(글이 상자보다 길어요)를 변경 전·후로 비교해 **새 경고가 생기지 않았는지** 확인(옛 생성기를 임시 파일로 꺼내 같은 입력으로 돌림).

## 확인
- 웹: 해당 슬라이드 캡처(데스크톱·휴대폰), 슬라이드 시험(예: `tests/lessons-web.js`).
- PPT: `soffice --headless --convert-to pdf` → `pdftoppm -png -r 50 -f N -l N` → 눈으로.
- 문서 생성기가 PPT를 사이트로 복사하는 구조면 생성기도 다시 돌린다.
