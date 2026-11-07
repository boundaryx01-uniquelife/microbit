// 동봉 모델과 인터넷 대체 모델(TF Hub classification/3)의 특징 벡터가 같은지 확인
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('http://127.0.0.1:8765/ai.html');
  await p.waitForFunction(() => /완료|실패/.test(document.getElementById('modelStatus').textContent), null, { timeout: 120000 });
  const r = await p.evaluate(async () => {
    const HUB = 'https://tfhub.dev/google/tfjs-model/imagenet/mobilenet_v2_050_224/classification/3/default/1';
    const local = await mobilenet.load({ version: 2, alpha: 0.5, modelUrl: 'model/model.json', inputRange: [0, 1] });
    const handler = tf.io.http(HUB + '/model.json?tfjs-format=file', { weightUrlConverter: async (n) => `${HUB}/${n}?tfjs-format=file` });
    const hub = await mobilenet.load({ version: 2, alpha: 0.5, modelUrl: handler, inputRange: [0, 1] });
    const x = tf.randomUniform([224, 224, 3], 0, 255).toInt();
    const a = local.infer(x, true), c = hub.infer(x, true);
    const diff = (await tf.max(tf.abs(tf.sub(a, c))).data())[0];
    return { len: a.shape, maxDiff: diff };
  });
  console.log('compat:', JSON.stringify(r));
  await b.close();
})().catch(e => { console.log('CRASH', e.message); process.exit(1); });
