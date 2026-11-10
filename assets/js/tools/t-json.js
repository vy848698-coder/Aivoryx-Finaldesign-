/* 04 · JSON Beautifier & Toolkit — fully real, fully local. */
import { h, $$, bytes, esc, copy, download, seg, toast, state } from './lib.js';

const MAX = 5 * 1024 * 1024;
const HL_LIMIT = 300 * 1024; // above this, show plain text so typing stays instant

const SAMPLES = {
  api: { label: 'API response', text: '{"status":"ok","page":1,"total":3,"users":[{"id":101,"name":"Asha Rao","email":"asha@example.com","roles":["admin","editor"],"active":true,"lastLogin":"2026-11-09T08:14:00Z"},{"id":102,"name":"Dev Mehta","email":"dev@example.com","roles":["viewer"],"active":false,"lastLogin":null},{"id":103,"name":"Lin Tan","email":"lin@example.com","roles":["editor"],"active":true,"lastLogin":"2026-11-10T19:02:44Z"}],"meta":{"region":"ap-south-1","cached":false,"took_ms":38}}' },
  config: { label: 'App config', text: '{"name":"aivoryx-site","version":"2.4.0","build":{"minify":true,"target":["es2020","safari15"],"sourcemap":false},"features":{"darkMode":true,"betaTools":["json","pdf"],"maxUploadMb":50},"env":{"API_URL":"https://api.example.com","TIMEOUT":15000}}' },
  broken: { label: 'Broken JSON', text: '{\n  "order": 5521,\n  "items": [\n    {"sku": "AX-1", "qty": 2},\n    {"sku": "AX-2", "qty": 1},\n  ],\n  "paid": true\n}' }
};
const DIFF_B = '{"status":"ok","page":1,"total":4,"users":[{"id":101,"name":"Asha Rao","email":"asha@aivoryx.dev","roles":["admin","editor"],"active":true,"lastLogin":"2026-11-11T07:40:00Z"},{"id":102,"name":"Dev Mehta","email":"dev@example.com","roles":["viewer","editor"],"active":true,"lastLogin":null},{"id":103,"name":"Lin Tan","email":"lin@example.com","roles":["editor"],"active":true,"lastLogin":"2026-11-10T19:02:44Z"},{"id":104,"name":"Sam Ito","email":"sam@example.com","roles":["viewer"],"active":true,"lastLogin":null}],"meta":{"region":"ap-south-1","took_ms":41}}';

/* ---------- syntax highlighting (works on invalid text too) ---------- */
const TOK = /("(?:\\.|[^"\\\n])*"?)(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false)\b|\b(null)\b|([{}[\],])/g;
function highlight(src) {
  let out = '', last = 0, m;
  TOK.lastIndex = 0;
  while ((m = TOK.exec(src))) {
    out += esc(src.slice(last, m.index));
    if (m[1]) out += m[2] ? `<span class="j-k">${esc(m[1])}</span>${esc(m[2])}` : `<span class="j-s">${esc(m[1])}</span>`;
    else if (m[3]) out += `<span class="j-n">${m[3]}</span>`;
    else if (m[4]) out += `<span class="j-b">${m[4]}</span>`;
    else if (m[5]) out += `<span class="j-z">${m[5]}</span>`;
    else out += `<span class="j-p">${m[6]}</span>`;
    last = TOK.lastIndex;
  }
  return out + esc(src.slice(last));
}
function linesHTML(src, errLine) {
  const big = src.length > HL_LIMIT;
  const html = big ? esc(src) : highlight(src);
  // split highlighted HTML on newlines; spans never cross a newline because strings stop at \n
  return html.split('\n').map((l, i) => `<span class="ln${i + 1 === errLine ? ' err' : ''}">${l || ' '}</span>`).join('');
}

