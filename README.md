# 빅아이 로보독 × 마이크로비트 피지컬 AI 수업 자료

초·중·고 학생이 계정 없이 **직접 AI를 학습시키고**, 그 결과로 **로보독(로봇)을 움직이는**
피지컬 AI 수업 자료입니다. (기본 대상: 초등 5~6학년, 중·고 확장안 포함)

> 교사가 만든 **비공식** 수업 자료입니다. 빅아이 로보독은 코코아팹(네패스)의 제품이며, 이 자료와 사이트는 코코아팹과 관계가 없습니다.

**사이트: https://microbit-bridge.netlify.app** — 첫 화면에서 시뮬레이터·AI 브리지·수업 자료(인쇄용)로 갑니다.

| 바로가기 | 주소 |
|---|---|
| 로보독 시뮬레이터(블록 코딩 + 도우미) | https://microbit-bridge.netlify.app/sim/ |
| AI 브리지(웹캠 AI → 마이크로비트) | https://microbit-bridge.netlify.app/ai.html |
| 수업 자료(웹·인쇄) | https://microbit-bridge.netlify.app/docs/ |

## 왜 'AI 브리지'가 필요한가

로보독을 마이크로비트에 꽂아 쓰는 유선 확장(`kocoafab/robodog`)에는 AI 카메라 블록이 없습니다.
공식 무선 확장(`kocoafab/robodog-radio`)에는 로보독 카메라 AI 블록이 있지만 실물 동작은 아직 확인하지 못했습니다(예제 06~08).
그래서 기본안은 웹캠 + 브라우저 AI로 인식하고, 결과를 마이크로비트 라디오로 로보독에 보내는 방식입니다.

```
웹캠 → AI 브리지(크롬/엣지) → USB → USB 마이크로비트(B1) → 라디오 → 로보독 마이크로비트(R1) → 로보독
```

- 학생 계정·로그인 불필요, 영상은 브라우저 밖으로 나가지 않음
- 얼굴 대신 카드·물건·손 모양을 학습 (개인정보 보호)

**학교망 허용 주소**: AI 브리지만 쓰면 `microbit-bridge.netlify.app` 하나면 됩니다. 시뮬레이터의 블록 코딩 화면과 MakeCode 다운로드에는
`makecode.microbit.org` 와 MakeCode가 쓰는 주소(확장을 받는 `github.com` 등)도 열려 있어야 합니다(`docs/05_교사용_운영가이드.md` 학교 PC 점검표).
막혀 있으면 시뮬레이터는 60초 뒤 **글자 코드(JavaScript)** 탭으로 바뀝니다.

**로보독 시뮬레이터** — 블록 코딩(MakeCode) 화면에서 블록을 고치면 로보독 움직임을 2D·3D로 바로 봅니다. AI 브리지와 같은 컴퓨터에서 열면 로보독 없이도 AI 수업 연습이 됩니다.
**🤖 로보독 도우미**에 "A 버튼을 누르면 인사해"처럼 말하면 코드를 만들어 줍니다(키 없이 규칙 도우미, Netlify에 `ANTHROPIC_API_KEY`를 넣으면 Claude AI 도우미 — 이때 입력 글은 외부 AI 서버로 전송). (`docs/08_시뮬레이터_안내.md`)

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
4. **https://microbit-bridge.netlify.app/ai.html** 을 크롬/엣지로 열기 → 카메라 켜기 → 카드 학습 → USB 마이크로비트 연결.
5. 위험하면 화면 위 **■ 멈춤**(또는 Esc), 로보독 마이크로비트 **A**.

## 검증 상태

자동 시험 통과 — 수치는 `docs/07_검증보고서.md`와 `tests/README.md` 참고(MakeCode 예제 00~08 컴파일·블록 변환 포함). **실물 로보독 연동은 미검증** → `docs/07_검증보고서.md` 4절의 실기 점검을 첫 수업 전에 해 주세요.

## 라이선스

`bridge/lib`(TensorFlow.js, MobileNet, KNN Classifier)와 `bridge/model`(MobileNet v2)은 Apache License 2.0,
`bridge/sim/lib`의 Babel standalone과 three.js는 MIT License — `bridge/NOTICE.md` 참고.
