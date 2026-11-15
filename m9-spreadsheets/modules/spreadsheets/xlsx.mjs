// A zip writer and reader, an .xlsx writer and reader, and CSV (RFC 4180), with Node's own zlib: no packages.
import zlib from 'node:zlib';

// ---------- zip ----------
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

export function zip(files) { // [{ name, data: Buffer|string }]
  const locals = [], centrals = [];
  let offset = 0;
  for (const f of files) {
    const data = Buffer.isBuffer(f.data) ? f.data : Buffer.from(f.data, 'utf8');
    const comp = zlib.deflateRawSync(data);
    const name = Buffer.from(f.name, 'utf8');
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
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

export function unzip(buf) { // -> Map(name -> Buffer)
  let e = buf.length - 22;
  while (e >= 0 && buf.readUInt32LE(e) !== 0x06054b50) e--;
  if (e < 0) throw new Error('not a zip');
  const n = buf.readUInt16LE(e + 10);
  let p = buf.readUInt32LE(e + 16);
  const out = new Map();
  for (let i = 0; i < n; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20);
    const nl = buf.readUInt16LE(p + 28), xl = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32), lo = buf.readUInt32LE(p + 42);
    const name = buf.slice(p + 46, p + 46 + nl).toString('utf8');
    const lnl = buf.readUInt16LE(lo + 26), lxl = buf.readUInt16LE(lo + 28);
    const raw = buf.slice(lo + 30 + lnl + lxl, lo + 30 + lnl + lxl + csize);
    out.set(name, method === 8 ? zlib.inflateRawSync(raw) : raw);
    p += 46 + nl + xl + cl;
  }
  return out;
}
export const isZip = (buf) => buf.length > 4 && buf.readUInt32LE(0) === 0x04034b50;

