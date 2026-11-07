// Shared helpers for the 8차시 전체형 Word documents (docx-js). A4, 맑은 고딕.
const fs = require('fs');
const path = require('path');
const D = require('docx');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType,
  BorderStyle, AlignmentType, ImageRun, Header, Footer, HeightRule, VerticalAlign, TabStopType, Tab,
  LineRuleType,
} = D;

const state = { k: 1, f: 1 };
const K = (k, f = 1) => { state.k = k; state.f = f; };
const FONT = '맑은 고딕';
const C = { blue: '2456E5', ink: '111827', sub: '566077', bg: 'F4F6FA', line: '9AA3B5',
  red: 'E5484D', yellow: 'F2B300', green: '1FA463', orange: 'F08A24', paleBlue: 'E8EEFD',
  paleRed: 'FDECEC', paleOrange: 'FFF4E5', white: 'FFFFFF' };
const W = 9906; // content width with 1000 side margins
const ASSETS = '/home/user/microbit/bridge/lessons/assets/';
const IMG = path.join(__dirname, 'img') + '/';

function runs(text, o = {}) {
  const parts = String(text).split('**');
  return parts.map((t, i) => new TextRun({
    text: t, font: FONT, size: Math.round((o.sz || 21) * state.f), bold: o.bold || i % 2 === 1, color: o.color || C.ink,
    italics: o.italics,
  })).filter((r, i) => true);
}
function para(text, o = {}) {
  return new Paragraph({
    children: runs(text, o),
    alignment: o.align,
    keepNext: o.keepNext,
    keepLines: true,
    spacing: { before: Math.round((o.before ?? 0) * state.k), after: Math.round((o.after ?? 80) * state.k), line: o.line, lineRule: o.line ? (o.exact ? LineRuleType.EXACT : LineRuleType.AUTO) : undefined },
    indent: o.indent,
    border: o.border,
    shading: o.fill ? { type: ShadingType.CLEAR, fill: o.fill, color: 'auto' } : undefined,
  });
}
function h(title, o = {}) {
  return para(title, { sz: o.sz || 32, bold: true, color: C.blue, after: 100, before: 0, keepNext: true,
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: C.blue, space: 4 } } });
}
function small(text, o = {}) { return para(text, { sz: 17, color: C.sub, after: 80, ...o }); }
function label(text, o = {}) { return para(text, { sz: 22, bold: true, before: 140, after: 60, keepNext: true, ...o }); }
// handwriting lines
function lines(n, gap = 500) {
  gap = Math.round(gap * state.k);
  const out = [];
  for (let i = 0; i < n; i++) out.push(new Paragraph({
    children: [new TextRun({ text: '', font: FONT, size: 20 })],
    spacing: { before: 0, after: 0, line: gap, lineRule: LineRuleType.EXACT },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: C.line, space: 1 } },
  }));
  return out;
}
function gap(tw = 120) { return new Paragraph({ children: [new TextRun({ text: '', size: 2 })], spacing: { before: 0, after: 0, line: tw, lineRule: LineRuleType.EXACT } }); }
function tiny() { return new Paragraph({ children: [new TextRun({ text: '', size: 2 })], spacing: { before: 0, after: 0, line: 20, lineRule: LineRuleType.EXACT } }); }

function pngSize(file) { const b = fs.readFileSync(file); return [b.readUInt32BE(16), b.readUInt32BE(20)]; }
function image(file, widthPx, o = {}) {
  const [w, h2] = pngSize(file);
  return new Paragraph({
    alignment: o.align || AlignmentType.CENTER,
    spacing: { before: o.before ?? 0, after: o.after ?? 0 },
    keepNext: o.keepNext,
    children: [new ImageRun({ type: 'png', data: fs.readFileSync(file),
      transformation: { width: widthPx, height: Math.round(widthPx * h2 / w) },
      altText: { title: o.alt || 'image', description: o.alt || 'image', name: o.alt || 'image' } })],
  });
}

