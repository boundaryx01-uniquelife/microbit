# 자동 시험

Playwright(크로미움)가 필요합니다.

| 스크립트 | 내용 | 실행 |
|---|---|---|
| `bridge-e2e.js` | 가짜 카메라·가짜 Web Serial로 AI 브리지 전 과정(27항목) | `cd bridge && python3 -m http.server 8765` 후 `node tests/bridge-e2e.js` |
| `model-compat.js` | 동봉 모델과 TF Hub 대체 모델의 특징값 일치 | 위 서버 실행 후 `node tests/model-compat.js` |
| `sim-e2e.js` | 시뮬레이터 31항목(예제 5개, 걷기·회전 수치, 자세, 라디오 감시·잠금, 장애물, 추락, 무한 반복, 경고, 3D, AI 브리지 연동, 좁은 화면) | 위 서버 실행 후 `node tests/sim-e2e.js` |
| `sim-shots.js` | 3D 자세 화면 캡처(육안 확인) | `node tests/sim-shots.js` |
| `build-sim-examples.js` | `makecode/*.ts` → `bridge/sim/examples.js` 생성 | 예제를 고친 뒤 실행 |
| `makecode-blocks.js` | 실제 makecode.microbit.org에서 확장 추가 → JS 붙여넣기 → 블록 변환 확인 | `node tests/makecode-blocks.js makecode/03_ai-traffic-dog.ts ext` (00번은 `ext` 없이) |
