# ② MakeCode 블록 가져오기·편집기 연동·블록 변환 검증

기준 구현: `boundaryx01-uniquelife/microbit`. 핵심 파일은 `bridge/sim/index.html`, `bridge/sim/runtime.js`,
`bridge/sim/examples.js`(자동 생성), `makecode/*.ts`, `tests/makecode-blocks.js`, `tests/build-sim-examples.js`.

## 1. MakeCode 편집기 삽입 (bridge/sim/index.html, 797~877행)

### 1.1 iframe과 주소
- HTML: `<iframe id="mcFrame" title="MakeCode 편집기" allow="usb; clipboard-read; clipboard-write">` (229행 부근).
  `src`는 처음 `openEditor()`가 불릴 때 한 번만 설정한다(`mcLoaded` 플래그).
- 주소: `MC_ORIGIN + '/?controller=1&lang=ko#editor'`, `MC_ORIGIN = 'https://makecode.microbit.org'`.
  - `controller=1`: 공식 "controller(embed) 모드". 편집기는 자체 저장소(IndexedDB/클라우드) 대신
    부모 창이 프로젝트를 주고받게 하며, 부모(host)와 `postMessage`로 대화한다.
  - `lang=ko`: 블록 글자를 한국어로. 확장 번역은 확장의 `_locales/ko/*-strings.json`이 쓰인다.
- 탭 구조: `tabEditor`(블록 코딩) / 글자 코드(JS) 두 탭. 시작 탭은 `?tab=js` 쿼리가 있으면 JS, 아니면 편집기.
  MakeCode 내부의 작은 마이크로비트 시뮬레이터는 `hidesimulator`로 숨기고 오른쪽의 로봇 시뮬레이터를 쓴다.

### 1.2 postMessage 규약 (모두 `MC_ORIGIN`으로만 송신, 수신 시 `ev.origin`·`ev.source` 검사)
| 방향 | 메시지 | 용도 |
|---|---|---|
| 편집기 → 사이트 | `{type:'pxthost', action:'workspacesync', id}` | 편집기가 시작하며 프로젝트를 요청. 사이트는 `{type:'pxthost', id, success:true, projects:[mcProject(code)]}`로 응답 |
| 편집기 → 사이트 | `action:'editorcontentloaded'` | 준비 완료. `mcReady=true`, 로딩 막 제거, `switchblocks`(500ms)·`hidesimulator`(800ms) 전송 |
| 편집기 → 사이트 | `action:'workspacesave'`, `project.text['main.ts']` | 블록을 고칠 때마다 오는 저장 이벤트. **여기서 코드를 끌어온다** |
| 사이트 → 편집기 | `{type:'pxteditor', action:'importproject', project, id, response:true}` | 예제·직접 입력 코드를 편집기에 밀어 넣음 |
| 사이트 → 편집기 | `{type:'pxteditor', action:'switchblocks'}` / `'hidesimulator'` | 화면 전환·시뮬레이터 숨김 |
| 사이트 → 편집기 | `{type:'pxthost', id, success:true}` | `m.response`가 있는 요청에 대한 ACK (`workspacesync` 제외) |

### 1.3 편집기 → 시뮬레이터로 코드가 오는 길
1. 사용자가 블록을 바꾸면 MakeCode가 `workspacesave`를 보낸다. 사이트는 `m.project.text['main.ts']`를 읽는다.
2. 에코 방지: 사이트가 프로젝트를 보낸(`mcImportAt`) 뒤 6초 안에 오는 저장은 편집기의 자동 재저장이므로
   사용자의 수정으로 보지 않는다(`mcFromEditor`만 갱신하고 무시).
3. 코드가 바뀌었으면 `stopDemo()` → `#code` textarea 갱신 → `save()` → `#mcAutoRun`이 켜져 있으면
   1200ms 디바운스 후 `runCode(code, ...)` 실행(`mcRunTimer`).
4. 반대 방향: 1500ms `setInterval`이 `#code` 값이 `mcSentToEditor`/`mcFromEditor`와 다르면 `mcImport(v)`로 편집기에 보냄
   (예제 선택·시연·글자 코드 입력이 편집기에 반영됨). 임포트 4초 뒤 `switchblocks`로 블록 화면을 보장.
