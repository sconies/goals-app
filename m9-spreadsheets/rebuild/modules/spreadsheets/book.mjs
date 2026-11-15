// Files in and out, with no packages: a zip writer and reader (node:zlib), an .xlsx workbook written and read as
// its XML parts, and CSV (RFC 4180, UTF-8 with a byte-order mark, the formula guard).
import zlib from 'node:zlib';

// ---------- zip ----------
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (buf) => { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

export function zip(entries) {
  const locals = [], centrals = [];
  let offset = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name, 'utf8');
    const data = Buffer.isBuffer(e.data) ? e.data : Buffer.from(e.data, 'utf8');
    const comp = zlib.deflateRawSync(data);
    const crc = crc32(data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(8, 8);
    lh.writeUInt16LE(0, 10); lh.writeUInt16LE(0x21, 12); lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(data.length, 22);
    lh.writeUInt16LE(name.length, 26); lh.writeUInt16LE(0, 28);
    locals.push(lh, name, comp);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(8, 10);
    ch.writeUInt16LE(0, 12); ch.writeUInt16LE(0x21, 14); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(data.length, 24);
    ch.writeUInt16LE(name.length, 28); ch.writeUInt32LE(offset, 42);
    centrals.push(ch, name);
    offset += 30 + name.length + comp.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

export function unzip(buf) {
  let e = buf.length - 22;
  while (e >= 0 && buf.readUInt32LE(e) !== 0x06054b50) e--;
  if (e < 0) throw new Error('not a zip');
  const n = buf.readUInt16LE(e + 10);
  let p = buf.readUInt32LE(e + 16);
  const out = new Map();
  for (let i = 0; i < n; i++) {
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20), nlen = buf.readUInt16LE(p + 28), xlen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32), lo = buf.readUInt32LE(p + 42);
    const name = buf.slice(p + 46, p + 46 + nlen).toString('utf8');
    const ds = lo + 30 + buf.readUInt16LE(lo + 26) + buf.readUInt16LE(lo + 28);
    const raw = buf.slice(ds, ds + csize);
    out.set(name, method === 8 ? zlib.inflateRawSync(raw) : raw);
    p += 46 + nlen + xlen + clen;
  }
  return out;
}
export const isZip = (buf) => buf.length > 4 && buf.readUInt32LE(0) === 0x04034b50;

