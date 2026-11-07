// 웹 슬라이드 함께 보기 (Netlify Function) — 교사 화면의 슬라이드 번호를 학생 기기가 따라감
//   POST {op:"create", lesson}            → {room, key}   교사가 방(4자리 코드)을 만듦. key 는 교사 브라우저만 가짐
//   POST {op:"set", room, key, slide}     → {ok}          교사가 넘길 때마다 번호 저장
//   GET  ?room=1234                       → {lesson, slide, t}  학생이 몇 초마다 읽음
// 저장: Netlify Blobs(별도 설정 불필요). 비밀번호·개인정보는 저장하지 않음. 방은 4시간 뒤 만료.
import { getStore } from "@netlify/blobs";
import { createHash, randomBytes, randomInt } from "node:crypto";

const TTL = 4 * 60 * 60 * 1000;
const CREATE_PER_MIN = 10;          // 같은 IP 1분당 방 만들기 수(함수 인스턴스 단위의 간단한 제한)
const hits = new Map();
const mem = new Map();              // Blobs 를 못 쓰는 환경(로컬 시험)용

// Blobs 환경이 없으면(로컬 시험) 메모리로. 실제 배포에서 나는 다른 오류는 그대로 올림
const noEnv = (e) => e && (e.name === "MissingBlobsEnvironmentError" || /environment has not been configured/i.test(e.message || ""));
function store() {
  let s = null;
  try { s = getStore({ name: "lesson-sync", consistency: "strong" }); } catch (e) { if (!noEnv(e)) throw e; }
  const memGet = async (k) => mem.get(k) || null, memSet = async (k, v) => { mem.set(k, v); };
  if (!s) return { get: memGet, set: memSet };
  return {
    get: async (k) => { try { return await s.get(k, { type: "json" }); } catch (e) { if (noEnv(e)) return memGet(k); throw e; } },
    set: async (k, v) => { try { await s.setJSON(k, v); } catch (e) { if (noEnv(e)) return memSet(k, v); throw e; } },
  };
}
const json = (status, body) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
});
const sha = (s) => createHash("sha256").update(String(s)).digest("hex");
const okLesson = (l) => typeof l === "string" && l.length > 0 && l.length <= 40 && /^[\p{L}\p{N}_-]+$/u.test(l);
const okRoom = (r) => typeof r === "string" && /^\d{4}$/.test(r);
const alive = (v) => v && Date.now() - v.t < TTL;

export default async (req, context) => {
  const db = store();
  if (req.method === "GET") {
    const room = new URL(req.url).searchParams.get("room") || "";
    if (!okRoom(room)) return json(400, { error: "room" });
    const v = await db.get(room);
    if (!alive(v)) return json(404, { error: "no_room" });
    return json(200, { lesson: v.lesson, slide: v.slide, t: v.t });
  }
  if (req.method !== "POST") return json(405, { error: "method" });

  let b;
  try { b = await req.json(); } catch { return json(400, { error: "json" }); }
  if (!b || typeof b !== "object") return json(400, { error: "json" });

  if (b.op === "create") {
    if (!okLesson(b.lesson)) return json(400, { error: "lesson" });
    const ip = (context && context.ip) || req.headers.get("x-nf-client-connection-ip") || "?";
    const now = Date.now(), list = (hits.get(ip) || []).filter((t) => now - t < 60000);
    if (list.length >= CREATE_PER_MIN) return json(429, { error: "rate" });
    list.push(now); hits.set(ip, list);
    for (let i = 0; i < 20; i++) {
      const room = String(randomInt(1000, 10000));
      if (alive(await db.get(room))) continue;
      const key = randomBytes(18).toString("base64url");
      await db.set(room, { lesson: b.lesson, slide: 0, t: now, k: sha(key) });
      return json(200, { room, key });
    }
    return json(503, { error: "busy" });
  }

  if (b.op === "set") {
    if (!okRoom(b.room) || typeof b.key !== "string") return json(400, { error: "room" });
    const slide = Number(b.slide);
    if (!Number.isInteger(slide) || slide < 0 || slide > 999) return json(400, { error: "slide" });
    const v = await db.get(b.room);
    if (!alive(v)) return json(404, { error: "no_room" });
    if (v.k !== sha(b.key)) return json(403, { error: "key" });
    if (b.lesson !== undefined && !okLesson(b.lesson)) return json(400, { error: "lesson" });
    await db.set(b.room, { ...v, lesson: b.lesson || v.lesson, slide, t: Date.now() });
    return json(200, { ok: true });
  }
  return json(400, { error: "op" });
};

export const config = { path: "/api/lesson-sync" };