- 프로젝트 객체 `mcProject(code)`: `header`(editor `'blocksprj'`, target `'microbit'`, targetVersion `'9.0.0'`, id `robodog-sim-<ts>`) +
  `text` {`pxt.json`, `main.ts`=code, `main.blocks`='', `README.md`=' '}. `main.blocks`를 비워 두면 편집기가 `main.ts`에서 블록을 새로 만든다.

### 1.4 확장 미리 넣기와 커밋 고정
- `pxt.json`의 `dependencies`는 기본 `{core:'*', radio:'*', microphone:'*'}`.
- `blockPackage(code)`(778행)가 코드 문자열의 정규식으로 어떤 확장이 필요한지 판단:
  `robodog.(rfBand|aiDetection|faceTracking|getCameraAlive|getFaceClass|getFaceTracking|getColorDetect|getQrCode|getAiPosition)` → `robodog-radio`,
  그 외 `robodog.` 또는 `deflib.` → `robodog`. 판단되면 `deps[name] = EXT_PIN[name]`.
- `EXT_PIN`(801행)이 확인된 버전으로 **커밋 해시 고정**:
  `robodog: 'github:kocoafab/robodog#331dd39f...'`, `'robodog-radio': 'github:kocoafab/robodog-radio#4a50d45d...'`.
  확장 저장소가 바뀌어도 수업 중 블록이 달라지지 않게 하려는 장치. 확장은 편집기가 `github.com`/`raw.githubusercontent.com`에서 받아 온다.

### 1.5 60초 폴백
- `openEditor()`에서 `setTimeout(..., 60000)`: 그때까지 `mcReady`(=`editorcontentloaded` 수신)가 안 되면
  `#mcStatus`·`#mcLoad`에 "학교망에서 makecode.microbit.org 가 막혔을 수 있어요" 안내를 표시하고, 로그에 경고를 남기고,
  편집기 탭이 보이는 중이면 `showCodeTab('js')`로 글자 코드(JavaScript) 탭으로 전환한다. 글자 코드 탭은 인터넷 없이도 동작(시뮬레이터가 열린 경우).

## 2. 학생 JS 컴파일 (bridge/sim/runtime.js)

### 2.1 compile(src) (329~383행)
- `ensureBabel()`이 `lib/babel.min.js`(약 2.8MB, standalone)를 필요할 때/한가할 때 `<script>`로 로드. index.html은 부팅 직후 `ensureBabel().catch(()=>{})`.
- `compile(src)`는 코드를 `async function __main() {\n${src}\n}`로 감싸 `Babel.transform`(preset `typescript` + `allExtensions:true`, 자체 플러그인, `sourceType:'script'`) 처리,
  끝에 `return __main;`을 붙인다. 결과는 `new Function(...Object.keys(env), code)(...values)`로 실행(runtime.js 515~521행): `buildEnv()`의 이름들이 코드의 전역 식별자가 되고, 반환된 `__main`은 `spawn`으로 별도 fiber에서 시작된다.
- 플러그인이 하는 일(협동 스케줄링):
  1. 모든 `FunctionDeclaration`을 `async`로.
  2. API 네임스페이스 호출의 콜백(`isApiCallback`: 부모가 `NS.fn(...)` 호출이고 `NS ∈ ASYNC_NS`)인 함수/화살표 함수를 `async`로.
  3. async 함수 안의 모든 `CallExpression`을 `await`로 감쌈(이미 await이면 제외).
  4. 반복문(`while/for/do-while/for-of/for-in`) 본문 맨 앞에 `await __yield()`를 삽입 → 무한 루프도 화면이 멈추지 않음(100회마다 `sleep(0)`).
- `ASYNC_NS = {basic,input,radio,loops,control,serial,robodog,pins,music,led,game}` — 이 이름은 코드의 네임스페이스 식별자와 일치해야 한다.

### 2.2 열거형 매핑
- 런타임 쪽 API 객체(660~680행): `basic, input, radio, led, loops, control, serial, music(경고 프록시), robodog, deflib, images, pins, game, Button, IconNames` 및
  `BaudRate/Delimiters/SerialPin/ArrowNames/Gesture/Melodies/MelodyOptions/BeatFraction/Note`(`enumProxy`), `randint`, `__yield`, `console`.
- `deflib` 객체가 확장의 enum을 **숫자 값으로** 재현: `Posture`, `LegGroup`, `LegSelection`, `RotateDirection`, `MoveDirection`, `HeadLedSide`,
  `TiltAxis`, `LedExpression`, `SoundEffect`, `SoundVolume`, `AiPositionAxis`, `AiMode`, `AiClass`, `constrain`.
  학생 코드의 `deflib.Posture.SayHello` 같은 식이 그대로 평가된다. 값은 확장 `deflib.ts`(실물 펌웨어와 같은 값)를 손으로 옮긴 것이므로 확장 업데이트 시 재검증 필요.
