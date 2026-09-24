const PDFDocument = require('pdfkit');

const FONT_REGULAR = require.resolve('dejavu-fonts-ttf/ttf/DejaVuSans.ttf');
const FONT_BOLD = require.resolve('dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf');

const COLORS = { ink: '#111827', muted: '#6b7280', line: '#e5e7eb', zebra: '#f9fafb', brand: '#4f46e5', head: '#111827', total: '#eef2ff' };

// ---------------------------------------------------------------- formatting

const inr = (n, decimals = 2) =>
  `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "6 Sep 2026" — fixed month names (Intl prints "Sept" for en-IN/en-GB). */
function formatDate(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(String(iso))) return iso ?? '';
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

function display(value, type) {
  if (value === null || value === undefined || value === '') return '';
  switch (type) {
    case 'money': return inr(value);
    case 'int': return Number(value).toLocaleString('en-IN');
    case 'decimal': return Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 });
    case 'percent': return `${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 1 })}%`;
    case 'date': return formatDate(value);
    default: return String(value);
  }
}

// ---------------------------------------------------------------- CSV

function csvCell(value, type) {
  if (value === null || value === undefined) return '';
  let s = String(value);
  // Spreadsheet formula injection: text starting with = + - @ would run as a formula in Excel.
  if (!['money', 'int', 'decimal', 'percent'].includes(type) && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Plain table, numbers unformatted, so it sorts and sums in Excel / Sheets. */
function toCsv(def, result) {
  const cols = def.columns;
  const header = cols.map((c) => csvCell(c.type === 'money' ? `${c.label} (INR)` : c.type === 'percent' ? `${c.label} (%)` : c.label, 'text'));
  const lines = [header.join(',')];
  for (const row of result.rows) lines.push(cols.map((c) => csvCell(row[c.key], c.type)).join(','));
  if (result.totals) lines.push(cols.map((c) => csvCell(result.totals[c.key], c.type)).join(','));
  return `﻿${lines.join('\r\n')}\r\n`; // BOM so Excel opens UTF-8 (₹, names) correctly
}

// ---------------------------------------------------------------- PDF

/**
 * Column widths from the content: every column gets its widest header/value
 * (numbers and dates must never be clipped); if that overflows the page, the
 * free-text columns (names, reasons…) shrink and truncate with an ellipsis.
 */
function columnWidths(doc, cols, rows, totals, width, pad) {
  const sample = rows.slice(0, 300);
  const natural = cols.map((c) => {
    doc.font('bold').fontSize(7.5);
    let w = doc.widthOfString(c.label);
    doc.font('regular').fontSize(7.8);
    for (const r of sample) w = Math.max(w, doc.widthOfString(display(r[c.key], c.type)));
    if (totals) w = Math.max(w, doc.font('bold').fontSize(7.8).widthOfString(display(totals[c.key], c.type))); // totals row is bold
    return Math.ceil(w) + pad * 2 + 2;
  });
  const total = natural.reduce((a, b) => a + b, 0);
  if (total <= width) {
    const extra = (width - total) / cols.length;
    return natural.map((w) => w + extra);
  }
  // Cap the widest free-text columns at a common width ("water-filling") until the table fits.
  const shrinkable = natural.map((w, i) => (cols[i].type === 'text' ? w : null));
  const widthsAt = (cap) => natural.map((w, i) => (shrinkable[i] === null ? w : Math.min(w, cap)));
  const fits = (cap) => widthsAt(cap).reduce((a, b) => a + b, 0) <= width;
  const MIN_TEXT = 48;
  if (!fits(MIN_TEXT)) return natural.map((w) => (w / total) * width); // too many columns: scale everything
  let lo = MIN_TEXT;
  let hi = Math.max(...natural);
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) lo = mid;
    else hi = mid;
  }
  const widths = widthsAt(lo);
  const spare = width - widths.reduce((a, b) => a + b, 0);
  return widths.map((w) => w + spare / widths.length);
}

function fit(doc, text, width) {
  if (doc.widthOfString(text) <= width) return text;
  let t = text;
  while (t.length > 1 && doc.widthOfString(`${t}…`) > width) t = t.slice(0, -1);
  return `${t}…`;
}

/**
 * Branded A4 report. Landscape when there are many columns. Header on every
 * page, table header repeated after each page break, page x of y in the footer.
 */
function toPdf(def, result, meta) {
  const cols = def.columns;
  const landscape = cols.length > 6;
  const doc = new PDFDocument({ size: 'A4', layout: landscape ? 'landscape' : 'portrait', margin: 36, bufferPages: true, info: { Title: `${def.name} — ${meta.brand}`, Author: meta.brand } });
  doc.registerFont('regular', FONT_REGULAR);
  doc.registerFont('bold', FONT_BOLD);

  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const bottom = () => doc.page.height - doc.page.margins.bottom - 22;

  // ---- title block (first page)
  doc.rect(0, 0, doc.page.width, 6).fill(COLORS.brand);
  doc.font('bold').fontSize(9).fillColor(COLORS.brand).text(meta.brand.toUpperCase(), left, 22, { characterSpacing: 1.2 });
  doc.font('bold').fontSize(18).fillColor(COLORS.ink).text(def.name, left, 36);
  if (result.subject) doc.font('bold').fontSize(11).fillColor(COLORS.ink).text(result.subject, left, doc.y + 2);
  doc.font('regular').fontSize(8.5).fillColor(COLORS.muted).text(meta.filterLine, left, doc.y + 4, { width });
  doc.text(`Generated ${meta.generatedAt}`, left, doc.y + 1);
  let y = doc.y + 12;

  // ---- summary tiles
  if (result.summary?.length) {
    const n = Math.min(result.summary.length, 5);
    const gap = 8;
    const tileW = (width - gap * (n - 1)) / n;
    result.summary.slice(0, n).forEach((s, i) => {
      const x = left + i * (tileW + gap);
      doc.roundedRect(x, y, tileW, 44, 6).fillAndStroke('#f5f5ff', '#e0e7ff');
      doc.font('regular').fontSize(7.5).fillColor(COLORS.muted).text(s.label.toUpperCase(), x + 8, y + 8, { width: tileW - 16, characterSpacing: 0.4 });
      doc.font('bold').fontSize(12).fillColor(COLORS.ink).text(fit(doc.font('bold').fontSize(12), display(s.value, s.type), tileW - 16), x + 8, y + 22, { width: tileW - 16 });
    });
    y += 58;
  }
  if (result.note) {
    doc.font('regular').fontSize(8.5).fillColor('#92400e').text(result.note, left, y, { width });
    y = doc.y + 8;
  }

  // ---- table
  const pad = 5;
  const widths = columnWidths(doc, cols, result.rows, result.totals, width, pad);
  let cursor = left;
  const xs = widths.map((w) => {
    const x = cursor;
    cursor += w;
    return x;
  });
  const isNum = (c) => ['money', 'int', 'decimal', 'percent'].includes(c.type);
  const rowH = 17;

  const drawHeader = () => {
    doc.rect(left, y, width, rowH + 2).fill(COLORS.head);
    doc.font('bold').fontSize(7.5).fillColor('#ffffff');
    cols.forEach((c, i) => {
      doc.text(fit(doc, c.label, widths[i] - pad * 2), xs[i] + pad, y + 5.5, { width: widths[i] - pad * 2, align: isNum(c) ? 'right' : 'left', lineBreak: false });
    });
    y += rowH + 2;
  };

  const drawRow = (row, i, isTotal = false) => {
    if (y + rowH > bottom()) {
      doc.addPage();
      y = doc.page.margins.top;
      drawHeader();
    }
    if (isTotal) doc.rect(left, y, width, rowH).fill(COLORS.total);
    else if (i % 2) doc.rect(left, y, width, rowH).fill(COLORS.zebra);
    doc.font(isTotal ? 'bold' : 'regular').fontSize(7.8).fillColor(COLORS.ink);
    cols.forEach((c, j) => {
      const text = fit(doc, display(row[c.key], c.type), widths[j] - pad * 2);
      doc.text(text, xs[j] + pad, y + 5, { width: widths[j] - pad * 2, align: isNum(c) ? 'right' : 'left', lineBreak: false });
    });
    y += rowH;
    doc.moveTo(left, y).lineTo(left + width, y).lineWidth(0.4).strokeColor(COLORS.line).stroke();
  };

  if (y + rowH * 3 > bottom()) {
    doc.addPage();
    y = doc.page.margins.top;
  }
  drawHeader();
  if (!result.rows.length) {
    doc.font('regular').fontSize(9).fillColor(COLORS.muted).text('No data for the selected filters.', left, y + 12, { width, align: 'center' });
  }
  result.rows.forEach((row, i) => drawRow(row, i));
  if (result.totals && result.rows.length) drawRow(result.totals, 0, true);

  // ---- footer on every page
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const fy = doc.page.height - doc.page.margins.bottom - 8;
    // Text inside the bottom margin would make pdfkit start a new page; lift the margin while drawing the footer.
    const savedBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.font('regular').fontSize(7.5).fillColor(COLORS.muted);
    doc.text(`${meta.brand} · ${def.name} · ${meta.periodLine}`, left, fy, { width: width * 0.7, lineBreak: false });
    doc.text(`Page ${i - range.start + 1} of ${range.count}`, left, fy, { width, align: 'right', lineBreak: false });
    doc.page.margins.bottom = savedBottom;
  }
  doc.end();
  return doc;
}

module.exports = { toCsv, toPdf, display, formatDate };