/* ---------- a validator that says where it broke ---------- */
function locate(src) {
  let i = 0;
  const fail = (msg) => { const e = new Error(msg); e.pos = i; throw e; };
  const ws = () => { while (i < src.length && ' \t\n\r'.includes(src[i])) i++; };
  const ch = () => src[i] === undefined ? 'end of input' : JSON.stringify(src[i]);
  function value() {
    ws();
    const c = src[i];
    if (c === '{') return obj();
    if (c === '[') return arr();
    if (c === '"') return str();
    if (c === '-' || (c >= '0' && c <= '9')) return num();
    for (const w of ['true', 'false', 'null']) if (src.startsWith(w, i)) { i += w.length; return; }
    if (c === "'") fail('Strings need double quotes, not single quotes');
    fail(c === undefined ? 'Unexpected end of input — a value is missing' : `Unexpected ${ch()} — expected a value`);
  }
  function obj() {
    i++; ws();
    if (src[i] === '}') { i++; return; }
    for (;;) {
      ws();
      if (src[i] === '}') fail('Trailing comma before } is not allowed in JSON');
      if (src[i] !== '"') fail(`Expected a "quoted" key but found ${ch()}`);
      str(); ws();
      if (src[i] !== ':') fail(`Expected : after the key but found ${ch()}`);
      i++; value(); ws();
      if (src[i] === ',') { i++; continue; }
      if (src[i] === '}') { i++; return; }
      fail(`Expected , or } but found ${ch()}`);
    }
  }
  function arr() {
    i++; ws();
    if (src[i] === ']') { i++; return; }
    for (;;) {
      ws();
      if (src[i] === ']') fail('Trailing comma before ] is not allowed in JSON');
      value(); ws();
      if (src[i] === ',') { i++; continue; }
      if (src[i] === ']') { i++; return; }
      fail(`Expected , or ] but found ${ch()}`);
    }
  }
  function str() {
    i++;
    while (i < src.length) {
      const c = src[i];
      if (c === '"') { i++; return; }
      if (c === '\n') fail('Line break inside a string — close the quote or use \\n');
      if (c < ' ') fail('Control character inside a string must be escaped');
      if (c === '\\') {
        const n = src[i + 1];
        if (n === 'u') { if (!/^[0-9a-fA-F]{4}$/.test(src.substr(i + 2, 4))) fail('Bad \\u escape — needs four hex digits'); i += 6; continue; }
        if (!'"\\/bfnrt'.includes(n)) { i++; fail(`Invalid escape \\${n || ''}`); }
        i += 2; continue;
      }
      i++;
    }
    fail('Unterminated string — a closing " is missing');
  }
  function num() {
    const m = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/.exec(src.slice(i));
    if (!m) fail('Invalid number');
    i += m[0].length;
  }
  value(); ws();
  if (i < src.length) fail(`Unexpected ${ch()} after the end of the JSON`);
  return null;
}
export function parse(src) {
  try { return { ok: true, value: JSON.parse(src) }; }
  catch (native) {
    let err;
    try { locate(src); err = { message: native.message, pos: 0 }; }
    catch (e) { err = { message: e.message, pos: e.pos }; }
    const before = src.slice(0, err.pos).split('\n');
    err.line = before.length;
    err.col = before[before.length - 1].length + 1;
    return { ok: false, error: err };
  }
}

/* ---------- facts about a value ---------- */
function stats(v) {
  let keys = 0, depth = 0, nodes = 0;
  (function walk(x, d) {
    nodes++; depth = Math.max(depth, d);
    if (Array.isArray(x)) x.forEach(y => walk(y, d + 1));
    else if (x && typeof x === 'object') for (const k in x) { keys++; walk(x[k], d + 1); }
  })(v, 0);
  return { keys, depth, nodes };
}
const typeOf = v => v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v;