- `makeRobodogApi(R, h)`가 `robodog.*` 블록(gesture, legBend, leg, motor, move, rotation, headLedExp, soundPlay, getTof, getBattery, ...)의 동작을 로봇 모델 `R`에 연결한다.
  모르는 멤버는 `warnProxy`가 "시뮬레이터에서 지원하지 않음" 경고만 내고 무시.

### 2.3 examples.js 생성 (tests/build-sim-examples.js)
- 실행: `node tests/build-sim-examples.js`. `makecode/*.ts`를 읽어 `META`(파일 id → group·order·title·level·sim[]·real[])와 합쳐
  `bridge/sim/examples.js`(`export const GROUPS`, `export const EXAMPLES`, 각 항목에 `code` 원문 포함)를 만든다. 직접 편집 금지(파일 머리 주석).
- `META`에 없는 `.ts`는 목록에서 제외(예: `00_bridge-receiver`, `06~08` AI 예제). group은 `button`/`radio`/`check`.
- `bridge/docs/makecode/`에 같은 `.ts`의 복사본이 있다(배포용 사본으로 보임, 동기화는 별도).

## 3. 블록 변환 검증 (tests/makecode-blocks.js)
실행: `node tests/makecode-blocks.js makecode/<파일>.ts [ext | ext:<owner/repo>]` (Playwright chromium, 실제 makecode.microbit.org 접속, 스크린샷은 `tests/mc/`).
1. `https://makecode.microbit.org/?lang=ko#editor` 접속 → `#blocksEditor, .blocklySvg` 대기(최대 120초), 시작 대화상자 닫기.
2. `ext` 인자가 있으면 `[data-ns="addpackage"]` 클릭 → `.extensions-browser input`에 `owner/repo` 입력+Enter →
   카드(`.common-card`, 저장소 이름 정규식)를 찾아 클릭해 확장 추가. 카드가 없으면 `RESULT ext card not found`.
3. `div.javascript-menuitem`으로 JS 탭 → `monaco.editor.getModels()[0].setValue(code)`로 코드 주입.
4. 단언(출력 JSON으로 확인, 자동 fail 판정은 없음): (a) `getModelMarkers`의 severity ≥ 8 오류 목록 `jsErrors`;
   (b) `div.blocks-menuitem`으로 블록 탭 전환 후 `.blocklyDraggable` 개수 `blockCount`, 변환 실패 대화상자 텍스트 `dialog`;
   (c) `.blocklyText` 중 `robodog.|deflib.|radio.|basic.|input.|serial.|;|=>` 패턴이 남은 것 `rawCodeTexts`(블록으로 못 바뀐 원문 코드의 흔적).
   통과 기준: `jsErrors`=[], `dialog`='', `rawCodeTexts`=[] 이고 `blockCount`>0.
- 주의: 선택자(`.extensions-browser`, `data-ns` 등)는 MakeCode UI 변경에 취약. 확장 추가는 최신 master를 받으므로 `EXT_PIN` 커밋과 어긋날 수 있다.

## 4. 내려받기(.hex)와 학교망 (docs/05, README)
- 사이트 자체에는 .hex 생성 코드가 없다. 수업 흐름은 **MakeCode 편집기의 "다운로드"**: makecode.microbit.org에서 .hex 내려받기 →
  `MICROBIT` 드라이브에 복사(`docs/05` 점검표 36행). USB 저장장치 차단 시 정보부 예외 요청 또는 교사 PC에서 일괄 다운로드.
  README 59~62행: MakeCode 새 프로젝트 → JavaScript 탭에 `makecode/*.ts` 붙여넣기 → 다운로드.
- 허용 도메인(`docs/05` 51~60행): `microbit-bridge.netlify.app`(시뮬레이터·AI 브리지), `makecode.microbit.org`, `makecode.com`·`*.makecode.com`(예 `cdn.makecode.com`),
  `github.com`/`api.github.com`/`raw.githubusercontent.com`(확장 받기). 막히면 F12 → Network에서 빨간 줄 주소를 정보부에 전달.
