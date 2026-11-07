# 제3자 구성요소 고지

이 폴더에는 다음 오픈소스 구성요소가 원본 그대로(수정 없이) 포함되어 있습니다. 모두 Apache License 2.0을 따릅니다.
라이선스 전문: 같은 폴더의 `LICENSE-APACHE-2.0.txt`

| 파일 | 구성요소 | 버전 | 출처 |
|---|---|---|---|
| `lib/tf.min.js` | TensorFlow.js | 4.22.0 | https://github.com/tensorflow/tfjs |
| `lib/mobilenet.min.js` | @tensorflow-models/mobilenet | 2.1.1 | https://github.com/tensorflow/tfjs-models |
| `lib/knn-classifier.min.js` | @tensorflow-models/knn-classifier | 1.2.6 | https://github.com/tensorflow/tfjs-models |
| `model/` | MobileNet v2 (alpha 0.5, 224) TF.js 모델 | TF Hub classification/3 | https://tfhub.dev/google/tfjs-model/imagenet/mobilenet_v2_050_224/classification/3/default/1 |

Copyright Google LLC. 각 파일의 저작권 표시는 원본 파일 머리말을 따릅니다.

## 시뮬레이터(`sim/lib/`) — MIT License

| 파일 | 구성요소 | 버전 | 저작권 |
|---|---|---|---|
| `sim/lib/babel.min.js` | @babel/standalone | 7.24.0 | Copyright (c) 2014-present Sebastian McKenzie and other contributors |
| `sim/lib/three.module.min.js`, `sim/lib/OrbitControls.js` | three.js | 0.160.0 | Copyright 2010-2023 Three.js Authors |

MIT License 전문: `sim/lib/LICENSE-MIT.txt`

## 로보독 확장(kocoafab/robodog) — MIT License

시뮬레이터(`sim/runtime.js`)와 로보독 도우미는 공식 MakeCode 확장 `kocoafab/robodog`(v2.0.1, 331dd39)과
`kocoafab/robodog-radio`(4a50d45)의 블록 이름·열거형 값·동작 규칙(값 변환, 회전 대기 등)을 옮겨 썼습니다.
Copyright (c) 2026 코코아팹 — MIT License 전문: `sim/lib/LICENSE-robodog-MIT.txt`

## 공식 다리 시뮬레이션 데이터 (`sim/legs.js`) — 이용 허락 확인 필요

`sim/legs.js`의 다리 높이·발끝 → 관절 각도 표본 125개, 특수 곡선 4개, 보간 상수, 측면도 비율은
코코아팹 공식 "로보독 다리 시뮬레이션"(https://edu.kocoafab.cc/robodog-simul)에서 옮긴 데이터입니다.
이 데이터의 라이선스는 공개되어 있지 않습니다. 출처를 밝혀 교육용으로 쓰고 있으며, **코코아팹의 이용 허락을 받기 전까지는
상업적 재배포를 하지 마세요.** 허락을 받지 못하면 근사식으로 바꿀 수 있습니다.

## 상표·관계

"빅아이 로보독"은 코코아팹(네패스)의 제품입니다. 이 사이트와 자료는 교사가 만든 **비공식** 수업 도구이며 코코아팹과 관계가 없습니다.
홍보 영상 장면(사용자 제공 캡처)은 외형 참고에만 썼고 사이트에 싣지 않았습니다.
