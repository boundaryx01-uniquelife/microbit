# 자동 시험

Playwright(크로미움)가 필요합니다.

| 스크립트 | 내용 | 실행 |
|---|---|---|
| `bridge-e2e.js` | 가짜 카메라·가짜 Web Serial로 AI 브리지 전 과정(27항목) | `cd bridge && python3 -m http.server 8765` 후 `node tests/bridge-e2e.js` |
| `model-compat.js` | 동봉 모델과 TF Hub 대체 모델의 특징값 일치 | 위 서버 실행 후 `node tests/model-compat.js` |
| `makecode-blocks.js` | 실제 makecode.microbit.org에서 확장 추가 → JS 붙여넣기 → 블록 변환 확인 | `node tests/makecode-blocks.js makecode/03_ai-traffic-dog.ts ext` (00번은 `ext` 없이) |
