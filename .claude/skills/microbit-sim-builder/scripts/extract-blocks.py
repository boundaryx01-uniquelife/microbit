#!/usr/bin/env python3
"""MakeCode 확장(pxt) 소스에서 블록 표를 뽑는다 (stdlib only).

Usage:
  python3 extract-blocks.py <github-url | owner/repo[#commit] | folder> [--out blocks.json] [--md blocks.md]

- GitHub: raw.githubusercontent.com 에서 master -> main 순으로 시도 (HTTPS_PROXY 환경변수는 urllib 기본 동작으로 따름)
- pxt.json -> "files" 의 각 .ts 를 읽어 //% 주석, namespace, export function, enum 을 파싱
- _locales/ko/*-strings.json 이 있으면 block_ko 채움
"""
import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request

UA = {"User-Agent": "extract-blocks/1.0"}


# ---------------------------------------------------------------- 입력 소스
class Source:
    def read(self, path):  # -> str | None
        raise NotImplementedError

    def list_locale_files(self, lang):  # -> [path]
        return []


class LocalSource(Source):
    def __init__(self, root):
        self.root = root

    def read(self, path):
        p = os.path.join(self.root, path)
        if not os.path.isfile(p):
            return None
        with open(p, encoding="utf-8-sig") as f:
            return f.read()

    def list_locale_files(self, lang):
        d = os.path.join(self.root, "_locales", lang)
        if not os.path.isdir(d):
            return []
        return ["_locales/%s/%s" % (lang, n) for n in sorted(os.listdir(d)) if n.endswith("-strings.json")]


class GithubSource(Source):
    def __init__(self, owner, repo, ref=None):
        self.owner, self.repo, self.ref = owner, repo, ref
        self._tree = None
        if not self.ref:
            for b in ("master", "main"):
                if self._get("pxt.json", b) is not None:
                    self.ref = b
                    break
            if not self.ref:
                raise SystemExit("pxt.json 을 master/main 에서 찾지 못했습니다: %s/%s" % (owner, repo))

    def _get(self, path, ref=None):
        url = "https://raw.githubusercontent.com/%s/%s/%s/%s" % (self.owner, self.repo, ref or self.ref, path)
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
                return r.read().decode("utf-8-sig")
        except urllib.error.HTTPError as e:
            if e.code in (404, 403):
                return None
            raise
        except urllib.error.URLError as e:
            sys.stderr.write("네트워크 오류 %s: %s\n" % (url, e))
            return None

    def read(self, path):
        return self._get(path)

    def list_locale_files(self, lang):
        pre = "_locales/%s/" % lang
        try:
            url = "https://api.github.com/repos/%s/%s/git/trees/%s?recursive=1" % (self.owner, self.repo, self.ref)
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
                tree = json.loads(r.read().decode("utf-8"))
            return sorted(t["path"] for t in tree.get("tree", [])
                          if t["path"].startswith(pre) and t["path"].endswith("-strings.json"))
        except Exception:
            pass
        # API 가 막힌 경우: 이름 추측
        pj = json.loads(self.read("pxt.json") or "{}")
        guesses = {pj.get("name", ""), self.repo, re.sub(r"^pxt-", "", self.repo)}
        out = []
        for g in guesses:
            if g and self._get("%s%s-strings.json" % (pre, g)) is not None:
                out.append("%s%s-strings.json" % (pre, g))
        return out


def open_source(arg):
    if os.path.isdir(arg):
        return LocalSource(arg), arg
    m = re.match(r"^(?:https?://github\.com/)?([\w.-]+)/([\w.-]+?)(?:\.git)?(?:/tree/([^/#]+))?/?(?:#([\w.-]+))?$", arg)
    if not m:
        raise SystemExit("폴더도 GitHub 주소도 아닙니다: %s" % arg)
    return GithubSource(m.group(1), m.group(2), m.group(4) or m.group(3)), "%s/%s" % (m.group(1), m.group(2))


