/* 07 · PDF toolkit — real operations on your files, entirely in this tab.
   pdf-lib (the @cantoo fork the full app uses, which can open password-protected
   files) does the editing; PDF.js renders previews and the compression passes. */
import { h, bytes, download, dropZone, seg, field, state, tag, busy, loadScript, LIBS, pdfjs, toast, baseName } from './lib.js';

const MAX = 50 * 1024 * 1024;
const MODES = [
  ['merge', 'Merge', 'Organise'], ['split', 'Split', 'Organise'], ['rotate', 'Rotate', 'Organise'],
  ['watermark', 'Watermark', 'Edit'], ['unlock', 'Unlock', 'Edit'], ['jpg', 'JPG to PDF', 'Edit'],
  ['compress', 'Compress', 'Compress'], ['c100', 'To 100 KB', 'Compress'], ['c1m', 'To 1 MB', 'Compress'], ['cmail', 'For email', 'Compress']
];
const TARGET = { c100: 100 * 1024, c1m: 1024 * 1024, cmail: 5 * 1024 * 1024 };
const HELP = {
  merge: 'Add two or more PDFs, put them in order, merge into one.',
  split: 'Pull pages out into separate files by range.',
  rotate: 'Turn every page, or only the pages you list.',
  watermark: 'Stamp text across every page.',
  unlock: 'Remove a password you already know, from a file you are allowed to change.',
  jpg: 'Turn JPG or PNG images into one PDF, one image per page.',
  compress: 'Redraw pages at a lighter resolution. Good for scans.',
  c100: 'Find the sharpest version that fits under 100 KB.',
  c1m: 'Find the sharpest version that fits under 1 MB.',
  cmail: 'Target 5 MB — safe for most inboxes, not just Gmail\'s 25 MB cap.'
};

let PDFLib;
const lib = async () => (PDFLib ||= await loadScript(LIBS.pdflib, 'PDFLib'));

