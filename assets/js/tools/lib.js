/* AIVORYX · tools — small shared helpers for every tool preview.
   Nothing in here talks to a server. */

/** h('div.cls#id', {attrs}, ...children) — tiny element builder. */
export function h(tag, attrs, ...kids) {
  const m = tag.match(/^([a-z0-9-]+)?((?:[.#][\w-]+)*)$/i);
  const el = document.createElement(m[1] || 'div');
  (m[2].match(/[.#][\w-]+/g) || []).forEach(t => t[0] === '.' ? el.classList.add(t.slice(1)) : (el.id = t.slice(1)));
  // anything that isn't a plain attributes object (text, 0, a node, an array) is a child
  if (attrs !== undefined && (attrs === null || typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) { kids.unshift(attrs); attrs = null; }
  for (const k in attrs || {}) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, kids);
  return el;
}
function append(el, kids) {
  kids.flat(Infinity).forEach(k => { if (k != null && k !== false) el.append(k instanceof Node ? k : String(k)); });
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function bytes(n) {
  if (!Number.isFinite(n)) return '—';
  if (n < 1024) return n + ' B';
  const u = ['KB', 'MB', 'GB'];
  let i = -1;
  do { n /= 1024; i++; } while (n >= 1024 && i < u.length - 1);
  return (n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2)) + ' ' + u[i];
}

export function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------- toast (one per page, polite) ---------- */
let toastEl, toastT;
export function toast(msg, kind = '') {
  if (!toastEl) {
    toastEl = h('div.tw-toast', { role: 'status', 'aria-live': 'polite' });
    document.body.append(toastEl);
  }
  toastEl.textContent = msg;
  toastEl.className = 'tw-toast show ' + kind;
  clearTimeout(toastT);
  toastT = setTimeout(() => toastEl.classList.remove('show'), 1900);
}

export async function copy(text, label = 'Copied') {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const t = h('textarea', { style: { position: 'fixed', opacity: '0' } });
    t.value = text; document.body.append(t); t.select();
    try { document.execCommand('copy'); } catch { /* nothing else to try */ }
    t.remove();
  }
  toast(label);
}

/** Save a Blob (or string) as a file. The object URL is revoked after use. */
export function download(data, name, type = 'application/octet-stream') {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/* ---------- lazy script loading (each library loads once, on first use) ---------- */
const loaded = new Map();
export function loadScript(src, globalName) {
  if (globalName && window[globalName]) return Promise.resolve(window[globalName]);
  if (!loaded.has(src)) {
    loaded.set(src, new Promise((res, rej) => {
      const s = h('script', { src, async: true, crossorigin: 'anonymous' });
      s.onload = () => res(globalName ? window[globalName] : true);
      s.onerror = () => { loaded.delete(src); rej(new Error('Could not load ' + src.split('/').slice(-1)[0] + ' — check your connection.')); };
      document.head.append(s);
    }));
  }
  return loaded.get(src);
}

/* the exact library builds used by the previews */
export const LIBS = {
  pdflib: 'https://cdn.jsdelivr.net/npm/@cantoo/pdf-lib@2.9.2/dist/pdf-lib.min.js',
  pdfjs: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  pdfjsWorker: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  heic: 'https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js',
  ort: 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/ort.wasm.min.js',
  ortDir: 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/'
};

export async function pdfjs() {
  const lib = await loadScript(LIBS.pdfjs, 'pdfjsLib');
  lib.GlobalWorkerOptions.workerSrc = LIBS.pdfjsWorker;
  return lib;
}

/* ---------- drop zone ---------- */
/** dropZone({accept, multiple, label, hint, onFiles}) → element. Validation is the caller's job. */
export function dropZone({ accept, multiple = false, label, hint, onFiles, compact = false }) {
  const input = h('input', { type: 'file', accept, multiple, class: 'vh', tabindex: -1, 'aria-hidden': 'true' });
  const zone = h('div.tw-drop' + (compact ? '.compact' : ''), { tabindex: 0, role: 'button', 'aria-label': label + '. ' + hint },
    h('span.tw-drop-ic', { html: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V4M7.5 8.5 12 4l4.5 4.5"/><path d="M4 14v4.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V14"/></svg>' }),
    h('b', label), h('span.tw-drop-h', hint), input);
  const pick = () => input.click();
  zone.addEventListener('click', e => { if (e.target !== input) pick(); });
  zone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
  input.addEventListener('change', () => { if (input.files.length) onFiles([...input.files]); input.value = ''; });
  ['dragenter', 'dragover'].forEach(t => zone.addEventListener(t, e => { e.preventDefault(); zone.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(t => zone.addEventListener(t, e => { e.preventDefault(); zone.classList.remove('over'); }));
  zone.addEventListener('drop', e => { const f = [...(e.dataTransfer?.files || [])]; if (f.length) onFiles(multiple ? f : f.slice(0, 1)); });
  return zone;
}

/* ---------- small UI pieces every tool shares ---------- */
/** Segmented control. opts: [[value,label]], returns element with .value getter/setter. */
export function seg(name, opts, value, onChange, { small = false } = {}) {
  const wrap = h('div.tw-seg' + (small ? '.sm' : ''), { role: 'radiogroup', 'aria-label': name });
  const btns = opts.map(([v, l]) => h('button', {
    type: 'button', role: 'radio', 'aria-checked': String(v === value), tabindex: v === value ? 0 : -1, 'data-v': v,
    onclick: () => set(v, true)
  }, l));
  function set(v, fire) {
    value = v;
    btns.forEach(b => { const on = b.dataset.v === String(v); b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; });
    if (fire) onChange(v);
  }
  wrap.addEventListener('keydown', e => {
    const i = btns.findIndex(b => b.dataset.v === String(value));
    let n = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % btns.length;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i - 1 + btns.length) % btns.length;
    if (n == null) return;
    e.preventDefault();
    const v = opts[n][0]; set(v, true); btns[n].focus();
  });
  wrap.append(...btns);
  Object.defineProperty(wrap, 'value', { get: () => value, set: v => set(v, false) });
  return wrap;
}

/** Labelled field wrapper. */
export function field(label, control, hint) {
  const id = control.id || (control.id = 'f' + Math.random().toString(36).slice(2, 8));
  return h('div.tw-field', h('label', { for: id }, label), control, hint ? h('span.tw-hint', hint) : null);
}

/** An empty / status block for the output panel. */
export function state(kind, title, text) {
  return h('div.tw-state.' + kind, h('span.tw-state-ic', { 'aria-hidden': 'true' }), h('b', title), text ? h('p', text) : null);
}

/** Output-panel section with a mono label. */
export function block(label, ...kids) {
  return h('section.tw-block', h('h4.tw-k', label), ...kids);
}

export function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

export const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A mono tag: SAMPLE / DEMO ONLY / LOCAL etc. */
export function tag(text, kind = '') { return h('span.tw-tag' + (kind ? '.' + kind : ''), text); }

/** Busy indicator with a label that can be updated. */
export function busy(text) {
  const t = h('span', text);
  const el = h('div.tw-busy', { role: 'status', 'aria-live': 'polite' }, h('i', { 'aria-hidden': 'true' }), t);
  el.set = s => { t.textContent = s; };
  return el;
}

/** Read a File as an HTMLImageElement (object URL kept on img.dataset.url for cleanup). */
export function fileToImage(blob) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('This file could not be read as an image.')); };
    img.dataset.url = url;
    img.src = url;
  });
}

export function canvasToBlob(canvas, type, quality) {
  return new Promise((res, rej) => canvas.toBlob(b => b ? res(b) : rej(new Error('Your browser could not encode ' + type + '.')), type, quality));
}

export function baseName(name) { return (name || 'file').replace(/\.[^./\\]+$/, '') || 'file'; }