# ---------------------------------------------------------------- //% 파싱
KV = re.compile(r'([\w.]+)\s*=\s*("(?:[^"\\]|\\.)*"|\'(?:[^\'\\]|\\.)*\'|[^\s"\']+)')


def parse_annot(text):
    """'block="x" weight=90 speed.min=0' -> {'block':'x','weight':90,'speed.min':0}"""
    out = {}
    for k, v in KV.findall(text):
        if v[0] in "\"'":
            v = v[1:-1]
        elif re.fullmatch(r"-?\d+", v):
            v = int(v)
        elif re.fullmatch(r"-?\d*\.\d+", v):
            v = float(v)
        elif v in ("true", "false"):
            v = v == "true"
        out[k] = v
    # 값 없는 플래그(예: //% inline) 도 허용
    rest = KV.sub("", text).split()
    for tok in rest:
        if re.fullmatch(r"[A-Za-z_][\w.]*", tok):
            out.setdefault(tok, True)
    return out


def strip_code(line, state):
    """주석·문자열을 지운 코드만 돌려줌 (블록주석 상태 state['block'] 유지)."""
    res, i, n = [], 0, len(line)
    while i < n:
        if state["block"]:
            j = line.find("*/", i)
            if j < 0:
                return "".join(res)
            state["block"] = False
            i = j + 2
            continue
        c = line[i]
        if line.startswith("//", i):
            break
        if line.startswith("/*", i):
            state["block"] = True
            i += 2
            continue
        if c in "\"'`":
            q = c
            i += 1
            while i < n and line[i] != q:
                i += 2 if line[i] == "\\" else 1
            i += 1
            res.append('""')
            continue
        res.append(c)
        i += 1
    return "".join(res)


def split_top(s, sep=","):
    parts, depth, cur, q = [], 0, [], None
    for c in s:
        if q:
            cur.append(c)
            if c == q:
                q = None
            continue
        if c in "\"'`":
            q = c
        elif c in "([{<":
            depth += 1
        elif c in ")]}>":
            depth -= 1 if not (c == ">" and cur and cur[-1] == "=") else 0
        if c == sep and depth == 0:
            parts.append("".join(cur))
            cur = []
        else:
            cur.append(c)
    if "".join(cur).strip():
        parts.append("".join(cur))
    return parts


def parse_param(p, annot):
    p = p.strip()
    m = re.match(r"^(?:\.\.\.)?([\w$]+)(\?)?\s*(?::\s*(.+?))?(?:\s*=\s*(.+))?$", p, re.S)
    if not m:
        return {"name": p, "type": None, "min": None, "max": None, "default": None}
    name, opt, typ, dflt = m.groups()
    if typ and "=" in typ and dflt is None:  # 'x: number = 5' 정규식 보정
        typ, dflt = [x.strip() for x in typ.split("=", 1)]
    d = {"name": name, "type": typ.strip() if typ else None,
         "min": annot.get(name + ".min"), "max": annot.get(name + ".max"),
         "default": annot.get(name + ".defl", dflt.strip() if dflt else None)}
    for extra in ("shadow", "fieldEditor", "dd", "shadowOptions.toString"):
        if (name + "." + extra) in annot:
            d[extra.split(".")[0]] = annot[name + "." + extra]
    if opt:
        d["optional"] = True
    return d


