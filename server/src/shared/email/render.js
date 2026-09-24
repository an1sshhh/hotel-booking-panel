const juice = require('juice');

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);

const truthy = (v) => v !== undefined && v !== null && v !== '' && v !== false && v !== 0 && v !== '0' && v !== 'false';

// Innermost {{#if}} first, so nested conditionals resolve from the inside out.
const IF_BLOCK = /\{\{#if\s+([\w.]+)\s*\}\}((?:(?!\{\{#if\s)[\s\S])*?)\{\{\/if\}\}/;

/**
 * Tiny, logic-light template language:
 *   {{name}}       value, HTML-escaped (or plain when escape=false, for subjects)
 *   {{{name}}}     raw value — only for trusted HTML such as the layout's content slot
 *   {{#if name}}…{{else}}…{{/if}}
 * Missing variables render as empty text. Values are inserted in one pass
 * after conditionals, so text typed by guests can never inject template syntax.
 */
function renderString(template, data, { escape = true } = {}) {
  let out = String(template ?? '');
  for (let guard = 0; guard < 200; guard++) {
    const m = IF_BLOCK.exec(out);
    if (!m) break;
    const [yes, no = ''] = m[2].split('{{else}}');
    out = out.slice(0, m.index) + (truthy(data[m[1]]) ? yes : no) + out.slice(m.index + m[0].length);
  }
  // Single pass over both forms so substituted values are never re-scanned.
  return out.replace(/\{\{\{\s*([\w.]+)\s*\}\}\}|\{\{\s*([\w.]+)\s*\}\}/g, (_, raw, name) =>
    raw ? String(data[raw] ?? '') : escape ? escapeHtml(data[name]) : String(data[name] ?? '')
  );
}

/** Plain-text alternative for mail clients that don't render HTML. */
function htmlToText(html) {
  return String(html)
    .replace(/<(style|head|title)[\s\S]*?<\/\1>/gi, '')
    .replace(/<div[^>]*display:\s*none[\s\S]*?<\/div>/gi, '')
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, label) => `${label.replace(/<[^>]+>/g, '').trim()} (${href})`)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|tr|li|table)>/gi, '\n')
    .replace(/<\/td>/gi, '  ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .split('\n').map((l) => l.trim()).join('\n')
    .trim();
}

const CONTENT_TOKEN = '\u0000EMAIL_CONTENT\u0000';

/**
 * Renders an email template inside its layout and inlines the layout's CSS
 * (most mail clients ignore <style>; media queries are kept for mobile).
 */
function renderEmail({ template, layout, data }) {
  const subject = renderString(template.subject, data, { escape: false }).replace(/\s+/g, ' ').trim();
  const vars = { ...data, subject };
  const content = renderString(template.html, vars);
  // The layout is rendered with a placeholder and the body spliced in afterwards,
  // so values inside the body are never re-processed by the layout pass.
  const shell = renderString(layout.html, { ...vars, content: CONTENT_TOKEN });
  const full = shell.includes(CONTENT_TOKEN) ? shell.replace(CONTENT_TOKEN, () => content) : shell + content;
  const html = juice(full, { preserveMediaQueries: true, removeStyleTags: true, applyWidthAttributes: true, applyHeightAttributes: false });
  return { subject, html, text: htmlToText(content) };
}

module.exports = { renderString, renderEmail };