export function mount({ stage, out, setStatus }) {
  let mode = 'merge', files = [], seq = 0, busyRun = false, results = [];
  const urls = new Set();

  /* ---------- mode picker ---------- */
  const groups = [...new Set(MODES.map(m => m[2]))];
  const modeBtns = new Map();
  const picker = h('div.pf-modes', { role: 'radiogroup', 'aria-label': 'PDF operation' },
    ...groups.map(g => h('div.pf-g', h('span.tw-k', g), h('div.pf-gb', ...MODES.filter(m => m[2] === g).map(([k, l]) => {
      const b = h('button', { type: 'button', role: 'radio', 'aria-checked': String(k === mode), tabindex: k === mode ? 0 : -1, onclick: () => setMode(k) }, l);
      modeBtns.set(k, b); return b;
    })))));
  picker.addEventListener('keydown', e => {
    const keys = MODES.map(m => m[0]); const i = keys.indexOf(mode);
    const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!d) return;
    e.preventDefault();
    const k = keys[(i + d + keys.length) % keys.length]; setMode(k); modeBtns.get(k).focus();
  });

  const help = h('p.pf-help');
  const zoneWrap = h('div.pf-zone');
  const list = h('ol.pf-files', { 'aria-label': 'Files' });
  const opts = h('div.pf-opts');
  const err = h('p.tw-err', { role: 'alert', hidden: true });
  const run = h('button.tw-btn', { type: 'button', onclick: go }, 'Run');
  const sampleBtn = h('button.tw-chip', { type: 'button', onclick: sample }, 'Make a sample PDF');

  stage.append(picker, help, zoneWrap, list, opts, err, h('div.pf-run', run, h('span.tw-hint', 'Processed in this tab. Files are never uploaded.')));

  function setMode(k) {
    if (busyRun) return;
    const wasImg = mode === 'jpg', isImg = k === 'jpg';
    mode = k;
    modeBtns.forEach((b, key) => { b.setAttribute('aria-checked', String(key === k)); b.tabIndex = key === k ? 0 : -1; });
    help.textContent = HELP[k];
    if (wasImg !== isImg) files = [];
    if (!['merge', 'jpg'].includes(k) && files.length > 1) files = files.slice(0, 1);
    zoneWrap.replaceChildren(dropZone({
      accept: isImg ? 'image/jpeg,image/png' : '.pdf,application/pdf', multiple: ['merge', 'jpg'].includes(k),
      label: isImg ? 'Drop JPG or PNG images' : ['merge'].includes(k) ? 'Drop PDFs to merge' : 'Drop a PDF',
      hint: (isImg ? 'JPG or PNG' : 'PDF') + ' · up to 50 MB each · stays on this device',
      onFiles: add
    }), ...(isImg ? [] : [sampleBtn]));
    drawOpts(); drawList(); idle();
  }

  /* ---------- files ---------- */
  async function add(list_) {
    err.hidden = true;
    await lib().catch(e => fail(e.message));
    if (!PDFLib) return;
    for (const f of list_) {
      if (mode === 'jpg') {
        if (!/^image\/(jpeg|png)$/.test(f.type)) { fail(`"${f.name}" is not a JPG or PNG.`); continue; }
      } else if (!(f.type === 'application/pdf' || /\.pdf$/i.test(f.name))) { fail(`"${f.name}" is not a PDF.`); continue; }
      if (f.size > MAX) { fail(`"${f.name}" is ${bytes(f.size)} — the preview takes up to 50 MB per file.`); continue; }
      const buf = await f.arrayBuffer();
      const rec = { id: Math.random().toString(36).slice(2), name: f.name, size: f.size, buf, type: f.type, pages: null, encrypted: false };
      if (mode !== 'jpg') {
        try { const d = await PDFLib.PDFDocument.load(buf); rec.pages = d.getPageCount(); }
        catch (e) {
          if (/encrypt/i.test(e.message || e.name)) rec.encrypted = true;
          else { fail(`"${f.name}" could not be read as a PDF — it may be damaged.`); continue; }
        }
      }
      if (['merge', 'jpg'].includes(mode)) files.push(rec); else files = [rec];
    }
    drawList(); drawOpts(); idle();
  }
  function drawList() {
    const many = ['merge', 'jpg'].includes(mode);
    list.replaceChildren(...files.map((f, i) => h('li',
      h('span.pf-ic', { 'aria-hidden': 'true' }, mode === 'jpg' ? 'IMG' : 'PDF'),
      h('div.pf-fn', h('b', f.name), h('span', [bytes(f.size), f.pages != null ? f.pages + (f.pages === 1 ? ' page' : ' pages') : null, f.encrypted ? 'password-protected' : null].filter(Boolean).join(' · '))),
      many ? h('div.pf-ord',
        h('button.tw-icon', { type: 'button', disabled: i === 0, 'aria-label': 'Move ' + f.name + ' up', onclick: () => { [files[i - 1], files[i]] = [files[i], files[i - 1]]; drawList(); } }, '↑'),
        h('button.tw-icon', { type: 'button', disabled: i === files.length - 1, 'aria-label': 'Move ' + f.name + ' down', onclick: () => { [files[i + 1], files[i]] = [files[i], files[i + 1]]; drawList(); } }, '↓')) : null,
      h('button.tw-x', { type: 'button', 'aria-label': 'Remove ' + f.name, onclick: () => { files.splice(i, 1); drawList(); drawOpts(); idle(); } }, '×'))));
    run.disabled = !ready();
  }
  function ready() {
    if (mode === 'merge') return files.length >= 2;
    return files.length >= 1;
  }

  /* ---------- per-mode options ---------- */
  let o = {};
  function drawOpts() {
    opts.replaceChildren();
    const f = files[0];
    if (mode === 'split') {
      o.ranges = h('input.tw-input', { type: 'text', placeholder: f?.pages ? `e.g. 1-${Math.min(2, f.pages)}, ${Math.min(3, f.pages)}` : 'e.g. 1-2, 3', value: o.rangesV || '' });
      o.ranges.addEventListener('input', () => { o.rangesV = o.ranges.value; });
      o.every = h('input', { type: 'checkbox', checked: !!o.everyV, onchange: () => { o.everyV = o.every.checked; o.ranges.disabled = o.every.checked; } });
      o.ranges.disabled = !!o.everyV;
      opts.append(field('Page ranges', o.ranges, 'Each range becomes its own file'), h('label.tw-check', o.every, ' One file per page'));
    }
    if (mode === 'rotate') {
      o.angle = seg('Angle', [['90', '90° right'], ['180', '180°'], ['270', '90° left']], o.angleV || '90', v => { o.angleV = v; }, { small: true });
      o.pages = h('input.tw-input', { type: 'text', placeholder: 'All pages', value: o.pagesV || '' });
      o.pages.addEventListener('input', () => { o.pagesV = o.pages.value; });
      opts.append(h('div.tw-field', h('span.tw-k', 'Angle'), o.angle), field('Pages', o.pages, 'Blank = all · or e.g. 1, 3-4'));
    }
    if (mode === 'watermark') {
      o.text = h('input.tw-input', { type: 'text', maxlength: 60, value: o.textV ?? 'CONFIDENTIAL' });
      o.text.addEventListener('input', () => { o.textV = o.text.value; });
      o.op = h('input', { type: 'range', min: 5, max: 60, value: o.opV || 18, 'aria-label': 'Opacity' });
      const opOut = h('output', (o.opV || 18) + '%');
      o.op.addEventListener('input', () => { o.opV = +o.op.value; opOut.textContent = o.op.value + '%'; });
      o.pos = seg('Placement', [['diag', 'Diagonal'], ['center', 'Centre'], ['foot', 'Footer']], o.posV || 'diag', v => { o.posV = v; }, { small: true });
      opts.append(field('Text', o.text, 'Latin letters and numbers'), h('div.tw-field', h('span.tw-k', 'Opacity ', opOut), o.op), h('div.tw-field', h('span.tw-k', 'Placement'), o.pos));
    }
    if (mode === 'unlock') {
      o.pw = h('input.tw-input', { type: 'password', autocomplete: 'off', placeholder: 'The file\'s current password' });
      o.ok = h('input', { type: 'checkbox' });
      opts.append(
        field('Password', o.pw, 'Used only in this tab'),
        h('label.tw-check', o.ok, ' I own this file or have permission to remove its password'),
        h('p.tw-hint', 'This only works when you know the password. It does not crack or bypass protection.'));
      if (f && !f.encrypted) opts.append(h('p.tw-hint.warn', 'This file is not password-protected — there is nothing to unlock.'));
    }
    if (mode === 'jpg') {
      o.size = seg('Page size', [['fit', 'Fit image'], ['a4', 'A4'], ['letter', 'Letter']], o.sizeV || 'fit', v => { o.sizeV = v; }, { small: true });
      opts.append(h('div.tw-field', h('span.tw-k', 'Page size'), o.size));
    }
    if (mode === 'compress') {
      o.level = seg('Strength', [['light', 'Light'], ['balanced', 'Balanced'], ['strong', 'Strong']], o.levelV || 'balanced', v => { o.levelV = v; }, { small: true });
      opts.append(h('div.tw-field', h('span.tw-k', 'Strength'), o.level));
    }
    if (mode.startsWith('c')) opts.append(h('p.tw-hint', 'Pages are redrawn as images, so text in the result is no longer selectable. The full app works the same way.'));
  }

  function idle() {
    if (busyRun) return;
    run.textContent = { merge: 'Merge PDFs', split: 'Split PDF', rotate: 'Rotate pages', watermark: 'Add watermark', unlock: 'Remove password', jpg: 'Create PDF', compress: 'Compress PDF', c100: 'Compress to 100 KB', c1m: 'Compress to 1 MB', cmail: 'Compress for email' }[mode];
    run.disabled = !ready();
    if (!results.length) out.replaceChildren(state('empty', files.length ? 'Ready to run' : 'No file yet',
      files.length ? 'Set the options and press the button. The result and a preview appear here.' : (mode === 'jpg' ? 'Add images to start.' : 'Add a PDF, or make a sample to try it right away.')));
  }
  function fail(m) { err.textContent = m; err.hidden = false; setStatus('error', 'Check the file'); }

  /* ---------- page-range parsing ---------- */
  function ranges(text, n) {
    const outR = [];
    for (const part of text.split(',').map(s => s.trim()).filter(Boolean)) {
      const m = part.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
      if (!m) throw new Error(`"${part}" is not a page or range.`);
      const a = +m[1], b = m[2] ? +m[2] : a;
      if (a < 1 || b < 1 || a > n || b > n) throw new Error(`Pages must be between 1 and ${n}.`);
      if (b < a) throw new Error(`"${part}" runs backwards.`);
      outR.push([a, b]);
    }
    if (!outR.length) throw new Error('Enter at least one page or range.');
    return outR;
  }

  /* ---------- run ---------- */
  async function go() {
    if (busyRun || !ready()) return;
    err.hidden = true;
    const my = ++seq;
    busyRun = true; run.disabled = true;
    const b = busy('Loading PDF engine');
    out.replaceChildren(h('section.tw-block', h('h4.tw-k', 'Working'), b));
    setStatus('working', 'Processing');
    try {
      await lib();
      const { PDFDocument, degrees, rgb, StandardFonts } = PDFLib;
      const t0 = performance.now();
      const made = [];
      const f = files[0];
      if (mode !== 'jpg' && mode !== 'unlock' && files.some(x => x.encrypted)) throw new Error('A file is password-protected. Unlock it first with the Unlock tool.');

      if (mode === 'merge') {
        const doc = await PDFDocument.create();
        for (const [i, x] of files.entries()) {
          b.set(`Adding ${i + 1} of ${files.length}: ${x.name}`);
          const src = await PDFDocument.load(x.buf);
          (await doc.copyPages(src, src.getPageIndices())).forEach(p => doc.addPage(p));
        }
        made.push({ name: 'merged.pdf', bytes: await doc.save(), pages: doc.getPageCount() });
      }
      if (mode === 'split') {
        const src = await PDFDocument.load(f.buf);
        const n = src.getPageCount();
        const rs = o.everyV ? Array.from({ length: n }, (_, i) => [i + 1, i + 1]) : ranges(o.rangesV || '', n);
        if (rs.length > 100) throw new Error('That makes more than 100 files — use fewer ranges in the preview.');
        for (const [a, z] of rs) {
          b.set(`Pages ${a}${z !== a ? '–' + z : ''}`);
          const d = await PDFDocument.create();
          (await d.copyPages(src, Array.from({ length: z - a + 1 }, (_, i) => a - 1 + i))).forEach(p => d.addPage(p));
          made.push({ name: `${baseName(f.name)}-p${a}${z !== a ? '-' + z : ''}.pdf`, bytes: await d.save(), pages: z - a + 1 });
        }
      }
      if (mode === 'rotate') {
        const d = await PDFDocument.load(f.buf);
        const n = d.getPageCount();
        const which = (o.pagesV || '').trim() ? new Set(ranges(o.pagesV, n).flatMap(([a, z]) => Array.from({ length: z - a + 1 }, (_, i) => a + i))) : null;
        const ang = +(o.angleV || 90);
        d.getPages().forEach((p, i) => { if (!which || which.has(i + 1)) p.setRotation(degrees((p.getRotation().angle + ang) % 360)); });
        made.push({ name: `${baseName(f.name)}-rotated.pdf`, bytes: await d.save(), pages: n });
      }
      if (mode === 'watermark') {
        const text = (o.textV ?? 'CONFIDENTIAL').trim();
        if (!text) throw new Error('Type the watermark text.');
        const d = await PDFDocument.load(f.buf);
        const font = await d.embedFont(StandardFonts.HelveticaBold);
        try { font.widthOfTextAtSize(text, 10); } catch { throw new Error('Use Latin letters, numbers and common symbols for the watermark.'); }
        const op = (o.opV || 18) / 100, pos = o.posV || 'diag';
        d.getPages().forEach(p => {
          const { width: w, height: hh } = p.getSize();
          const size = pos === 'foot' ? 11 : Math.min(w, hh) / Math.max(6, text.length * .62);
          const tw = font.widthOfTextAtSize(text, size);
          const color = pos === 'foot' ? rgb(.3, .29, .23) : rgb(.91, .26, .11);
          if (pos === 'diag') {
            const c = Math.SQRT1_2;
            p.drawText(text, { x: w / 2 - (tw / 2) * c + (size / 3) * c, y: hh / 2 - (tw / 2) * c - (size / 3) * c, size, font, color, opacity: op, rotate: degrees(45) });
          } else if (pos === 'center') p.drawText(text, { x: (w - tw) / 2, y: hh / 2 - size / 3, size, font, color, opacity: op });
          else p.drawText(text, { x: (w - tw) / 2, y: 22, size, font, color, opacity: Math.max(op, .5) });
        });
        made.push({ name: `${baseName(f.name)}-watermarked.pdf`, bytes: await d.save(), pages: d.getPageCount() });
      }
      if (mode === 'unlock') {
        if (!f.encrypted) throw new Error('This PDF has no password — nothing to unlock.');
        if (!o.ok?.checked) throw new Error('Confirm that you own this file or have permission to unlock it.');
        if (!o.pw.value) throw new Error('Enter the file\'s password.');
        let d;
        try { d = await PDFDocument.load(f.buf, { password: o.pw.value }); }
        catch { throw new Error('Couldn’t unlock this file — check the password and try again.'); }
        o.pw.value = '';
        made.push({ name: `${baseName(f.name)}-unlocked.pdf`, bytes: await d.save(), pages: d.getPageCount() });
      }
      if (mode === 'jpg') {
        const d = await PDFDocument.create();
        for (const [i, x] of files.entries()) {
          b.set(`Image ${i + 1} of ${files.length}`);
          const img = x.type === 'image/png' ? await d.embedPng(x.buf) : await d.embedJpg(x.buf);
          const sz = o.sizeV || 'fit';
          if (sz === 'fit') { const p = d.addPage([img.width * .75, img.height * .75]); p.drawImage(img, { x: 0, y: 0, width: img.width * .75, height: img.height * .75 }); }
          else {
            const [W, H] = sz === 'a4' ? [595.28, 841.89] : [612, 792];
            const land = img.width > img.height;
            const pw = land ? H : W, ph = land ? W : H, m = 28;
            const s = Math.min((pw - 2 * m) / img.width, (ph - 2 * m) / img.height);
            const p = d.addPage([pw, ph]);
            p.drawImage(img, { x: (pw - img.width * s) / 2, y: (ph - img.height * s) / 2, width: img.width * s, height: img.height * s });
          }
        }
        made.push({ name: 'images.pdf', bytes: await d.save(), pages: d.getPageCount() });
      }
      if (mode.startsWith('c')) {
        const pj = await pdfjs();
        const src = await pj.getDocument({ data: f.buf.slice(0), isEvalSupported: false }).promise;
        const n = src.numPages;
        if (n > 150) throw new Error('The preview compresses up to 150 pages. The full app has no such limit.');
        const ladder = mode === 'compress'
          ? [{ light: [2, .82], balanced: [1.5, .7], strong: [1.1, .55] }[o.levelV || 'balanced']]
          : [[2, .8], [1.6, .72], [1.35, .64], [1.1, .56], [.9, .5], [.75, .42], [.6, .36], [.5, .3]];
        const target = TARGET[mode];
        let best = null;
        for (const [li, [scale, q]] of ladder.entries()) {
          const d = await PDFDocument.create();
          for (let i = 1; i <= n; i++) {
            if (my !== seq) return;
            b.set(`${target ? `Pass ${li + 1} · ` : ''}page ${i} of ${n} at ${Math.round(scale * 72)} dpi, quality ${Math.round(q * 100)}`);
            const page = await src.getPage(i);
            const base = page.getViewport({ scale: 1 });
            const vp = page.getViewport({ scale });
            const c = document.createElement('canvas');
            c.width = Math.max(1, Math.floor(vp.width)); c.height = Math.max(1, Math.floor(vp.height));
            const ctx = c.getContext('2d');
            ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
            await page.render({ canvasContext: ctx, viewport: vp }).promise;
            const jpg = await new Promise(r => c.toBlob(r, 'image/jpeg', q));
            const img = await d.embedJpg(await jpg.arrayBuffer());
            d.addPage([base.width, base.height]).drawImage(img, { x: 0, y: 0, width: base.width, height: base.height });
            c.width = c.height = 0;
          }
          const bytes_ = await d.save();
          best = { bytes: bytes_, scale, q };
          if (!target || bytes_.length <= target) break;
        }
        src.destroy();
        const smaller = best.bytes.length < f.size;
        const hit = target ? best.bytes.length <= target : true;
        made.push({
          name: `${baseName(f.name)}-compressed.pdf`, bytes: smaller ? best.bytes : new Uint8Array(f.buf), pages: n,
          note: !smaller ? 'Already lean — compressing made it bigger, so you get the original back.'
            : !hit ? `Couldn’t get under ${bytes(target)}; this is the smallest readable version (${Math.round(best.scale * 72)} dpi).`
              : `${Math.round(best.scale * 72)} dpi, JPEG quality ${Math.round(best.q * 100)}.`,
          before: f.size, warn: !hit
        });
      }
      if (my !== seq) return;
      results = made;
      await show(made, performance.now() - t0);
      setStatus('done', made.length > 1 ? made.length + ' files ready' : 'Done');
    } catch (e) {
      if (my !== seq) return;
      results = [];
      out.replaceChildren(state('err', 'That didn’t work', e.message || String(e)));
      setStatus('error', 'Failed');
    } finally {
      if (my === seq) { busyRun = false; idle(); run.disabled = !ready(); }
    }
  }

  async function show(made, ms) {
    urls.forEach(u => URL.revokeObjectURL(u)); urls.clear();
    const total = made.reduce((a, m) => a + m.bytes.length, 0);
    const thumb = h('div.pf-thumb', h('span.tw-hint', 'Rendering preview…'));
    out.replaceChildren(
      h('section.tw-block', h('div.tw-ohead', h('h4.tw-k', made.length > 1 ? `${made.length} files` : 'Result'), tag('Processed locally', 'ok')),
        made[0].before ? h('div.pf-cmp',
          h('div', h('span', 'Before'), h('b', bytes(made[0].before))),
          h('i', { 'aria-hidden': 'true' }, '→'),
          h('div.hot', h('span', 'After'), h('b', bytes(made[0].bytes.length))),
          h('div', h('span', 'Saved'), h('b', Math.max(0, Math.round((1 - made[0].bytes.length / made[0].before) * 100)) + '%'))) : null,
        made[0].note ? h('p.tw-hint' + (made[0].warn ? '.warn' : ''), made[0].note) : null,
        h('ul.pf-outs', ...made.slice(0, 100).map(m => h('li',
          h('div.pf-fn', h('b', m.name), h('span', `${bytes(m.bytes.length)} · ${m.pages} ${m.pages === 1 ? 'page' : 'pages'}`)),
          h('button.tw-chip', { type: 'button', onclick: () => download(new Blob([m.bytes], { type: 'application/pdf' }), m.name) }, 'Download')))),
        h('dl.tw-stats', h('div', h('dt', 'Output'), h('dd', bytes(total))), h('div', h('dt', 'Took'), h('dd', (ms / 1000).toFixed(2) + ' s')))),
      h('section.tw-block', h('h4.tw-k', 'Preview · page 1'), thumb)
    );
    try {
      const pj = await pdfjs();
      const d = await pj.getDocument({ data: made[0].bytes.slice(0), isEvalSupported: false }).promise;
      const p = await d.getPage(1);
      const v0 = p.getViewport({ scale: 1 });
      const vp = p.getViewport({ scale: Math.min(2, 520 / v0.width) });
      const c = h('canvas', { width: Math.floor(vp.width), height: Math.floor(vp.height), 'aria-label': 'Preview of page 1', role: 'img' });
      await p.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
      thumb.replaceChildren(c);
      d.destroy();
    } catch { thumb.replaceChildren(h('span.tw-hint', 'No preview for this file, but the download is ready.')); }
  }

  /* ---------- a generated sample, so nobody needs a file to try it ---------- */
  async function sample() {
    err.hidden = true;
    sampleBtn.disabled = true;
    try {
      await lib();
      const { PDFDocument, rgb, StandardFonts } = PDFLib;
      const d = await PDFDocument.create();
      const bold = await d.embedFont(StandardFonts.HelveticaBold), reg = await d.embedFont(StandardFonts.Helvetica);
      // a "photo" page so compression has something real to work on
      const c = document.createElement('canvas'); c.width = 1800; c.height = 1200;
      const x = c.getContext('2d');
      const g = x.createLinearGradient(0, 0, 1800, 1200); g.addColorStop(0, '#E8431C'); g.addColorStop(.5, '#F6F2EA'); g.addColorStop(1, '#231D45');
      x.fillStyle = g; x.fillRect(0, 0, 1800, 1200);
      for (let i = 0; i < 2600; i++) { x.fillStyle = `hsla(${(i * 37) % 360},60%,${30 + (i % 50)}%,.35)`; x.beginPath(); x.arc(Math.random() * 1800, Math.random() * 1200, 4 + Math.random() * 26, 0, 7); x.fill(); }
      const photo = await d.embedJpg(await (await new Promise(r => c.toBlob(r, 'image/jpeg', .95))).arrayBuffer());
      for (let i = 1; i <= 3; i++) {
        const p = d.addPage([595.28, 841.89]);
        p.drawRectangle({ x: 0, y: 801, width: 595.28, height: 41, color: rgb(.09, .08, .06) });
        p.drawText('AIVORYX · SAMPLE DOCUMENT', { x: 40, y: 816, size: 11, font: bold, color: rgb(.96, .95, .92) });
        p.drawText(`Page ${i} of 3`, { x: 480, y: 816, size: 10, font: reg, color: rgb(.96, .95, .92) });
        p.drawText(['Quarterly summary', 'Site photography', 'Appendix'][i - 1], { x: 40, y: 740, size: 30, font: bold, color: rgb(.09, .08, .06) });
        if (i === 2) p.drawImage(photo, { x: 40, y: 330, width: 515, height: 343 });
        else for (let l = 0; l < 22; l++) p.drawText('Generated in your browser to try the PDF tools. Nothing here is real.', { x: 40, y: 690 - l * 22, size: 11, font: reg, color: rgb(.31, .29, .23) });
        p.drawRectangle({ x: 40, y: 60, width: 515, height: 2, color: rgb(.91, .26, .11) });
      }
      const buf = (await d.save()).buffer;
      const rec = { id: 'sample', name: 'aivoryx-sample.pdf', size: buf.byteLength, buf, type: 'application/pdf', pages: 3, encrypted: false };
      if (mode === 'merge') {
        // two copies so merge has something to merge
        files = [rec, { ...rec, id: 'sample2', name: 'aivoryx-sample-2.pdf' }];
      } else if (mode === 'unlock' && typeof d.encrypt === 'function') {
        d.encrypt({ userPassword: 'aivoryx', ownerPassword: 'aivoryx-owner' });
        const lb = (await d.save()).buffer;
        files = [{ ...rec, name: 'aivoryx-locked-sample.pdf', size: lb.byteLength, buf: lb, encrypted: true, pages: null }];
        toast('Sample password: aivoryx');
      } else files = [rec];
      drawList(); drawOpts(); idle();
      if (mode === 'unlock' && files[0].encrypted) opts.append(h('p.tw-hint.ok', 'This sample is locked with the password “aivoryx”.'));
      setStatus('ready', 'Sample ready');
    } catch (e) { fail(e.message || 'Could not make the sample.'); }
    finally { sampleBtn.disabled = false; }
  }

  setMode('merge');
  return () => { seq++; urls.forEach(u => URL.revokeObjectURL(u)); files = []; };
}