def parse_ts(text, fname):
    """-> (namespaces{name:{functions,enums,meta}}, warnings)"""
    nss = {}
    stack = []  # [(kind, name, depth_at_open)]
    depth = 0
    pend = {}  # 대기중인 //% 주석
    pend_has = False
    state = {"block": False}
    lines = text.split("\n")
    i = 0

    def cur_ns():
        names = [s[1] for s in stack if s[0] == "ns"]
        return ".".join(names) if names else None

    def ns_entry(name):
        return nss.setdefault(name, {"name": name, "functions": [], "enums": [], "meta": {}})

    while i < len(lines):
        raw = lines[i]
        s = raw.strip()
        m = re.match(r"^//%\s?(.*)$", s)
        if m and not state["block"]:
            pend.update(parse_annot(m.group(1)))
            pend_has = True
            i += 1
            continue
        code = strip_code(raw, state)
        c = code.strip()
        if not c:
            i += 1
            continue

        # 선언 한 개가 여러 줄이면 '{' 또는 ';' 까지 이어붙임
        def gather(first):
            nonlocal i
            buf = first
            while buf.count("(") > buf.count(")") or (not re.search(r"[{;]\s*$", buf) and re.search(r"\)\s*(:[^{;]*)?$", buf) is None):
                i += 1
                if i >= len(lines):
                    break
                buf += " " + strip_code(lines[i], state).strip()
            return buf

        in_enum = stack and stack[-1][0] == "enum"
        handled = False
        if in_enum:
            # enum 멤버
            mm = re.match(r"^([\w$]+)\s*(?:=\s*([^,]+?))?\s*,?\s*$", c)
            if mm and not c.startswith("}"):
                e = stack[-1][3]
                e["members"].append({"name": mm.group(1), "value": mm.group(2).strip() if mm.group(2) else None,
                                     "annot": pend, "block_en": pend.get("block"), "block_ko": None,
                                     "blockHidden": bool(pend.get("blockHidden"))})
                handled = True
        else:
            mn = re.match(r"^(?:export\s+)?(?:declare\s+)?namespace\s+([\w$.]+)\s*\{?", c)
            me = re.match(r"^(?:export\s+)?(?:declare\s+)?(?:const\s+)?enum\s+([\w$]+)\s*\{?", c)
            mf = re.match(r"^(?:export\s+)?(?:declare\s+)?(?:async\s+)?function\s+([\w$]+)\s*(?:<[^>]*>)?\s*\(", c)
            mc = re.match(r"^(?:export\s+)?(?:declare\s+)?class\s+([\w$]+)", c)
            if mn:
                name = mn.group(1)
                full = (cur_ns() + "." if cur_ns() else "") + name
                ent = ns_entry(full)
                ent["meta"].update({k: v for k, v in pend.items()})
                if "{" in c:
                    stack.append(("ns", name, depth, None))
                handled = True
                pend = {}
                pend_has = False
                # 같은 줄의 '{' 는 아래 depth 계산에서 처리됨
            elif me:
                ns = cur_ns() or "(global)"
                e = {"name": me.group(1), "members": [], "annot": pend, "block_en": pend.get("block")}
                ns_entry(ns)["enums"].append(e)
                if "{" in c:
                    stack.append(("enum", me.group(1), depth, e))
                handled = True
                pend = {}
                pend_has = False
            elif mf and (pend_has or "export" in c.split("function")[0]) and "export" in c.split("function")[0]:
                sig = gather(c)
                ns = cur_ns() or "(global)"
                annot = pend
                pm = re.match(r"^.*?function\s+([\w$]+)\s*(?:<[^>]*>)?\s*\((.*)\)\s*(?::\s*([^{;]+?))?\s*[{;]?\s*$", sig, re.S)
                if pm:
                    fname_, params_s, ret = pm.group(1), pm.group(2), pm.group(3)
                    params = [parse_param(p, annot) for p in split_top(params_s)]
                    ns_entry(annot.get("blockNamespace", ns))["functions"].append({
                        "name": fname_, "params": params, "returns": ret.strip() if ret else "void",
                        "block_en": annot.get("block"), "block_ko": None, "blockId": annot.get("blockId"),
                        "group": annot.get("group"), "weight": annot.get("weight"),
                        "hidden": bool(annot.get("blockHidden")) or annot.get("block") is None and annot.get("blockId") is None,
                        "blockHidden": bool(annot.get("blockHidden")),
                        "has_block": annot.get("block") is not None or annot.get("blockId") is not None,
                        "file": fname, "annot": annot,
                    })
                    code = sig  # 중괄호 계산용
                handled = True
                pend = {}
                pend_has = False
            elif mc:
                pend = {}
                pend_has = False
            elif not c.startswith("}") and pend_has:
                pend = {}
                pend_has = False
            else:
                if not c.startswith("}"):
                    pend = {}
                    pend_has = False
        if handled and in_enum:
            pend = {}
            pend_has = False
        # 중괄호 깊이 갱신 (gather 로 이어붙인 경우 code 는 시그니처 전체)
        for ch in code:
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                while stack and depth <= stack[-1][2]:
                    stack.pop()
        i += 1
    return nss