// ---------- xlsx ----------
const x = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const colName = (i) => { let s = ''; i++; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
const colIndex = (ref) => { const m = ref.match(/^[A-Z]+/)[0]; let n = 0; for (const ch of m) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };

// sheets: [{ name, rows: [[cell]], bold?: Set(colIndex) for row 1, grey?: Set(colIndex) }]
// a cell is a string (written as text, exactly) or a number (written as a number)
export function writeXlsx(sheets) {
  const files = [];
  files.push({ name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>` });
  files.push({ name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` });
  files.push({ name: 'xl/workbook.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${x(s.name.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>` });
  files.push({ name: 'xl/_rels/workbook.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` });
  // styles: 0 normal, 1 bold, 2 grey, 3 grey bold
  files.push({ name: 'xl/styles.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="4"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><sz val="11"/><color rgb="FF808080"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FF808080"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="4"><xf fontId="0"/><xf fontId="1" applyFont="1"/><xf fontId="2" applyFont="1"/><xf fontId="3" applyFont="1"/></cellXfs></styleSheet>` });
  sheets.forEach((s, i) => {
    const rows = s.rows.map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => {
      if (v === null || v === undefined || v === '') return '';
      const ref = `${colName(ci)}${ri + 1}`;
      const st = (ri === 0 && s.bold?.has(ci) ? 1 : 0) + (s.grey?.has(ci) ? 2 : 0);
      const sa = st ? ` s="${st}"` : '';
      if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}"${sa}><v>${v}</v></c>`;
      return `<c r="${ref}" t="inlineStr"${sa}><is><t xml:space="preserve">${x(v)}</t></is></c>`;
    }).join('')}</row>`).join('');
    files.push({ name: `xl/worksheets/sheet${i + 1}.xml`, data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData></worksheet>` });
  });
  return zip(files);
}

const unx = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&amp;/g, '&');
const textOf = (xml) => { let s = ''; const re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g; let m; while ((m = re.exec(xml))) s += m[1] ? unx(m[1]) : ''; return s; };

// -> [{ name, rows: [[string]] }] ; numbers come back as their shortest text
export function readXlsx(buf) {
  const files = unzip(buf);
  const get = (n) => files.get(n)?.toString('utf8');
  const wb = get('xl/workbook.xml') || '';
  const rels = get('xl/_rels/workbook.xml.rels') || '';
  const relMap = {};
  for (const m of rels.matchAll(/<Relationship\b([^>]*)\/?>/g)) { const id = m[1].match(/Id="([^"]+)"/)?.[1]; const t = m[1].match(/Target="([^"]+)"/)?.[1]; if (id && t) relMap[id] = t.replace(/^\/?xl\//, '').replace(/^\//, ''); }
  const shared = [];
  const ss = get('xl/sharedStrings.xml');
  if (ss) for (const m of ss.matchAll(/<si>([\s\S]*?)<\/si>/g)) shared.push(textOf(m[1]));
  const out = [];
  for (const m of wb.matchAll(/<sheet\b([^>]*)\/?>/g)) {
    const name = unx(m[1].match(/name="([^"]*)"/)?.[1] ?? '');
    const rid = m[1].match(/r:id="([^"]+)"/)?.[1];
    const xml = get(`xl/${relMap[rid] || ''}`) || '';
    const rows = [];
    for (const rm of xml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
      const rn = Number(rm[1].match(/r="(\d+)"/)?.[1] ?? rows.length + 1) - 1;
      const row = [];
      for (const cm of (rm[2] || '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const attrs = cm[1];
        const ref = attrs.match(/r="([A-Z]+)\d+"/)?.[1];
        const ci = ref ? colIndex(ref) : row.length;
        const t = attrs.match(/t="([^"]+)"/)?.[1];
        const inner = cm[2] || '';
        let v = '';
        if (t === 'inlineStr') v = textOf(inner);
        else { const vm = inner.match(/<v>([\s\S]*?)<\/v>/); const raw = vm ? unx(vm[1]) : ''; v = t === 's' ? shared[+raw] ?? '' : t === 'b' ? (raw === '1' ? 'TRUE' : 'FALSE') : raw; if (!t || t === 'n') { if (raw !== '' && Number.isFinite(+raw)) v = String(+raw); } }
        row[ci] = v;
      }
      for (let i = 0; i < row.length; i++) if (row[i] === undefined) row[i] = '';
      rows[rn] = row;
    }
    for (let i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = [];
    out.push({ name, rows });
  }
  return out;
}

// ---------- CSV ----------
const GUARD = /^[=+\-@\t\r]/;
export function csvCell(v, guard = true) {
  if (v === null || v === undefined) return '';
  let s = String(v);
  if (guard && typeof v === 'string' && GUARD.test(s) && !/^-?\d+(\.\d+)?$/.test(s) && s !== '—') s = `'${s}`;
  return /[",\n\r]/.test(s) || s !== s.trim() ? `"${s.replace(/"/g, '""')}"` : s;
}
export const writeCsv = (rows) => '﻿' + rows.map((r) => r.map((c) => csvCell(c)).join(',')).join('\r\n') + '\r\n';

// one RFC 4180 pass: quotes, line breaks in a cell, a byte-order mark; tab-separated when a tab comes before any comma
export function readCsv(text) {
  let s = String(text).replace(/^﻿/, '');
  const firstLine = s.split(/\r?\n/)[0] || '';
  const sep = firstLine.includes('\t') && (!firstLine.includes(',') || firstLine.indexOf('\t') < firstLine.indexOf(',')) ? '\t' : ',';
  const rows = []; let row = [], cell = '', q = false, quoted = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) { if (ch === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; continue; }
    if (ch === '"' && cell === '') { q = true; quoted = true; continue; }
    if (ch === sep) { row.push(unguard(cell, quoted)); cell = ''; quoted = false; continue; }
    if (ch === '\r') continue;
    if (ch === '\n') { row.push(unguard(cell, quoted)); rows.push(row); row = []; cell = ''; quoted = false; continue; }
    cell += ch;
  }
  if (cell !== '' || row.length) { row.push(unguard(cell, quoted)); rows.push(row); }
  return rows;
}
const unguard = (c) => (/^'[=+\-@\t\r]/.test(c) ? c.slice(1) : c);
