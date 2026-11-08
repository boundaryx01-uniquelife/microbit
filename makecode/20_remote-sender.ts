// =============================================================
// [라디오 리모컨 ①] 리모컨 쪽 코드 — "두 번째" 마이크로비트에 넣어요
// (로보독에 꽂은 마이크로비트가 아니라, 손에 드는 마이크로비트)
//
// 준비물: 마이크로비트 2개
//   ㉠ 리모컨: 이 코드를 넣고 배터리팩 연결 → 손에 들기
//   ㉡ 로보독: [라디오 리모컨 ②] 또는 [③] 코드를 넣고 로보독 등에 꽂기
//
// 버튼 약속(숫자 보내기)
//   A 버튼 = 1      B 버튼 = 2      A+B 함께 = 3
// 리모컨과 로보독의 그룹 번호가 같아야 해요(아래 그룹 = 1).
//   여러 모둠이 함께 하면 모둠마다 1, 2, 3 … 다른 번호로 바꾸세요(양쪽 모두!).
// =============================================================

let 그룹 = 1
radio.setGroup(그룹)
basic.showNumber(그룹)

input.onButtonPressed(Button.A, function () {
    radio.sendNumber(1)
    basic.showArrow(ArrowNames.North)
})
input.onButtonPressed(Button.B, function () {
    radio.sendNumber(2)
    basic.showIcon(IconNames.No)
})
input.onButtonPressed(Button.AB, function () {
    radio.sendNumber(3)
    basic.showIcon(IconNames.Heart)
})