const thin = (c = C.sub, sz = 6, style = BorderStyle.SINGLE) => ({ style, size: sz, color: c });
function cell(spec, o = {}) {
  const s = (typeof spec === 'object' && spec !== null && !Array.isArray(spec) && !(spec instanceof Paragraph) && spec.t !== undefined) ? spec : { t: spec };
  const w = s.w ?? o.w;
  const content = Array.isArray(s.t) ? s.t : [s.t];
  const children = content.map((x) => (x instanceof Paragraph || x instanceof Table) ? x :
    para(String(x), { sz: s.sz || o.sz || 19, bold: s.bold ?? o.bold, color: s.color || o.color, align: s.align || o.align, after: 20, before: 0 }));
  if (!children.length || children[children.length - 1] instanceof Table) children.push(tiny());
  const bc = s.borderColor || o.borderColor || C.sub;
  const style = s.dashed || o.dashed ? BorderStyle.DASHED : BorderStyle.SINGLE;
  const nb = s.noBorder || o.noBorder;
  const b = nb ? { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } : thin(bc, 6, style);
  return new TableCell({
    width: { size: w, type: WidthType.DXA },
    columnSpan: s.span,
    verticalAlign: s.valign || o.valign || VerticalAlign.CENTER,
    shading: (s.fill || o.fill) ? { type: ShadingType.CLEAR, fill: s.fill || o.fill, color: 'auto' } : undefined,
    borders: { top: b, bottom: b, left: b, right: b },
    margins: { top: s.mt ?? 60, bottom: s.mt ?? 60, left: 90, right: 90 },
    children,
  });
}
// table(widths, rows, {header:[...], h: min row height, hh: header height, sz, align per column})
function table(widths, rows, o = {}) {
  const total = widths.reduce((a, b) => a + b, 0);
  const trs = [];
  if (o.header) {
    trs.push(new TableRow({ tableHeader: true, cantSplit: true,
      height: { value: o.hh || 380, rule: HeightRule.ATLEAST },
      children: o.header.map((t, i) => cell({ t, fill: C.blue, color: C.white, bold: true, align: AlignmentType.CENTER }, { w: widths[i], sz: o.hsz || 19 })) }));
  }
  rows.forEach((r, ri) => {
    let rowH = r.h || (Array.isArray(o.hs) ? o.hs[ri] : o.h);
    if (rowH && !o.exact) rowH = Math.round(rowH * state.k);
    const cells = (r.cells || r);
    let ci = 0;
    const tcs = cells.map((c) => {
      const spec = (typeof c === 'object' && c !== null && !Array.isArray(c) && !(c instanceof Paragraph) && c.t !== undefined) ? c : { t: c };
      const span = spec.span || 1;
      const w = widths.slice(ci, ci + span).reduce((a, b) => a + b, 0);
      const al = o.aligns ? o.aligns[ci] : undefined;
      ci += span;
      return cell(spec, { w, sz: o.sz, align: al, valign: o.valign, fill: o.fill });
    });
    trs.push(new TableRow({ cantSplit: true, height: rowH ? { value: rowH, rule: o.exact ? HeightRule.EXACT : HeightRule.ATLEAST } : undefined, children: tcs }));
  });
  return new Table({ width: { size: total, type: WidthType.DXA }, columnWidths: widths, rows: trs, alignment: o.align });
}
// info box (shaded single cell)
function box(lines_, o = {}) {
  const fill = o.fill || C.paleBlue; const bc = o.border || C.blue;
  return new Table({ width: { size: o.w || W, type: WidthType.DXA }, columnWidths: [o.w || W],
    rows: [new TableRow({ cantSplit: true, children: [cell({ t: lines_, fill, borderColor: bc }, { w: o.w || W, sz: o.sz || 19, valign: VerticalAlign.TOP })] })] });
}
const CB = (t, o = {}) => para('☐  ' + t, { sz: o.sz || 21, after: o.after ?? 100, ...o });

function hdrPara(suffix, o = {}) {
  const kids = [new TextRun({ text: '피지컬 AI 교실 · 로보독' + (suffix ? '  |  ' + suffix : ''), font: FONT, bold: true, color: C.blue, size: 22 })];
  if (o.name) kids.push(new TextRun({ children: [new Tab(), '모둠 ____  이름 ________'], font: FONT, color: C.sub, size: 18 }));
  return new Paragraph({ children: kids, spacing: { after: 0 },
    tabStops: [{ type: TabStopType.RIGHT, position: o.pos || W }],
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: C.blue, space: 3 } } });
}
function footPara(text) {
  return new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { before: 0, after: 0 },
    children: [new TextRun({ text, font: FONT, size: 15, color: C.sub })] });
}
// one section = one page (or more if the content overflows)
function section(children, o = {}) {
  const m = o.margin || { top: 1300, right: 1000, bottom: 900, left: 1000 };
  return {
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { ...m, header: o.noHeader ? 300 : 708, footer: 400 } } },
    headers: o.noHeader ? undefined : { default: new Header({ children: [hdrPara(o.hdrSuffix || '', { name: o.name, pos: (11906 - m.left - m.right) }) ] }) },
    footers: { default: new Footer({ children: [footPara(o.footer || '')] }) },
    children,
  };
}
function makeDoc(sections, title) {
  return new Document({
    creator: '피지컬 AI 교실', title,
    styles: { default: { document: { run: { font: FONT, size: 21 } } } },
    sections,
  });
}
async function save(doc, file) { fs.writeFileSync(file, await Packer.toBuffer(doc)); console.log('wrote', file); }

module.exports = { K, state, D, C, W, FONT, ASSETS, IMG, para, h, small, label, lines, gap, tiny, image, cell, table, box, CB,
  section, makeDoc, save, runs, pngSize, AlignmentType, VerticalAlign, BorderStyle, Paragraph, TextRun, ShadingType, HeightRule, WidthType, Table, TableRow, TableCell, LineRuleType };
