/* 08 · Image toolkit — real processing in this tab.
   Canvas for compress / resize / convert, heic2any for HEIC, and for background
   removal the same u2netp model and pre/post-processing as image-tools.aivoryx.com,
   run with ONNX Runtime Web on your device. */
import { h, bytes, download, dropZone, state, tag, busy, loadScript, LIBS, fileToImage, canvasToBlob, baseName, toast } from './lib.js';

const MAX = 25 * 1024 * 1024, MAX_PX = 40e6;
const MODES = [
  ['cjpg', 'Compress JPG', 'image/jpeg'], ['cpng', 'Compress PNG', 'image/png'], ['cwebp', 'Compress WebP', 'image/webp'],
  ['resize', 'Resize', null], ['heic', 'HEIC → JPG', 'image/jpeg'], ['png2webp', 'PNG → WebP', 'image/webp'],
  ['webp2png', 'WebP → PNG', 'image/png'], ['bg', 'Remove background', 'image/png']
];
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const NAME = { 'image/jpeg': 'JPG', 'image/png': 'PNG', 'image/webp': 'WebP' };
const MODEL_URL = new URL('../../models/u2netp.onnx', import.meta.url).href;

let session = null;

export function mount({ stage, out, setStatus }) {
  let mode = 'cjpg', src = null, result = null, q = 80, fmt = 'image/jpeg', W = 0, H = 0, lock = true, timer = 0, seq = 0;
  const urls = new Set();
  const track = u => (urls.add(u), u);

  const modeBtns = new Map();
  const picker = h('div.im-modes', { role: 'radiogroup', 'aria-label': 'Image operation' }, ...MODES.map(([k, l]) => {
    const b = h('button', { type: 'button', role: 'radio', 'aria-checked': String(k === mode), tabindex: k === mode ? 0 : -1, onclick: () => setMode(k) }, l);
    modeBtns.set(k, b); return b;
  }));
  picker.addEventListener('keydown', e => {
    const keys = MODES.map(m => m[0]); const i = keys.indexOf(mode);
    const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!d) return; e.preventDefault();
    const k = keys[(i + d + keys.length) % keys.length]; setMode(k); modeBtns.get(k).focus();
  });

  const zoneWrap = h('div.im-zone');
  const fileRow = h('div.im-file', { hidden: true });
  const err = h('p.tw-err', { role: 'alert', hidden: true });

  /* controls */
  const fmtSel = h('select.tw-select', { 'aria-label': 'Output format', onchange: () => { fmt = fmtSel.value; syncControls(); schedule(); } },
    ...Object.keys(NAME).map(t => h('option', { value: t }, NAME[t])));
  const qIn = h('input', { type: 'range', min: 10, max: 100, value: q, 'aria-label': 'Quality' });
  const qOut = h('output', q + '%');
  qIn.addEventListener('input', () => { q = +qIn.value; qOut.textContent = q + '%'; schedule(); });
  const wIn = h('input.tw-input', { type: 'number', min: 1, max: 8000, inputmode: 'numeric', 'aria-label': 'Width in pixels' });
  const hIn = h('input.tw-input', { type: 'number', min: 1, max: 8000, inputmode: 'numeric', 'aria-label': 'Height in pixels' });
  const lockBtn = h('button.tw-icon.im-lock', { type: 'button', 'aria-pressed': 'true', 'aria-label': 'Keep aspect ratio', title: 'Keep aspect ratio', onclick: () => { lock = !lock; lockBtn.setAttribute('aria-pressed', String(lock)); } }, '⛓');
  wIn.addEventListener('input', () => { W = clamp(+wIn.value); if (lock && src) { H = clamp(Math.round(W * src.h / src.w)); hIn.value = H; } schedule(); });
  hIn.addEventListener('input', () => { H = clamp(+hIn.value); if (lock && src) { W = clamp(Math.round(H * src.w / src.h)); wIn.value = W; } schedule(); });
  const presets = h('div.im-pre', ...[1920, 1280, 800, 400].map(px => h('button.tw-chip', { type: 'button', onclick: () => { if (!src) return; W = Math.min(px, 8000); H = clamp(Math.round(W * src.h / src.w)); wIn.value = W; hIn.value = H; schedule(); } }, px + ' px')));
  const fmtRow = h('div.tw-field', h('span.tw-k', 'Output format'), fmtSel);
  const qRow = h('div.tw-field', h('span.tw-k', 'Quality ', qOut), qIn);
  const sizeRow = h('div.tw-field.im-size', h('span.tw-k', 'Size · pixels'), h('div.im-wh', wIn, h('span', '×'), hIn, lockBtn), presets);
  const bgBtn = h('button.tw-btn', { type: 'button', onclick: () => process(true) }, 'Remove background');
  const bgRow = h('div.im-bg', bgBtn, h('p.tw-hint', 'Runs the u2netp model on your device. First use downloads it (4.4 MB), then it is cached.'));
  const controls = h('div.im-ctl', fmtRow, qRow, sizeRow, bgRow);

  stage.append(picker, zoneWrap, fileRow, err, controls);

  function clamp(n) { return Math.max(1, Math.min(8000, Math.round(n) || 1)); }

  function setMode(k) {
    mode = k;
    modeBtns.forEach((b, key) => { b.setAttribute('aria-checked', String(key === k)); b.tabIndex = key === k ? 0 : -1; });
    const m = MODES.find(x => x[0] === k);
    if (m[2]) fmt = m[2];
    else if (src) fmt = ['image/jpeg', 'image/png', 'image/webp'].includes(src.type) ? src.type : 'image/jpeg';
    const heic = k === 'heic';
    const acceptFor = { heic: '.heic,.heif,image/heic,image/heif', png2webp: 'image/png', webp2png: 'image/webp', cjpg: 'image/jpeg', cpng: 'image/png', cwebp: 'image/webp' }[k] || 'image/jpeg,image/png,image/webp';
    zoneWrap.replaceChildren(dropZone({
      accept: acceptFor, label: heic ? 'Drop a HEIC photo' : 'Drop an image',
      hint: (heic ? 'HEIC / HEIF from an iPhone' : acceptFor.replace(/image\//g, '').toUpperCase().replace(/,/g, ', ').replace('JPEG', 'JPG')) + ' · up to 25 MB · never uploaded',
      onFiles: f => load(f[0])
    }), ...(heic ? [] : [h('button.tw-chip', { type: 'button', onclick: sample }, 'Use a sample image')]));
    // a loaded file that does not fit the new mode is set aside
    if (src && !fits(src)) { clearSrc(); }
    syncControls();
    if (src) schedule(); else empty();
  }
  function fits(s) {
    if (mode === 'heic') return s.heic;
    if (s.heic) return false;
    return ({ cjpg: ['image/jpeg'], cpng: ['image/png'], cwebp: ['image/webp'], png2webp: ['image/png'], webp2png: ['image/webp'] }[mode] || [s.type]).includes(s.type);
  }
  function syncControls() {
    fmtSel.value = fmt;
    fmtRow.hidden = mode !== 'resize';
    qRow.hidden = mode === 'bg' || fmt === 'image/png';
    sizeRow.hidden = mode === 'bg' || mode === 'heic';
    bgRow.hidden = mode !== 'bg';
    controls.hidden = !src;
  }
  function empty() {
    out.replaceChildren(state('empty', 'No image yet', mode === 'heic' ? 'Add a .heic photo to convert it to JPG.' : 'Add an image or use the sample. Before and after appear here, with real file sizes.'));
    setStatus('ready', 'Waiting for an image');
  }
  function clearSrc() { src = null; result = null; fileRow.hidden = true; }

  async function load(f) {
    err.hidden = true;
    const isHeic = /\.(heic|heif)$/i.test(f.name) || /image\/hei[cf]/.test(f.type);
    if (mode === 'heic' && !isHeic) return fail(`"${f.name}" is not a HEIC file.`);
    if (mode !== 'heic' && isHeic) return fail('HEIC files go through the HEIC → JPG tool.');
    if (!isHeic && !/^image\/(jpeg|png|webp)$/.test(f.type)) return fail(`"${f.name}" is not a JPG, PNG or WebP.`);
    if (f.size > MAX) return fail(`${bytes(f.size)} is over the 25 MB preview limit.`);
    const s = { name: f.name, size: f.size, type: isHeic ? 'image/heic' : f.type, blob: f, heic: isHeic };
    if (!fits(s)) return fail(`This tool takes ${({ cjpg: 'JPG', cpng: 'PNG', cwebp: 'WebP', png2webp: 'PNG', webp2png: 'WebP' })[mode]} files.`);
    const my = ++seq;
    if (isHeic) {
      setStatus('working', 'Decoding HEIC');
      out.replaceChildren(h('section.tw-block', busy('Loading the HEIC decoder')));
      try {
        const heic2any = await loadScript(LIBS.heic, 'heic2any');
        let jpg = await heic2any({ blob: f, toType: 'image/jpeg', quality: q / 100 });
        if (Array.isArray(jpg)) jpg = jpg[0];
        if (my !== seq) return;
        s.decoded = jpg;
      } catch (e) { return fail(e?.message?.includes('load') ? e.message : 'This HEIC file could not be decoded. The full app may handle it.'); }
    }
    try {
      const img = await fileToImage(s.decoded || f);
      track(img.dataset.url);
      if (img.naturalWidth * img.naturalHeight > MAX_PX) return fail('That image is over 40 megapixels — too large for the preview.');
      Object.assign(s, { img, w: img.naturalWidth, h: img.naturalHeight, url: img.dataset.url });
    } catch (e) { return fail(e.message); }
    if (my !== seq) return;
    src = s; result = null;
    W = s.w; H = s.h; wIn.value = W; hIn.value = H;
    if (mode === 'resize') fmt = s.type === 'image/heic' ? 'image/jpeg' : s.type;
    fileRow.hidden = false;
    fileRow.replaceChildren(h('img', { src: s.url, alt: '' }), h('div', h('b', s.name), h('span', `${bytes(s.size)} · ${s.w}×${s.h} · ${s.heic ? 'HEIC' : NAME[s.type]}`)),
      h('button.tw-x', { type: 'button', 'aria-label': 'Remove image', onclick: () => { clearSrc(); syncControls(); empty(); } }, '×'));
    syncControls();
    if (mode === 'bg') { result = null; outShow(); setStatus('ready', 'Ready to remove background'); }
    else process();
  }
  function fail(m) { err.textContent = m; err.hidden = false; setStatus('error', 'Check the file'); if (!src) empty(); }

  function schedule() { clearTimeout(timer); if (!src || mode === 'bg') return; setStatus('working', 'Processing'); timer = setTimeout(process, 260); }

  async function process(force) {
    if (!src) return;
    if (mode === 'bg' && !force) return;
    const my = ++seq;
    setStatus('working', mode === 'bg' ? 'Removing background' : 'Encoding');
    const t0 = performance.now();
    try {
      let blob, w = src.w, hh = src.h, note = '';
      if (mode === 'bg') {
        bgBtn.disabled = true;
        const b = busy('Loading ONNX Runtime');
        out.replaceChildren(h('section.tw-block', h('h4.tw-k', 'On-device AI'), b));
        blob = await removeBg(src.img, s => { if (my === seq) b.set(s); });
        bgBtn.disabled = false;
      } else if (mode === 'heic') {
        blob = src.decoded;
      } else {
        // every canvas mode honours the width/height fields (they start at the original size)
        w = W; hh = H;
        const c = document.createElement('canvas'); c.width = w; c.height = hh;
        const x = c.getContext('2d');
        if (fmt === 'image/jpeg') { x.fillStyle = '#fff'; x.fillRect(0, 0, w, hh); } // JPG has no transparency
        x.imageSmoothingQuality = 'high';
        x.drawImage(src.img, 0, 0, w, hh);
        blob = await canvasToBlob(c, fmt, fmt === 'image/png' ? undefined : q / 100);
        c.width = c.height = 0;
        if (fmt === 'image/webp' && blob.type !== 'image/webp') throw new Error('This browser cannot encode WebP. Try Chrome, Edge or Firefox — or the full app.');
        if (['cjpg', 'cpng', 'cwebp'].includes(mode) && blob.size >= src.size && w === src.w && hh === src.h) {
          note = mode === 'cpng'
            ? 'This PNG is already well packed — a browser re-encode came out larger. Try resizing, or PNG → WebP.'
            : 'Already smaller than this quality setting would make it. Lower the quality or the size.';
        }
      }
      if (my !== seq) return;
      const img = await fileToImage(blob);
      track(img.dataset.url);
      result = { blob, url: img.dataset.url, w: img.naturalWidth, h: img.naturalHeight, ms: performance.now() - t0, note };
      outShow();
      setStatus('done', note ? 'Done · see note' : 'Done');
    } catch (e) {
      if (my !== seq) return;
      bgBtn.disabled = false;
      out.replaceChildren(state('err', 'That didn’t work', e.message || String(e)));
      setStatus('error', 'Failed');
    }
  }

  function outShow() {
    if (!src) return empty();
    const before = h('img.im-b', { src: src.url, alt: 'Original image' });
    if (!result) {
      out.replaceChildren(h('section.tw-block', h('h4.tw-k', 'Original'), h('div.im-cmp.single', before)), state('empty', 'Ready', 'Press “Remove background”. Nothing is uploaded.'));
      return;
    }
    const after = h('img.im-a', { src: result.url, alt: 'Processed image' });
    const range = h('input.im-range', { type: 'range', min: 0, max: 100, value: 50, 'aria-label': 'Compare before and after' });
    const cmp = h('div.im-cmp' + (mode === 'bg' ? '.chk' : ''), { style: { '--x': '50%', aspectRatio: `${src.w} / ${src.h}` } },
      before, h('div.im-after', after), h('span.im-handle', { 'aria-hidden': 'true' }), h('span.im-lb.l', src.heic ? 'HEIC (decoded)' : 'Before'), h('span.im-lb.r', 'After'), range);
    range.addEventListener('input', () => cmp.style.setProperty('--x', range.value + '%'));
    const outType = result.blob.type || fmt;
    const saved = Math.round((1 - result.blob.size / src.size) * 100);
    const name = `${baseName(src.name)}-${mode === 'bg' ? 'cutout' : mode === 'resize' ? `${result.w}x${result.h}` : 'aivoryx'}.${EXT[outType] || 'png'}`;
    out.replaceChildren(
      h('section.tw-block', h('div.tw-ohead', h('h4.tw-k', 'Before / after'), tag('Processed locally', 'ok')), cmp,
        h('p.tw-hint', 'Drag the slider to compare.')),
      h('section.tw-block',
        h('div.pf-cmp',
          h('div', h('span', 'Original'), h('b', bytes(src.size))),
          h('i', { 'aria-hidden': 'true' }, '→'),
          h('div.hot', h('span', 'Result'), h('b', bytes(result.blob.size))),
          h('div', h('span', saved >= 0 ? 'Saved' : 'Larger'), h('b', Math.abs(saved) + '%'))),
        result.note ? h('p.tw-hint.warn', result.note) : null,
        h('dl.tw-stats', h('div', h('dt', 'Size'), h('dd', `${result.w}×${result.h}`)), h('div', h('dt', 'Format'), h('dd', NAME[outType] || outType)), h('div', h('dt', 'Took'), h('dd', (result.ms / 1000).toFixed(2) + ' s'))),
        h('button.tw-btn', { type: 'button', onclick: () => download(result.blob, name) }, 'Download ' + (NAME[outType] || '')))
    );
  }

  /* ---------- background removal (mirrors the full app) ---------- */
  async function removeBg(img, say) {
    const ort = await loadScript(LIBS.ort, 'ort');
    ort.env.wasm.wasmPaths = LIBS.ortDir;
    ort.env.wasm.numThreads = 1; // no cross-origin isolation on this page; single-thread is the safe path
    if (!session) {
      say('Downloading the model (4.4 MB, once)');
      session = ort.InferenceSession.create(MODEL_URL, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' })
        .catch(e => { session = null; throw new Error('The background model could not load (' + (e.message || 'network') + '). The full app can do this.'); });
    }
    const s = await session;
    say('Reading the image');
    const w = img.naturalWidth, hh = img.naturalHeight;
    const full = document.createElement('canvas'); full.width = w; full.height = hh;
    const fx = full.getContext('2d', { willReadFrequently: true }); fx.drawImage(img, 0, 0);
    const small = document.createElement('canvas'); small.width = small.height = 320;
    const sx = small.getContext('2d', { willReadFrequently: true }); sx.drawImage(img, 0, 0, 320, 320);
    const px = sx.getImageData(0, 0, 320, 320).data;
    const N = 102400, t = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      t[i] = (px[4 * i] / 255 - .485) / .229;
      t[N + i] = (px[4 * i + 1] / 255 - .456) / .224;
      t[2 * N + i] = (px[4 * i + 2] / 255 - .406) / .225;
    }
    say('Finding the subject');
    await new Promise(r => setTimeout(r, 30));
    const res = await s.run({ [s.inputNames[0]]: new ort.Tensor('float32', t, [1, 3, 320, 320]) });
    const m = res[s.outputNames[0]].data;
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < m.length; i++) { if (m[i] < lo) lo = m[i]; if (m[i] > hi) hi = m[i]; }
    say('Cutting out');
    const mask = new ImageData(320, 320);
    for (let i = 0; i < N; i++) { const v = hi === lo ? 0 : Math.round((m[i] - lo) / (hi - lo) * 255); mask.data[4 * i] = mask.data[4 * i + 1] = mask.data[4 * i + 2] = v; mask.data[4 * i + 3] = 255; }
    const mc = document.createElement('canvas'); mc.width = mc.height = 320; mc.getContext('2d').putImageData(mask, 0, 0);
    const big = document.createElement('canvas'); big.width = w; big.height = hh;
    const bx = big.getContext('2d', { willReadFrequently: true }); bx.drawImage(mc, 0, 0, w, hh);
    const md = bx.getImageData(0, 0, w, hh).data;
    const o = fx.getImageData(0, 0, w, hh);
    for (let i = 0; i < w * hh; i++) o.data[4 * i + 3] = md[4 * i];
    fx.putImageData(o, 0, 0);
    const blob = await canvasToBlob(full, 'image/png');
    full.width = full.height = big.width = big.height = 0;
    return blob;
  }

  /* ---------- sample: drawn here, so it needs no download ---------- */
  async function sample() {
    const c = document.createElement('canvas'); c.width = 1600; c.height = 1100;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 1100); g.addColorStop(0, '#E9E2D2'); g.addColorStop(1, '#CFC5B0');
    x.fillStyle = g; x.fillRect(0, 0, 1600, 1100);
    for (let i = 0; i < 1400; i++) { x.fillStyle = `rgba(80,70,50,${Math.random() * .05})`; x.fillRect(Math.random() * 1600, Math.random() * 1100, 3, 3); }
    x.fillStyle = 'rgba(23,21,15,.18)'; x.beginPath(); x.ellipse(800, 900, 330, 46, 0, 0, 7); x.fill();
    // a mug
    const body = x.createLinearGradient(520, 0, 1020, 0); body.addColorStop(0, '#B8300F'); body.addColorStop(.45, '#F05A33'); body.addColorStop(1, '#9E2A0D');
    x.fillStyle = body; x.beginPath(); x.moveTo(540, 330); x.lineTo(1000, 330); x.lineTo(970, 860); x.quadraticCurveTo(770, 900, 570, 860); x.closePath(); x.fill();
    x.lineWidth = 46; x.strokeStyle = '#C93A16'; x.beginPath(); x.ellipse(1060, 560, 110, 150, 0, -1.3, 1.3); x.stroke();
    x.fillStyle = '#3B1A0C'; x.beginPath(); x.ellipse(770, 332, 230, 40, 0, 0, 7); x.fill();
    x.fillStyle = 'rgba(255,255,255,.22)'; x.fillRect(610, 380, 38, 420);
    x.fillStyle = '#F6F2EA'; x.font = 'bold 64px "Instrument Sans", sans-serif'; x.textAlign = 'center'; x.fillText('AIVORYX', 770, 620);
    const type = mode === 'cwebp' || mode === 'webp2png' ? 'image/webp' : mode === 'cjpg' ? 'image/jpeg' : 'image/png';
    const blob = await canvasToBlob(c, type, .95);
    if (type === 'image/webp' && blob.type !== 'image/webp') { toast('This browser cannot make a WebP sample', 'err'); return; }
    load(new File([blob], 'sample-mug.' + EXT[type], { type }));
  }

  setMode('cjpg');
  return () => { seq++; clearTimeout(timer); urls.forEach(u => URL.revokeObjectURL(u)); };
}
