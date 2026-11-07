# 빅아이 로보독 × 마이크로비트 피지컬 AI 수업 자료

초·중·고 학생이 계정 없이 **직접 AI를 학습시키고**, 그 결과로 **로보독(로봇)을 움직이는**
피지컬 AI 수업 자료입니다. (기본 대상: 초등 5~6학년, 중·고 확장안 포함)

## 왜 'AI 브리지'가 필요한가

빅아이 로보독 마이크로비트 확장(`kocoafab/robodog`)에는 AI 카메라 블록이 없습니다.
그래서 웹캠 + 브라우저 AI로 인식하고, 결과를 마이크로비트 라디오로 로보독에 보냅니다.

```
웹캠 → AI 브리지(크롬/엣지) → USB → USB 마이크로비트(B1) → 라디오 → 로보독 마이크로비트(R1) → 로보독
```

- 학생 계정·로그인 불필요, 영상은 브라우저 밖으로 나가지 않음
- 얼굴 대신 카드·물건·손 모양을 학습 (개인정보 보호)

**AI 브리지 주소: https://microbit-bridge.netlify.app** (학교망 허용 목록에는 `microbit-bridge.netlify.app` 하나만 추가하면 됩니다)

**로보독 시뮬레이터: https://microbit-bridge.netlify.app/sim/** — MakeCode JavaScript 코드를 붙여넣으면 로보독 움직임을 2D·3D로 미리 봅니다. AI 브리지와 같은 컴퓨터에서 열면 로보독 없이도 AI 수업 연습이 됩니다. (`docs/08_시뮬레이터_안내.md`)

## 구성

| 경로 | 내용 |
|---|---|
| `docs/00_교안분석_및_선정.md` | 코코아팹 교안 전체 분석과 선정 근거 |
| `docs/01_소개형_2차시.md` | 2차시 소개형 |
| `docs/02_기본형_4차시.md` | 4차시 기본형 |
| `docs/03_전체형_8차시.md` | 8차시 전체형 |
| `docs/04_활동지_평가.md` | 서약서·활동지 A~F·체크리스트·루브릭 |
| `docs/05_교사용_운영가이드.md` | AI 개념(교사용), 학교 PC 점검표, 안전장치, 문제 해결 |
| `docs/06_중고등_확장안.md` | 중학교·고등학교 확장 |
| `docs/07_검증보고서.md` | 배포 전 검증 결과와 미검증 항목 |
| `docs/08_시뮬레이터_안내.md` | 로보독 시뮬레이터 쓰는 법·실물과 다른 점 |
| `bridge/` | AI 브리지 웹 프로그램(라이브러리·모델 동봉, 설치 불필요) |
| `bridge/sim/` | 로보독 시뮬레이터(2D·3D) |
| `makecode/*.ts` | MakeCode 예제 (JavaScript 탭에 붙여넣기 → 블록으로 보기) |
| `makecode/06~08_radio-*.ts` | **무선 확장 `kocoafab/robodog-radio`** 예제: 로보독 내장 AI 카메라(QR·색상·얼굴 추적) 사용 — 실물 미검증 |

## 빠른 시작 (교사)

1. **USB 마이크로비트**: MakeCode 새 프로젝트 → JavaScript 탭에 `makecode/00_bridge-receiver.ts` 붙여넣기 → 다운로드.
   ⚠ 이 프로젝트에는 로보독 확장을 넣지 마세요.
2. **로보독 마이크로비트**: 새 프로젝트 → 확장에서 `kocoafab/robodog` 추가(전체 입력)
   → `makecode/03_ai-traffic-dog.ts` 붙여넣기 → 다운로드 → 로보독 등에 꽂고 전원 ON.
3. 두 코드의 `모둠번호`를 같게(모둠마다 다르게).
4. **https://microbit-bridge.netlify.app** 을 크롬/엣지로 열기 → 카메라 켜기 → 카드 학습 → USB 마이크로비트 연결.
5. 위험하면 화면 위 **■ 멈춤**(또는 Esc), 로보독 마이크로비트 **A**.

## 검증 상태

자동 시험 통과(브리지 27/27, MakeCode 5/5 컴파일·블록 변환). **실물 로보독 연동은 미검증** → `docs/07_검증보고서.md` 4절의 실기 점검을 첫 수업 전에 해 주세요.

## 라이선스

`bridge/lib`(TensorFlow.js, MobileNet, KNN Classifier)와 `bridge/model`(MobileNet v2)은 Apache License 2.0,
`bridge/sim/lib`의 Babel standalone과 three.js는 MIT License — `bridge/NOTICE.md` 참고.
