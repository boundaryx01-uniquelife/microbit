// =============================================================
// [로보독 마이크로비트] 3. AI 신호등 안내견
// 원 교안: 스크래치 인공지능 교안 CH10을 마이크로비트용으로 재구성
//
// 준비: AI 브리지에서 1=빨강, 2=노랑, 3=초록, 4=배경 카드를 학습
//       다리 마이크로비트(00_bridge-receiver)와 같은 모둠번호 사용
// 받는 숫자: 0=멈춤, 1=빨강, 2=노랑, 3=초록, 4=배경
// 안전장치: 2초 동안 신호가 안 오면 자동으로 멈춥니다.
// =============================================================

let 모둠번호 = 1
let 현재신호 = -1
let 마지막수신 = 0
radio.setGroup(모둠번호)
robodog.gesture(deflib.Posture.Ready)
basic.showString("R" + 모둠번호)

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

radio.onReceivedNumber(function (받은수) {
    마지막수신 = input.runningTime()
    if (받은수 != 현재신호) {
        현재신호 = 받은수
        신호에반응하기(현재신호)
    }
})

// 안전장치: 신호가 끊기면 멈춤
basic.forever(function () {
    if (현재신호 == 3 && input.runningTime() - 마지막수신 > 2000) {
        현재신호 = 0
        신호에반응하기(0)
    }
    basic.pause(200)
})

// 비상 정지: 로보독 마이크로비트의 A 버튼
input.onButtonPressed(Button.A, function () {
    현재신호 = 0
    신호에반응하기(0)
})
