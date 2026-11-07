// =============================================================
// [로보독 마이크로비트] 2. 규칙으로 반응하기 (센서 + 조건문)
// 활동: 거리센서 값이 가까우면 멈추고 경고, 멀면 천천히 걷기.
// 수업 포인트: "사람이 정한 규칙(만약 ~라면)"으로 움직이는 로봇.
//              다음 차시의 "데이터로 배우는 AI"와 비교합니다.
// 본체 버튼(전원 스위치 옆) = 걷기 시작 / 멈춤 (켜자마자 걷지 않아요)
//   ※ 꽂은 마이크로비트의 A·B 버튼은 가려지므로 본체 버튼을 씁니다.
// 멈춰 있는 동안에도 몸통 불빛으로 거리를 알려 줍니다: 빨강 = 가까움, 초록 = 멂.
// ※ 거리센서 값의 단위는 실물로 확인하세요. 멈춘 상태에서 손을 앞에 대 보며 불빛이 바뀌는 거리를 보고
//   모둠이 "가까움" 기준값을 정해 아래 숫자를 바꾸세요.
// ※ 로보독 마이크로비트에서는 '음악' 블록을 쓰지 마세요(로봇 통신 핀과 겹칠 수 있음).
// ※ 계속 걷는 예제입니다. 거리센서는 앞의 물체만 보고 책상 끝(낭떠러지)은 못 봅니다 → 바닥이나 울타리 안에서 시험하세요.
// =============================================================

let 가까움기준 = 20
let 걷는중 = false
let 지금상태 = 0
let 버튼이전 = false
let 불빛상태 = 0
robodog.gesture(deflib.Posture.Ready)
robodog.headLedExp(deflib.LedExpression.EyesClosed)

// 본체 버튼은 '걷는중' 값만 바꾸고, 로봇 명령은 아래 무한 반복 한 곳에서만 내립니다
basic.forever(function () {
    let 버튼지금 = robodog.getButton()
    if (버튼지금 && !(버튼이전)) {
        걷는중 = !(걷는중)
    }
    버튼이전 = 버튼지금
    basic.pause(50)
})

basic.forever(function () {
    if (!(걷는중)) {
        if (지금상태 != 0) {
            지금상태 = 0
            불빛상태 = 0
            robodog.stop()
            robodog.gesture(deflib.Posture.Ready)
            robodog.headLedExp(deflib.LedExpression.EyesClosed)
        }
        // 멈춘 채로 거리만 불빛으로 보여 주기(기준값 정할 때 사용)
        let 멈춤거리 = robodog.getTof()
        let 새불빛 = 멈춤거리 > 0 && 멈춤거리 < 가까움기준 ? 1 : 2
        if (새불빛 != 불빛상태) {
            불빛상태 = 새불빛
            if (불빛상태 == 1) {
                robodog.bodyLed(255, 0, 0)
            } else {
                robodog.bodyLed(0, 255, 0)
            }
        }
    } else {
        let 거리 = robodog.getTof()
        if (거리 == 0) {
            // 센서 값을 아직 못 받았거나 오류 → 안전하게 멈춤
            if (지금상태 != 3) {
                지금상태 = 3
                robodog.stop()
                basic.showIcon(IconNames.Confused)
            }
        } else if (거리 < 가까움기준) {
            if (지금상태 != 1) {
                지금상태 = 1
                robodog.stop()
                robodog.bodyLed(255, 0, 0)
                robodog.headLedExp(deflib.LedExpression.SharpEyes)
                robodog.soundPlay(deflib.SoundEffect.MoveAside, deflib.SoundVolume.Medium)
                basic.showIcon(IconNames.No)
            }
        } else {
            if (지금상태 != 2) {
                지금상태 = 2
                robodog.bodyLed(0, 255, 0)
                robodog.headLedExp(deflib.LedExpression.SparklingEyes)
                robodog.move(deflib.MoveDirection.Forward, 25)
                basic.showIcon(IconNames.Yes)
            }
        }
    }
    basic.pause(100)
})