# ---------------------------------------------------------------- 로케일
def load_locale(src, lang):
    strings = {}
    for p in src.list_locale_files(lang):
        t = src.read(p)
        if t:
            try:
                strings.update(json.loads(t))
            except ValueError:
                sys.stderr.write("로케일 JSON 오류: %s\n" % p)
    return strings


def apply_locale(nss, strings):
    if not strings:
        return 0
    n = 0
    for ns_name, ns in nss.items():
        last = ns_name.split(".")[-1]
        for f in ns["functions"]:
            for key in ("%s.%s|block" % (ns_name, f["name"]), "%s.%s|block" % (last, f["name"]),
                        "{id:%s}|block" % ns_name if False else "", "%s|block" % f["name"]):
                if key and key in strings:
                    f["block_ko"] = strings[key]
                    n += 1
                    break
            for p in f["params"]:
                for key in ("%s.%s|param|%s" % (ns_name, f["name"], p["name"]),):
                    if key in strings:
                        p["label_ko"] = strings[key]
        for e in ns["enums"]:
            for mem in e["members"]:
                for key in ("%s.%s|block" % (e["name"], mem["name"]), "%s.%s.%s|block" % (ns_name, e["name"], mem["name"]),
                            "%s.%s.%s|block" % (last, e["name"], mem["name"])):
                    if key in strings:
                        mem["block_ko"] = strings[key]
                        n += 1
                        break
        if ns_name + "|block" in strings:
            ns["meta"]["block_ko"] = strings[ns_name + "|block"]
        # 네임스페이스 이름 키 (예: "maqueenPlusV2": "마퀸 플러스") 지원
        if ns_name in strings and isinstance(strings[ns_name], str):
            ns["meta"]["name_ko"] = strings[ns_name]
    return n


# ---------------------------------------------------------------- 출력
def build(src, label, lang="ko"):
    pj_text = src.read("pxt.json")
    if pj_text is None:
        raise SystemExit("pxt.json 이 없습니다")
    pj = json.loads(pj_text)
    files = [f for f in pj.get("files", []) if f.endswith(".ts") and not f.endswith(".d.ts") or f.endswith(".d.ts") and False]
    nss = {}
    missing = []
    for f in files:
        t = src.read(f)
        if t is None:
            missing.append(f)
            continue
        for name, ent in parse_ts(t, f).items():
            dst = nss.setdefault(name, {"name": name, "functions": [], "enums": [], "meta": {}})
            dst["functions"] += ent["functions"]
            dst["enums"] += ent["enums"]
            dst["meta"].update(ent["meta"])
    strings = load_locale(src, lang)
    ko_hits = apply_locale(nss, strings)
    out_ns = []
    for name, ent in nss.items():
        if not ent["functions"] and not ent["enums"]:
            continue
        funcs = []
        for f in ent["functions"]:
            funcs.append({k: f[k] for k in ("name", "params", "returns", "block_en", "block_ko", "blockId", "group",
                                            "weight", "hidden", "file")})
        enums = [{"name": e["name"], "block_en": e.get("block_en"),
                  "members": [{"name": m["name"], "value": m["value"], "block_en": m["block_en"], "block_ko": m["block_ko"]}
                              for m in e["members"]]} for e in ent["enums"]]
        out_ns.append({"name": name, "meta": ent["meta"], "functions": funcs, "enums": enums})
    return {
        "extension": {"id": label, "name": pj.get("name"), "version": pj.get("version"),
                      "dependencies": pj.get("dependencies", {}), "files": pj.get("files", []),
                      "ref": getattr(src, "ref", None), "missing_files": missing,
                      "locale_strings": len(strings), "locale_hits": ko_hits},
        "namespaces": out_ns,
    }


