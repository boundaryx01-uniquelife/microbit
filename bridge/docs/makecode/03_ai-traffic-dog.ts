// =============================================================
// [로보독 마이크로비트] 3. AI 신호등 안내견
// 원 교안: 스크래치 인공지능 교안 CH10을 마이크로비트용으로 재구성
//
// 준비: AI 브리지에서 1=빨강, 2=노랑, 3=초록, 4=배경 카드를 학습
//       USB 마이크로비트(00_bridge-receiver)와 같은 모둠번호 사용
// 받는 숫자: 0=멈춤, 1=빨강, 2=노랑, 3=초록, 4=배경
// 안전장치: ① 2초 동안 신호가 안 오면 어떤 상태든 멈춤
//           ② 로보독 본체 버튼(전원 스위치 옆) = 멈춤 잠금 ↔ 풀기 (누를 때마다 바뀜, 잠그면 눈에 X)
//           ※ 꽂은 마이크로비트의 A·B 버튼은 가려져서 누를 수 없어요.
// ※ 로보독 마이크로비트에서는 '음악' 블록을 쓰지 마세요(로봇 통신 핀과 겹칠 수 있음).
// ※ 계속 걷는 예제입니다. 거리센서는 앞의 물체만 보고 책상 끝(낭떠러지)은 못 봅니다 → 바닥이나 울타리 안에서 시험하세요.
// =============================================================

let 모둠번호 = 1
let 받은신호 = 0
let 현재신호 = -1
let 마지막수신 = 0
let 멈춤잠금 = false
radio.setGroup(모둠번호)
robodog.gesture(deflib.Posture.Ready)
// 켤 때 모둠번호를 로보독 눈에 잠깐 보여 줌(등에 꽂은 마이크로비트 화면은 가려질 수 있어요)
robodog.headLedPrint(deflib.HeadLedSide.Both, "" + 모둠번호)
basic.pause(1400)
robodog.headLedClear()

function 신호에반응하기 (신호: number) {
    if (신호 == 1) {
        // 빨강: 멈추고 비켜!
        robodog.stop()
        robodog.bodyLed(255, 0, 0)
        robodog.headLedExp(deflib.LedExpression.SharpEyes)
        robodog.soundPlay(deflib.SoundEffect.MoveAside, deflib.SoundVolume.Medium)
        basic.showIcon(IconNames.No)
    } else if (신호 == 2) {
        // 노랑: 기다려
        robodog.stop()
        robodog.bodyLed(255, 160, 0)
        robodog.headLedExp(deflib.LedExpression.Blink)
        robodog.soundPlay(deflib.SoundEffect.Wait, deflib.SoundVolume.Medium)
        basic.showIcon(IconNames.Asleep)
    } else if (신호 == 3) {
        // 초록: 출발! (책상 위라면 속도 25 이하)
        robodog.bodyLed(0, 255, 0)
        robodog.headLedExp(deflib.LedExpression.SparklingEyes)
        robodog.soundPlay(deflib.SoundEffect.Start, deflib.SoundVolume.Medium)
        robodog.move(deflib.MoveDirection.Forward, 25)
        basic.showIcon(IconNames.Yes)
    } else {
        // 0(멈춤) 또는 4(배경): 제자리에서 기다리기
        robodog.stop()
        robodog.bodyLed(0, 0, 0)
        robodog.headLedExp(deflib.LedExpression.EyesClosed)
        basic.clearScreen()
    }
}

// 라디오는 받은 값만 기록하고, 실제 동작은 아래 무한 반복에서 한 곳에서만 처리
radio.onReceivedNumber(function (받은수) {
    받은신호 = 받은수
    마지막수신 = input.runningTime()
})

// 본체 버튼: 누를 때마다 멈춤 잠금 ↔ 풀기
let 버튼이전 = false
basic.forever(function () {
    let 버튼지금 = robodog.getButton()
    if (버튼지금 && !(버튼이전)) {
        멈춤잠금 = !(멈춤잠금)
    }
    버튼이전 = 버튼지금
    basic.pause(50)
})

basic.forever(function () {
    if (멈춤잠금) {
        // 잠금: 라디오를 무시하고 멈춤, 눈에 X
        if (현재신호 != -2) {
            현재신호 = -2
            robodog.stop()
            robodog.bodyLed(255, 0, 0)
            robodog.headLedPrint(deflib.HeadLedSide.Both, "X")
            basic.showIcon(IconNames.No)
        }
    } else {
        let 할일 = 받은신호
        if (input.runningTime() - 마지막수신 > 2000) {
            // 신호가 끊김 → 안전하게 멈춤
            할일 = 0
        }
        if (할일 != 현재신호) {
            현재신호 = 할일
            신호에반응하기(현재신호)
        }
    }
    basic.pause(50)
})
