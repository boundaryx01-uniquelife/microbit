# ③ 아이콘 세트 (Canva 사물 + 코드 도식)

## 나누는 기준
| 종류 | 예 | 만드는 법 | 이유 |
|---|---|---|---|
| 사물·캐릭터 | 청소기, 자동차, 배달 로봇, 마스코트 전신, 눈, 보드, 전구 | Canva `generate-image` | 입체감·표정이 코드보다 훨씬 낫다 |
| 글자·숫자·관계 도식 | "30→15", "3=3", 카드 1~4, 내려받기→꽂기→켜기 | 코드(SVG 생성기) | 생성형 이미지는 한글·숫자가 깨지고, 정확한 배치가 필요 |

## Canva 절차
1. 첫 1~2장을 만든다. 프롬프트에 그림체를 고정: "flat 2D vector icon, soft pastel <색> circle background, simple cel shading, no outlines, <브랜드 색> palette, white background, centered, no text".
2. 나머지는 **첫 장을 `imageReferences`로** 넣고 "Same flat 2D vector icon style as the reference images: …"로 시작. 마스코트는 특징 표(머리 형태·눈 색)를 문장으로 넣는다.
3. 고해상도 받기: 빈 디자인(아무 디자인이나 하나) → `edit-design`으로 `add_page`(1024×1024) × N → 각 페이지 `insert_fill`(0,0,1024,1024) → `commit` → `export-design` png 1024, pages 지정. (생성 결과 링크는 200px 미리보기뿐.)
4. 받은 PNG → `scripts/prep-transparent-icons.py in out --max 640`: 테두리에서 이어지는 흰색만 투명, 배경 원·그림 속 흰색은 유지, 자르기.
5. 작업용 Canva 디자인이 사용자 계정에 남는다는 것을 보고한다(지워도 됨).

## 코드 도식 절차
- 생성기 한 파일(`assets/diagram-icons-example.html` 참고): 공용 부품(배경 원·셀 음영 그라디언트·하이라이트·마스코트 머리 함수·숫자 타일·화살표), 아이콘별 함수.
- 규칙: 원본 800×600 기준 **이름표 40px 이상**, 내용은 배경 원(r≈275) 안, 배경 원 색은 Canva 아이콘에서 측정한 파스텔.
- 내보내기는 그림 bbox로 자른 투명 PNG(Playwright `getBBox` + `omitBackground`). Canva 아이콘 이름은 내보내기 목록에서 빼 덮어쓰기 방지.

## 반영·확인
- 아이콘이 들어간 슬라이드를 모두 캡처해 contact sheet로 본다(카드 안 작은 아이콘, 흐름도, 큰 그림 슬라이드).
- PPT도 같은 PNG를 쓰면 다시 빌드 → LibreOffice로 PDF→PNG 렌더해 확인, PPT 속 미디어 해시가 현재 파일과 같은지 비교.