// ---------- xlsx ----------
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
const unesc = (s) => s.replace(/&(lt|gt|quot|apos|amp|#\d+|#x[0-9a-f]+);/gi, (m, x) => ({ lt: '<', gt: '>', quot: '"', apos: "'", amp: '&' })[x.toLowerCase()] ?? (x[1] === 'x' || x[1] === 'X' ? String.fromCodePoint(parseInt(x.slice(2), 16)) : String.fromCodePoint(parseInt(x.slice(1), 10))));
const colName = (i) => { let s = ''; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
const colIndex = (ref) => { const l = /^[A-Z]+/.exec(ref)[0]; let n = 0; for (const ch of l) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };

// sheets: [{ name, rows: [[cell…]…], bold: Set of header indexes, grey: Set of column indexes }]
// A cell that is a number is written as a number; everything else as text.
export function writeWorkbook(sheets) {
  const parts = [];
  const safeName = (n) => String(n).replace(/[\\/?*[\]:]/g, ' ').slice(0, 31);
  parts.push({ name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>` });
  parts.push({ name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` });
  parts.push({ name: 'xl/workbook.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${esc(safeName(s.name))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>` });
  parts.push({ name: 'xl/_rels/workbook.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((s, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` });
  // styles: 0 plain, 1 bold, 2 grey, 3 bold grey
  parts.push({ name: 'xl/styles.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="4"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><sz val="11"/><color rgb="FF808080"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FF808080"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="4"><xf fontId="0"/><xf fontId="1" applyFont="1"/><xf fontId="2" applyFont="1"/><xf fontId="3" applyFont="1"/></cellXfs></styleSheet>` });
  sheets.forEach((s, i) => {
    const bold = s.bold || new Set(), grey = s.grey || new Set();
    const xml = [];
    s.rows.forEach((row, r) => {
      const cells = [];
      row.forEach((v, c) => {
        if (v === undefined || v === null || v === '') return;
        const st = (r === 0 && bold.has(c) ? 1 : 0) + (grey.has(c) ? 2 : 0);
        const ref = `${colName(c)}${r + 1}`;
        const sa = st ? ` s="${st}"` : '';
        if (typeof v === 'number' && Number.isFinite(v)) cells.push(`<c r="${ref}"${sa}><v>${v}</v></c>`);
        else cells.push(`<c r="${ref}"${sa} t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`);
      });
      xml.push(`<row r="${r + 1}">${cells.join('')}</row>`);
    });
    parts.push({ name: `xl/worksheets/sheet${i + 1}.xml`, data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${xml.join('')}</sheetData></worksheet>` });
  });
  return zip(parts);
}

// -> [{ name, rows: [[string…]…] }] in the workbook's order; numbers as their shortest string
export function readWorkbook(buf) {
  const files = unzip(buf);
  const get = (n) => { const b = files.get(n); return b ? b.toString('utf8') : null; };
  const wb = get('xl/workbook.xml');
  if (!wb) throw new Error('not a workbook');
  const rels = get('xl/_rels/workbook.xml.rels') || '';
  const target = {};
  for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) { const id = /Id="([^"]+)"/.exec(m[0])?.[1], t = /Target="([^"]+)"/.exec(m[0])?.[1]; if (id && t) target[id] = t.replace(/^\/?xl\//, '').replace(/^\//, ''); }
  const shared = [];
  const ss = get('xl/sharedStrings.xml');
  if (ss) for (const m of ss.matchAll(/<si>([\s\S]*?)<\/si>/g)) shared.push([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => unesc(x[1])).join(''));
  const out = [];
  for (const m of wb.matchAll(/<sheet\b[^>]*>/g)) {
    const name = unesc(/name="([^"]*)"/.exec(m[0])[1]);
    const rid = /r:id="([^"]+)"/.exec(m[0])?.[1];
    const xml = get(`xl/${target[rid] || ''}`) || '';
    const rows = [];
    for (const rm of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>|<row\b([^>]*)\/>/g)) {
      const rn = Number(/r="(\d+)"/.exec(rm[1] || rm[3] || '')?.[1] || rows.length + 1);
      const row = [];
      let ci = 0;
      for (const cm of (rm[2] || '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const at = cm[1];
        const ref = /r="([A-Z]+)\d+"/.exec(at)?.[1];
        const c = ref ? colIndex(ref) : ci;
        ci = c + 1;
        const t = /t="([^"]+)"/.exec(at)?.[1];
        const body = cm[2] || '';
        let v = '';
        if (t === 'inlineStr') v = [...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => unesc(x[1])).join('');
        else { const vv = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1]; if (vv !== undefined) v = t === 's' ? shared[Number(vv)] ?? '' : t === 'b' ? (vv === '1' ? 'TRUE' : 'FALSE') : unesc(vv); }
        if (t !== 's' && t !== 'inlineStr' && t !== 'str' && t !== 'b' && v !== '' && /^-?\d/.test(v)) v = String(Number(v));
        row[c] = v;
      }
      for (let k = 0; k < row.length; k++) if (row[k] === undefined) row[k] = '';
      while (rows.length < rn - 1) rows.push([]);
      rows.push(row);
    }
    out.push({ name, rows });
  }
  return out;
}

// ---------- CSV ----------
const GUARD = /^[=+\-@\t\r]/;
export function csvCell(v, guard = true) {
  if (v === undefined || v === null) return '';
  let s = String(v);
  if (guard && typeof v !== 'number' && GUARD.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export const writeCsv = (rows) => '﻿' + rows.map((r) => r.map((c) => csvCell(c)).join(',')).join('\r\n') + '\r\n';

export function readCsv(text) {
  let t = text.replace(/^﻿/, '');
  const first = t.split(/\r?\n/, 1)[0];
  const sep = (first.match(/\t/g) || []).length > (first.match(/,/g) || []).length ? '\t' : ',';
  const rows = [];
  let row = [], cell = '', q = false, i = 0, quoted = false;
  const push = () => { row.push(quoted ? cell : unguard(cell)); cell = ''; quoted = false; };
  while (i < t.length) {
    const ch = t[i];
    if (q) {
      if (ch === '"') { if (t[i + 1] === '"') { cell += '"'; i += 2; continue; } q = false; i++; continue; }
      cell += ch; i++; continue;
    }
    if (ch === '"' && cell === '') { q = true; quoted = true; i++; continue; }
    if (ch === sep) { push(); i++; continue; }
    if (ch === '\r' || ch === '\n') { push(); rows.push(row); row = []; if (ch === '\r' && t[i + 1] === '\n') i++; i++; continue; }
    cell += ch; i++;
  }
  if (cell !== '' || row.length) { push(); rows.push(row); }
  return rows.map((r) => r.map((c) => unguard(c)));
}
const unguard = (s) => (/^'[=+\-@\t\r]/.test(s) ? s.slice(1) : s);