- 막히면 60초 뒤 JS 탭으로 자동 전환(§1.5). 단 그 경우에도 다운로드는 makecode.microbit.org가 필요.

## 5. 다른 확장으로 바꿀 때 바꿀 것
1. `index.html`: `EXT_PIN`의 키/저장소/커밋(`github:owner/repo#<sha>`), `blockPackage()`의 정규식(어떤 코드가 어떤 확장을 뜻하는지), `mcProject()`의 프로젝트 이름·기본 dependencies, 안내 문구의 "로보독".
2. `runtime.js`: `ASYNC_NS`에 새 확장의 네임스페이스 추가(예: `maqueenPlusV2`), 해당 네임스페이스 API 객체를 `makeRobodogApi` 같은 형태로 구현해 반환 객체에 등록,
   enum 객체(`deflib`에 해당) 재작성 — `extract-blocks.py`의 enums 결과가 출발점. 반환 객체에 없는 이름은 `ReferenceError`.
3. `tests/makecode-blocks.js`: 기본 `extRepo`(`kocoafab/robodog`)와 `rawCodeTexts` 정규식의 접두어, `build-sim-examples.js`의 `META` 키·문구·그룹.
4. `makecode/*.ts` 예제의 확장 주석("확장: ...")·네임스페이스, `docs/05`·README의 도메인 표(확장이 다른 호스트를 쓰면 추가).
5. 시뮬레이터 모델(`makeRobodogApi`, `view2d/3d`, `devices.js`)은 로봇별로 새로 만들어야 하며 블록 표 추출만으로는 동작이 정의되지 않는다.

## 6. 함정 (pitfalls)
- **enum 값 불일치**: `deflib`의 숫자는 수동 복사. 확장이 값을 바꾸면 시뮬레이터와 실물이 조용히 달라진다(예: `LegSelection`은 값 순서가 이름 순서와 다름).
- **블록 이름 ≠ 함수 이름**: 한국어 블록 문구는 `_locales/ko/*-strings.json`(키 `ns.fn|block`)에 있고, 소스의 `//% block=` 는 영어. 교안·활동지는 블록 한국어 문구와 일치해야 한다.
- **커밋 고정과 확장 최신본 차이**: 편집기(편집·변환)는 `EXT_PIN` 버전, `tests/makecode-blocks.js`는 master. 확장을 올릴 땐 둘 다 확인.
- **에코 루프**: 6초 무시창·`mcSentToEditor`/`mcFromEditor` 비교를 지우면 무한 임포트/저장 루프가 생긴다.
- **origin 검사**: `postMessage` 대상·수신 origin을 `MC_ORIGIN`으로 고정. MakeCode 주소가 바뀌면 함께 수정.
- **`workspacesave` 필드·`pxteditor` 액션은 MakeCode 내부 규약**: 버전업 시 깨질 수 있다. `targetVersion '9.0.0'`도 MakeCode 쪽 버전과 맞아야 한다.
- **Babel 변환**: 모든 호출에 `await`를 붙이므로 `ASYNC_NS`에 없는 비동기 콜백(예: 사용자 정의 고차함수)은 동기로 남아 `await` 문법 오류가 날 수 있다. 클래스·`namespace` 선언 등은 타입 제거만으로 처리되지 않는 문법이 있다.
- `music` 블록은 로봇 통신 핀(P0)과 겹칠 수 있어 경고 프록시로 처리(로봇마다 핀 충돌 여부를 확인할 것).
- 학교망: `makecode.microbit.org`만 열어서는 부족한 경우가 많다(CDN·GitHub). 60초 폴백은 가능하지만 수업 시작 전 점검이 필요하다.

## 7. 블록 표 추출기 연계 (extract-blocks.py)
- 새 확장을 받으면 먼저 `python3 extract-blocks.py <github-url> --out blocks.json --md blocks.md`로 네임스페이스·함수·enum·한국어 블록 문구를 뽑는다.
- 결과 활용: (1) `namespaces[].name` → `ASYNC_NS`/`blockPackage` 정규식 후보, (2) `enums[]` → `deflib` 유사 객체 초안(값 포함),
  (3) `functions[]`(숨김 제외) → 시뮬레이터가 구현해야 할 API 목록과 `block_ko` 기반 교안 용어표(`docs/10_블록_한눈표.md` 갱신 근거).
- 한계: 정적 분석이라 `//% blockCombine`, 클래스 메서드, 생성되는 enum, `shim=` 함수 본문은 다루지 않는다.