def to_md(data):
    ex = data["extension"]
    L = ["# %s (%s) 블록 표" % (ex.get("name") or ex["id"], ex.get("version") or "?"), "",
         "출처: `%s`%s. 숨김(hidden) = 블록으로 보이지 않는 함수.  " % (ex["id"], " @" + ex["ref"] if ex.get("ref") else ""),
         "의존성: %s" % (", ".join("`%s`" % k for k in ex["dependencies"]) or "-"), ""]
    esc = lambda x: ("" if x is None else str(x)).replace("|", "\\|")
    for ns in data["namespaces"]:
        L += ["## namespace `%s`" % ns["name"], ""]
        if ns["functions"]:
            L += ["| 함수 | 영어 블록 | 한국어 블록 | 인자(형, 범위, 기본) | 반환 | blockId | group | 숨김 |", "|---|---|---|---|---|---|---|---|"]
            for f in ns["functions"]:
                ps = "; ".join("%s: %s%s%s" % (p["name"], p["type"] or "?",
                               (" [%s..%s]" % (p["min"] if p["min"] is not None else "", p["max"] if p["max"] is not None else ""))
                               if (p["min"] is not None or p["max"] is not None) else "",
                               (" =" + str(p["default"])) if p["default"] is not None else "") for p in f["params"])
                L.append("| `%s` | %s | %s | %s | %s | %s | %s | %s |" % (
                    f["name"], esc(f["block_en"]), esc(f["block_ko"]), esc(ps), esc(f["returns"]), esc(f["blockId"]),
                    esc(f["group"]), "예" if f["hidden"] else ""))
            L.append("")
        for e in ns["enums"]:
            L += ["### enum `%s`" % e["name"], "", "| 멤버 | 값 | 영어 | 한국어 |", "|---|---|---|---|"]
            for m in e["members"]:
                L.append("| `%s` | %s | %s | %s |" % (m["name"], esc(m["value"]), esc(m["block_en"]), esc(m["block_ko"])))
            L.append("")
    return "\n".join(L) + "\n"


def main():
    ap = argparse.ArgumentParser(description="MakeCode 확장 블록 표 추출기")
    ap.add_argument("source", help="GitHub URL / owner/repo / 로컬 폴더")
    ap.add_argument("--out", help="JSON 출력 파일 (생략하면 stdout)")
    ap.add_argument("--md", help="Markdown 표 출력 파일")
    ap.add_argument("--lang", default="ko", help="_locales 언어 폴더 (기본 ko)")
    a = ap.parse_args()
    src, label = open_source(a.source)
    data = build(src, label, a.lang)
    js = json.dumps(data, ensure_ascii=False, indent=2)
    if a.out:
        with open(a.out, "w", encoding="utf-8") as f:
            f.write(js + "\n")
    elif not a.md:
        print(js)
    if a.md:
        with open(a.md, "w", encoding="utf-8") as f:
            f.write(to_md(data))
    nf = sum(len(n["functions"]) for n in data["namespaces"])
    ne = sum(len(n["enums"]) for n in data["namespaces"])
    nb = sum(1 for n in data["namespaces"] for f in n["functions"] if not f["hidden"])
    sys.stderr.write("namespaces=%d functions=%d (block %d) enums=%d locale_hits=%d\n"
                     % (len(data["namespaces"]), nf, nb, ne, data["extension"]["locale_hits"]))


if __name__ == "__main__":
    main()