/* ---------- conversion ---------- */
function flatten(o, pre = '', out = {}) {
  if (o && typeof o === 'object' && !Array.isArray(o)) {
    const ks = Object.keys(o);
    if (!ks.length && pre) out[pre] = '';
    ks.forEach(k => flatten(o[k], pre ? pre + '.' + k : k, out));
  } else if (Array.isArray(o)) {
    if (o.every(x => x === null || typeof x !== 'object')) out[pre || 'value'] = o.join('; ');
    else o.forEach((x, i) => flatten(x, pre + '[' + i + ']', out));
  } else out[pre || 'value'] = o;
  return out;
}
function toCSV(v) {
  // an API envelope like {status, users:[…]} → the rows are the one array of objects inside it
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const arrs = Object.values(v).filter(x => Array.isArray(x) && x.length && x.every(y => y && typeof y === 'object' && !Array.isArray(y)));
    if (arrs.length === 1) v = arrs[0];
  }
  const rows = (Array.isArray(v) ? v : [v]).map(r => (r && typeof r === 'object') ? flatten(r) : { value: r });
  const cols = [];
  rows.forEach(r => Object.keys(r).forEach(k => { if (!cols.includes(k)) cols.push(k); }));
  const cell = x => {
    if (x === undefined || x === null) return '';
    const s = String(x);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return [cols.map(cell).join(','), ...rows.map(r => cols.map(c => cell(r[c])).join(','))].join('\n');
}
function toXML(v, indent) {
  const pad = typeof indent === 'number' ? ' '.repeat(indent) : '\t';
  const name = k => { let n = String(k).replace(/[^A-Za-z0-9_.-]/g, '_'); if (!/^[A-Za-z_]/.test(n)) n = '_' + n; return /^xml/i.test(n) ? '_' + n : n; };
  const xesc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  function node(k, x, d) {
    const p = pad.repeat(d), t = name(k);
    if (Array.isArray(x)) return x.map(y => node(k, y, d)).join('\n') || `${p}<${t}/>`;
    if (x && typeof x === 'object') {
      const inner = Object.keys(x).map(c => node(c, x[c], d + 1)).join('\n');
      return inner ? `${p}<${t}>\n${inner}\n${p}</${t}>` : `${p}<${t}/>`;
    }
    if (x === null) return `${p}<${t}/>`;
    return `${p}<${t}>${xesc(x)}</${t}>`;
  }
  const body = Array.isArray(v) ? v.map(x => node('item', x, 1)).join('\n')
    : v && typeof v === 'object' ? Object.keys(v).map(k => node(k, v[k], 1)).join('\n') : node('value', v, 1);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<root>\n${body}\n</root>`;
}

/* ---------- diff ---------- */
function diff(a, b, path = '$', out = []) {
  const ta = typeOf(a), tb = typeOf(b);
  if (ta !== tb || (ta !== 'object' && ta !== 'array')) {
    if (ta !== tb || a !== b) out.push({ t: 'changed', path, a, b });
    return out;
  }
  if (ta === 'array') {
    const n = Math.max(a.length, b.length);
    for (let i = 0; i < n; i++) {
      const p = `${path}[${i}]`;
      if (i >= a.length) out.push({ t: 'added', path: p, b: b[i] });
      else if (i >= b.length) out.push({ t: 'removed', path: p, a: a[i] });
      else diff(a[i], b[i], p, out);
    }
    return out;
  }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  keys.forEach(k => {
    const p = /^[A-Za-z_$][\w$]*$/.test(k) ? `${path}.${k}` : `${path}[${JSON.stringify(k)}]`;
    if (!(k in a)) out.push({ t: 'added', path: p, b: b[k] });
    else if (!(k in b)) out.push({ t: 'removed', path: p, a: a[k] });
    else diff(a[k], b[k], p, out);
  });
  return out;
}
const short = v => { const s = JSON.stringify(v); return s === undefined ? 'undefined' : s.length > 60 ? s.slice(0, 57) + '…' : s; };

/* ---------- an editor: highlighted pre under a transparent textarea ---------- */
function editor({ label, value = '', readOnly = false, onInput }) {
  const ta = h('textarea.jx-ta', { spellcheck: false, autocapitalize: 'off', autocomplete: 'off', 'aria-label': label, readOnly });
  const pre = h('pre.jx-hl', { 'aria-hidden': 'true' });
  const wrap = h('div.jx-ed', pre, ta);
  let errLine = 0;
  const paint = () => { pre.innerHTML = linesHTML(ta.value, errLine) + '<span class="ln-end"> </span>'; };
  ta.addEventListener('input', () => { paint(); onInput && onInput(ta.value); });
  ta.addEventListener('scroll', () => { pre.scrollTop = ta.scrollTop; pre.scrollLeft = ta.scrollLeft; });
  ta.addEventListener('keydown', e => {
    if (e.key === 'Tab' && !e.shiftKey && !readOnly && !e.ctrlKey && !e.metaKey) {
      // Tab indents; Esc then Tab leaves the field (keyboard users are never trapped)
      if (wrap.dataset.escaped) { delete wrap.dataset.escaped; return; }
      e.preventDefault();
      document.execCommand('insertText', false, '  ') || ta.setRangeText('  ', ta.selectionStart, ta.selectionEnd, 'end');
      paint(); onInput && onInput(ta.value);
    }
    if (e.key === 'Escape') wrap.dataset.escaped = '1';
  });
  ta.value = value; paint();
  return {
    el: wrap, ta,
    get value() { return ta.value; },
    set value(v) { ta.value = v; paint(); },
    setError(l) { errLine = l || 0; paint(); },
    wrap(on) { wrap.classList.toggle('wrap', on); }
  };
}
function viewer(text, label) {
  const pre = h('pre.jx-hl.jx-view', { tabindex: 0, 'aria-label': label });
  pre.innerHTML = linesHTML(text);
  return pre;
}

/* ---------- tree ---------- */
function tree(v) {
  const root = h('ul.jt', { role: 'tree', 'aria-label': 'JSON tree' });
  function node(k, x, depth) {
    const t = typeOf(x);
    const li = h('li', { role: 'treeitem' });
    const key = k === null ? null : h('span.jt-k', typeof k === 'number' ? String(k) : k);
    if (t === 'object' || t === 'array') {
      const entries = t === 'array' ? x.map((y, i) => [i, y]) : Object.entries(x);
      const open = depth < 2;
      li.setAttribute('aria-expanded', String(open));
      const btn = h('button.jt-t', { type: 'button', 'aria-label': (open ? 'Collapse ' : 'Expand ') + (k ?? 'root') },
        h('i', { 'aria-hidden': 'true' }), key, h('span.jt-meta', t === 'array' ? `[${entries.length}]` : `{${entries.length}}`));
      const kids = h('ul', { role: 'group' });
      let built = false;
      const build = () => { if (!built) { built = true; entries.forEach(([ck, cv]) => kids.append(node(ck, cv, depth + 1))); } };
      if (open) build();
      btn.addEventListener('click', () => {
        const o = li.getAttribute('aria-expanded') !== 'true';
        if (o) build();
        li.setAttribute('aria-expanded', String(o));
        btn.setAttribute('aria-label', (o ? 'Collapse ' : 'Expand ') + (k ?? 'root'));
      });
      li.append(btn, kids);
      li._build = build;
    } else {
      li.append(h('span.jt-leaf', key, h('span.jt-v.v-' + t, t === 'string' ? JSON.stringify(x) : String(x))));
    }
    return li;
  }
  root.append(node(null, v, 0));
  return root;
}
function setAll(treeEl, open) {
  const walk = () => {
    let grew = false;
    $$('li[aria-expanded]', treeEl).forEach(li => {
      if (open && li._build) li._build();
      if (li.getAttribute('aria-expanded') !== String(open)) { li.setAttribute('aria-expanded', String(open)); grew = true; }
    });
    return grew;
  };
  for (let i = 0; i < 12 && walk(); i++) { /* expand level by level, capped */ }
}

/* ================================================================ */
export function mount({ stage, out, setStatus }) {
  let mode = 'beautify', indent = 2, convertTo = 'csv', wrapOn = false, timer = 0;

  const A = editor({ label: 'JSON input', value: SAMPLES.api.text, onInput: () => schedule() });
  const B = editor({ label: 'JSON to compare against', value: DIFF_B, onInput: () => schedule() });

  const modes = seg('Mode', [['beautify', 'Beautify'], ['minify', 'Minify'], ['validate', 'Validate'], ['tree', 'Tree'], ['diff', 'Diff'], ['convert', 'Convert']], mode, v => { mode = v; layout(); run(); });
  const indentSel = seg('Indentation', [['2', '2 sp'], ['4', '4 sp'], ['tab', 'Tab']], '2', v => { indent = v === 'tab' ? '\t' : +v; run(); }, { small: true });
  const convSel = seg('Convert to', [['csv', 'CSV'], ['xml', 'XML']], 'csv', v => { convertTo = v; run(); }, { small: true });
  const wrapBtn = h('button.tw-chip', { type: 'button', 'aria-pressed': 'false', onclick: () => { wrapOn = !wrapOn; wrapBtn.setAttribute('aria-pressed', String(wrapOn)); A.wrap(wrapOn); B.wrap(wrapOn); $$('.jx-view', out).forEach(p => p.classList.toggle('wrap', wrapOn)); } }, 'Wrap');
  const sample = h('select.tw-select', { 'aria-label': 'Load a sample', onchange: () => { if (sample.value) { A.value = SAMPLES[sample.value].text; if (sample.value === 'broken' && mode !== 'validate') { mode = 'validate'; modes.value = 'validate'; layout(); } run(); sample.value = ''; } } },
    h('option', { value: '' }, 'Load a sample…'), ...Object.entries(SAMPLES).map(([k, s]) => h('option', { value: k }, s.label)));
  const file = h('input', { type: 'file', accept: '.json,application/json,.txt,text/plain', class: 'vh', tabindex: -1 });
  file.addEventListener('change', async () => {
    const f = file.files[0]; file.value = '';
    if (!f) return;
    if (f.size > MAX) { toast('That file is ' + bytes(f.size) + ' — the preview takes up to 5 MB', 'err'); return; }
    A.value = await f.text(); run(); toast('Loaded ' + f.name);
  });
  const uploadBtn = h('button.tw-chip', { type: 'button', onclick: () => file.click() }, 'Upload');
  const clearBtn = h('button.tw-chip', { type: 'button', onclick: () => { A.value = ''; A.ta.focus(); run(); } }, 'Clear');

  const optsRow = h('div.jx-opts');
  const edArea = h('div.jx-area');
  stage.append(
    h('div.jx-bar', modes),
    h('div.jx-tools', sample, optsRow, h('span.jx-sp'), wrapBtn, uploadBtn, clearBtn, file),
    edArea,
    h('p.jx-tip', 'Tip: Tab indents inside the editor · press Esc, then Tab, to move on.')
  );

  function layout() {
    optsRow.replaceChildren();
    if (mode === 'beautify' || mode === 'convert') optsRow.append(h('span.tw-k', 'Indent'), indentSel);
    if (mode === 'convert') optsRow.append(h('span.tw-k', 'To'), convSel);
    edArea.classList.toggle('two', mode === 'diff');
    edArea.replaceChildren(
      h('div.jx-pane', h('div.jx-cap', h('span', mode === 'diff' ? 'A · original' : 'Input'), h('span.jx-meta', { id: 'jx-meta-a' })), A.el),
      ...(mode === 'diff' ? [h('div.jx-pane', h('div.jx-cap', h('span', 'B · changed'), h('span.jx-meta', { id: 'jx-meta-b' })), B.el)] : [])
    );
  }

  function schedule() { clearTimeout(timer); setStatus('working', 'Parsing'); timer = setTimeout(run, 220); }

  function outHead(title, text, ext, mime) {
    const actions = text != null ? [
      h('button.tw-chip', { type: 'button', onclick: () => copy(text, 'Output copied') }, 'Copy'),
      h('button.tw-chip', { type: 'button', onclick: () => download(text, 'aivoryx-output.' + ext, mime) }, 'Download')
    ] : [];
    return h('div.tw-ohead', h('h4.tw-k', title), h('div.tw-oact', ...actions));
  }
  function statRow(items) {
    return h('dl.tw-stats', ...items.map(([k, v]) => h('div', h('dt', k), h('dd', v))));
  }
  function errorBlock(src, err, which = '') {
    const lines = src.split('\n');
    const from = Math.max(0, err.line - 2), to = Math.min(lines.length, err.line + 1);
    const snippet = h('pre.jx-snip');
    for (let i = from; i < to; i++) {
      snippet.append(h('span' + (i + 1 === err.line ? '.hit' : ''), h('i', String(i + 1)), lines[i] || ' '), '\n');
      if (i + 1 === err.line) snippet.append(h('span.caret', h('i', ' '), ' '.repeat(Math.max(0, err.col - 1)) + '^'), '\n');
    }
    return h('div.jx-err', { role: 'alert' },
      h('b', `${which}Invalid JSON · line ${err.line}, column ${err.col}`),
      h('p', err.message), snippet);
  }

  /* Hostile input guard: a valid but absurdly deep document (e.g. 100,000
     nested arrays) can overflow the call stack in stats / tree / stringify.
     Show a clear error instead of leaving the tool stuck. */
  function run() {
    try { runInner(); }
    catch (e) {
      const deep = e instanceof RangeError;
      out.replaceChildren(state('err', deep ? 'Nested too deeply to process' : 'Something went wrong',
        deep ? 'This JSON is nested deeper than a browser can safely walk. Nothing was sent anywhere.' : String(e.message || e)));
      setStatus('error', deep ? 'Too deep' : 'Error');
    }
  }

  function runInner() {
    clearTimeout(timer);
    const t0 = performance.now();
    const src = A.value;
    const metaA = document.getElementById('jx-meta-a');
    if (metaA) metaA.textContent = `${bytes(new Blob([src]).size)} · ${src ? src.split('\n').length : 0} lines`;

    if (!src.trim()) {
      A.setError(0);
      out.replaceChildren(state('empty', 'Paste JSON or load a sample', 'Results appear here as you type. Everything runs in this tab.'));
      setStatus('ready', 'Waiting for input');
      return;
    }
    const r = parse(src);
    A.setError(r.ok ? 0 : r.error.line);

    if (mode === 'diff') {
      const srcB = B.value;
      const metaB = document.getElementById('jx-meta-b');
      if (metaB) metaB.textContent = `${bytes(new Blob([srcB]).size)} · ${srcB ? srcB.split('\n').length : 0} lines`;
      const rb = parse(srcB);
      B.setError(rb.ok ? 0 : rb.error.line);
      if (!r.ok || !rb.ok) {
        out.replaceChildren(outHead('Diff'), ...(r.ok ? [] : [errorBlock(src, r.error, 'A · ')]), ...(rb.ok ? [] : [errorBlock(srcB, rb.error, 'B · ')]));
        setStatus('error', 'Fix the JSON to compare'); return;
      }
      const d = diff(r.value, rb.value);
      const c = { added: 0, removed: 0, changed: 0 };
      d.forEach(x => c[x.t]++);
      const report = d.map(x => `${x.t.toUpperCase()} ${x.path}${x.t === 'changed' ? `: ${short(x.a)} → ${short(x.b)}` : `: ${short(x.t === 'added' ? x.b : x.a)}`}`).join('\n');
      out.replaceChildren(
        outHead('Diff · A → B', d.length ? report : null, 'txt', 'text/plain'),
        h('div.jx-dsum', h('span.add', `+${c.added} added`), h('span.rem', `−${c.removed} removed`), h('span.chg', `~${c.changed} changed`)),
        d.length ? h('ol.jx-diff', ...d.slice(0, 400).map(x => h('li.' + x.t,
          h('code.p', x.path),
          x.t === 'changed' ? h('span.v', h('del', short(x.a)), ' → ', h('ins', short(x.b))) : h('span.v', x.t === 'added' ? h('ins', short(x.b)) : h('del', short(x.a)))
        ))) : state('ok', 'Identical', 'Both documents hold exactly the same data.'),
        d.length > 400 ? h('p.tw-hint', `Showing the first 400 of ${d.length} differences.`) : null,
        statRow([['Differences', String(d.length)], ['Compared in', (performance.now() - t0).toFixed(1) + ' ms']])
      );
      setStatus(d.length ? 'done' : 'ok', d.length ? d.length + ' differences' : 'No differences');
      return;
    }

    if (!r.ok) {
      out.replaceChildren(outHead(mode === 'validate' ? 'Validate' : 'Output'), errorBlock(src, r.error),
        h('p.tw-hint', 'The red line in the editor marks the problem. Fix it and the output comes back.'));
      setStatus('error', `Error · line ${r.error.line}`);
      return;
    }

    const s = stats(r.value);
    const base = [['Type', typeOf(r.value)], ['Keys', s.keys.toLocaleString()], ['Depth', String(s.depth)]];
    const ms = () => (performance.now() - t0).toFixed(1) + ' ms';
    let text, ext = 'json', mime = 'application/json', title;

    if (mode === 'tree') {
      const tr = tree(r.value);
      out.replaceChildren(
        h('div.tw-ohead', h('h4.tw-k', 'Tree'), h('div.tw-oact',
          h('button.tw-chip', { type: 'button', onclick: () => setAll(tr, true) }, 'Expand all'),
          h('button.tw-chip', { type: 'button', onclick: () => setAll(tr, false) }, 'Collapse all'))),
        h('div.jt-wrap', tr), statRow([...base, ['Nodes', s.nodes.toLocaleString()]]));
      setStatus('done', 'Valid · tree ready');
      return;
    }
    if (mode === 'validate') {
      out.replaceChildren(outHead('Validate'),
        state('ok', 'Valid JSON', 'Parsed with no errors. Safe to send.'),
        statRow([...base, ['Size', bytes(new Blob([src]).size)], ['Parsed in', ms()]]));
      setStatus('ok', 'Valid');
      return;
    }
    if (mode === 'beautify') { text = JSON.stringify(r.value, null, indent); title = 'Beautified'; }
    if (mode === 'minify') { text = JSON.stringify(r.value); title = 'Minified'; }
    if (mode === 'convert') {
      title = 'Converted · ' + convertTo.toUpperCase();
      try {
        text = convertTo === 'csv' ? toCSV(r.value) : toXML(r.value, indent);
      } catch (e) { out.replaceChildren(outHead(title), state('err', 'Could not convert', e.message)); setStatus('error', 'Convert failed'); return; }
      ext = convertTo; mime = convertTo === 'csv' ? 'text/csv' : 'application/xml';
    }
    const inSize = new Blob([src]).size, outSize = new Blob([text]).size;
    const delta = inSize ? Math.round((outSize - inSize) / inSize * 100) : 0;
    const view = convertTo === 'xml' && mode === 'convert' ? h('pre.jx-hl.jx-view.plain', { tabindex: 0, 'aria-label': 'Output' }, text) : viewer(text, 'Output');
    if (mode === 'convert' && convertTo === 'csv') view.classList.add('plain'), view.textContent = text;
    if (wrapOn) view.classList.add('wrap');
    out.replaceChildren(outHead(title, text, ext, mime), view,
      statRow([['Input', bytes(inSize)], ['Output', bytes(outSize)], ['Change', (delta > 0 ? '+' : '') + delta + '%'], ['Lines', text.split('\n').length.toLocaleString()], ...base.slice(1), ['Took', ms()]]));
    setStatus('done', mode === 'minify' ? 'Minified' : mode === 'convert' ? 'Converted' : 'Formatted');
  }

  layout();
  run();
  return () => clearTimeout(timer);
}

export { highlight, linesHTML };
