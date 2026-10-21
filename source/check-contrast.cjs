'use strict';
/* Child-Safer Spaces · colour contrast check · version 4.0
 *
 * Reads the colour tokens from style.css for each theme (light, dark, and
 * "more contrast" in both) and computes WCAG 2.x contrast ratios for the
 * pairs the workspace actually uses. Text pairs need 4.5:1; focus rings and
 * control borders need 3:1.
 *
 *   node source/check-contrast.cjs      prints every pair and exits 1 if any fails
 *
 * Semi-transparent "glass" colours are blended over the page colour first.
 * This checks token pairs, not rendered pixels: text over the moving
 * background scene sits on near-opaque surfaces, which this script checks as
 * blended colours. */
const fs = require('fs'), path = require('path');
const css = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');

function block(selector) {
  const i = css.indexOf(selector + ' {');
  if (i < 0) throw Error('style.css has no block for ' + selector);
  const body = css.slice(i + selector.length + 2, css.indexOf('}', i));
  const out = {};
  for (const m of body.matchAll(/--([a-z0-9-]+):\s*([^;]+);/gi)) out[m[1]] = m[2].trim();
  return out;
}
function rgb(v, under) {
  let m = v.match(/^#([0-9a-f]{6})$/i);
  if (m) return [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16));
  m = v.match(/^rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\s*\)$/i);
  if (m) {
    const a = m[4] === undefined ? 1 : Number(m[4]), c = [1, 2, 3].map(i => Number(m[i]));
    return under ? c.map((x, i) => Math.round(x * a + under[i] * (1 - a))) : c;
  }
  return null;
}
const lum = c => { const [r, g, b] = c.map(x => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

const light = block(':root'), dark = { ...light, ...block(':root[data-theme="dark"]') };
const themes = {
  light, dark,
  'light, more contrast': { ...light, ...block(':root[data-contrast="more"]') },
  'dark, more contrast': { ...dark, ...block(':root[data-theme="dark"][data-contrast="more"]') }
};
// [foreground token or #hex, background token or #hex, minimum ratio, where it is used]
const PAIRS = [
  ['ink', 'paper', 4.5, 'body text'], ['ink', 'surface', 4.5, 'cards and documents'], ['ink', 'glass', 4.5, 'top bar, status bar, hero panel'],
  ['muted', 'paper', 4.5, 'secondary text'], ['muted', 'surface', 4.5, 'secondary text on cards'], ['muted', 'glass', 4.5, 'secondary text on glass'],
  ['link', 'paper', 4.5, 'links'], ['link', 'surface', 4.5, 'links on cards'], ['amber', 'glass', 4.5, 'child band labels'], ['amber', 'surface', 4.5, 'band labels on solid'],
  ['now', 'now-bg', 4.5, '"No approval needed" badge'], ['review', 'review-bg', 4.5, '"Needs local review" badge'], ['signed', 'signed-bg', 4.5, '"Needs signed commitment" badge'],
  ['del', 'del-bg', 4.5, 'danger notices'], ['add', 'add-bg', 4.5, 'draft comparison'], ['ink', 'amber-bg', 4.5, 'warning notices'], ['ink', 'notice-bg', 4.5, 'notices'],
  ['ink', 'head-bg', 4.5, 'table headers'], ['side-ink', 'side', 4.5, 'navigation'], ['side-muted', 'side', 4.5, 'navigation stage labels'], ['#183b37', 'lime', 4.5, 'current navigation item'],
  ['focus', 'paper', 3, 'focus ring'], ['focus', 'surface', 3, 'focus ring on cards'], ['focus-dark', 'side', 3, 'focus ring in navigation'], ['border', 'surface', 3, 'control borders'], ['border', 'paper', 3, 'control borders on page']
];
function check() {
  const rows = [];
  for (const [name, t] of Object.entries(themes)) {
    const paper = rgb(t.paper);
    const resolve = v => { let x = v, n = 0; while (x && /^var\(--([a-z0-9-]+)\)$/i.test(x) && n++ < 5) x = t[x.match(/^var\(--([a-z0-9-]+)\)$/i)[1]]; return x; };
    const col = k => { const c = k.startsWith('#') ? rgb(k) : rgb(resolve(t[k]), paper); if (!c) throw Error(name + ': cannot read colour ' + k + ' = ' + t[k]); return c; };
    for (const [fg, bg, min, use] of PAIRS) {
      const r = ratio(col(fg), col(bg));
      rows.push({ theme: name, fg, bg, use, min, ratio: Math.round(r * 100) / 100, ok: r >= min });
    }
    // Primary buttons: light theme uses surface text on green; dark theme uses near-black text on light green.
    const btnText = name.startsWith('dark') ? rgb('#0f1f1c') : col('surface');
    const r = ratio(btnText, col('green'));
    rows.push({ theme: name, fg: name.startsWith('dark') ? '#0f1f1c' : 'surface', bg: 'green', use: 'primary button', min: 4.5, ratio: Math.round(r * 100) / 100, ok: r >= 4.5 });
  }
  return rows;
}
module.exports = { check };
if (require.main === module) {
  const rows = check();
  for (const r of rows) console.log((r.ok ? 'ok   ' : 'FAIL ') + r.theme.padEnd(22) + (r.fg + ' on ' + r.bg).padEnd(26) + String(r.ratio).padStart(6) + ' (min ' + r.min + ')  ' + r.use);
  const bad = rows.filter(r => !r.ok).length;
  console.log(bad ? bad + ' pair(s) below the minimum.' : 'All ' + rows.length + ' pairs meet the minimum.');
  process.exit(bad ? 1 : 0);
}
