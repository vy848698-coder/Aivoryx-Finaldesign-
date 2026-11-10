/* AIVORYX · tools — the workspace shell.
   One registry, one selector, one stage. Each tool lives in its own module
   and is only downloaded the first time someone opens it. */
import { h, $, $$ } from './lib.js';

const I = {
  share: '<path d="M12 15V3.5M7.8 7.7 12 3.5l4.2 4.2"/><path d="M4.5 13.5v5.6c0 .8.6 1.4 1.4 1.4h12.2c.8 0 1.4-.6 1.4-1.4v-5.6"/>',
  secret: '<circle cx="12" cy="13.5" r="7.2"/><path d="M12 9.8v3.9l2.6 2.1M9.4 2.6h5.2"/>',
  vault: '<path d="M12 21.2s7.4-3.7 7.4-9.3V5.4L12 2.7 4.6 5.4v6.5c0 5.6 7.4 9.3 7.4 9.3z"/><path d="M9.3 11.8l1.9 1.9 3.5-3.8"/>',
  json: '<path d="M8.5 4.5c-2 0-2.6 1-2.6 2.6v2.3c0 1.3-.7 2.1-2 2.6 1.3.5 2 1.3 2 2.6v2.3c0 1.6.6 2.6 2.6 2.6M15.5 4.5c2 0 2.6 1 2.6 2.6v2.3c0 1.3.7 2.1 2 2.6-1.3.5-2 1.3-2 2.6v2.3c0 1.6-.6 2.6-2.6 2.6"/>',
  id: '<rect x="2.8" y="5" width="18.4" height="14" rx="2"/><circle cx="8.4" cy="11" r="2"/><path d="M5.3 16c.6-1.5 1.7-2.2 3.1-2.2s2.5.7 3.1 2.2M14 10h4.3M14 13.5h3"/>',
  gst: '<path d="M14 2.8H6.6c-.8 0-1.4.6-1.4 1.4v15.6c0 .8.6 1.4 1.4 1.4h10.8c.8 0 1.4-.6 1.4-1.4V7.6z"/><path d="M14 2.8v4.8h4.8M8.6 12.6h6.8M8.6 16.4h4.4"/>',
  pdf: '<path d="M16.4 2.8H9.6c-.9 0-1.6.7-1.6 1.6v10.6c0 .9.7 1.6 1.6 1.6h6.8c.9 0 1.6-.7 1.6-1.6V4.4c0-.9-.7-1.6-1.6-1.6z"/><path d="M5 7.4v12.2c0 .9.7 1.6 1.6 1.6h8.2"/>',
  image: '<rect x="3.2" y="4.6" width="17.6" height="14.8" rx="2"/><circle cx="8.9" cy="10" r="1.5"/><path d="m20.8 15.6-4.8-4.6-6.6 6.4"/>'
};
export const icon = (k, s = 18) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[k]}</svg>`;

/* Access facts come from the live apps' own code — keep them in sync here. */
const TOOLS = [
  { id: 'fileshare', n: '01', cat: 'security', name: 'Secure File Sharing', icon: 'share',
    url: 'https://fileshare.aivoryx.com/', cta: 'Share a real file', access: 'No sign-up', open: true,
    mode: 'sample', privacy: 'Simulated · your file never leaves this tab',
    keys: 'upload send link expiry password pdf transfer',
    can: ['Pick or drop a PDF and check it against the live app\'s rules', 'Set expiry, a download limit and a password', 'Watch the link refuse the download after its limit'],
    limits: ['No upload happens — the link is a demo string and opens nothing', 'Real files are stored by fileshare.aivoryx.com, up to 100 MB'] },
  { id: 'secret', n: '02', cat: 'security', name: 'Self-destructing Secrets', icon: 'secret',
    url: 'https://secret.aivoryx.com/', cta: 'Create a real one-time secret', access: 'No sign-up', open: true,
    mode: 'sample', privacy: 'Encrypted in this tab · held in memory only',
    keys: 'password api key one-time link burn self destruct',
    can: ['Encrypt a secret with real AES-256-GCM in your browser', 'Open it once as the recipient would', 'See the key and ciphertext destroyed after the view'],
    limits: ['Nothing is sent or stored — reload and it is gone', 'Real secrets are encrypted and deleted by secret.aivoryx.com'] },
  { id: 'vault', n: '03', cat: 'security', name: 'AI-protected Vault', icon: 'vault',
    url: 'https://vault.aivoryx.com/', cta: 'Open your secure vault', access: 'Account', open: false,
    mode: 'sample', privacy: 'Fictional entries · not connected to any vault',
    keys: 'password manager reused weak breach strength',
    can: ['Search a sample vault and reveal its fictional passwords', 'Real strength scoring and reuse detection on the entries', 'Rotate weak passwords with a cryptographic generator'],
    limits: ['Breach flags here are illustrative, not a real breach lookup', 'Your own vault needs an account and your master password'] },
  { id: 'json', n: '04', cat: 'developer', name: 'JSON Beautifier & Toolkit', icon: 'json',
    url: 'https://jsonbeautifier.aivoryx.com/', cta: 'Open full JSON Toolkit', access: 'No sign-up', open: true,
    mode: 'local', privacy: 'Runs in your browser · nothing is sent',
    keys: 'format beautify minify validate tree diff csv xml developer',
    can: ['Beautify, minify and validate with line and column', 'Browse a collapsible tree, diff two payloads', 'Convert to CSV or XML, upload and download files'],
    limits: ['Files over 5 MB are refused in the preview', 'The full app adds a Monaco editor, search and sort keys'] },
  { id: 'nric', n: '05', cat: 'developer', name: 'Singapore NRIC & FIN Generator', icon: 'id',
    url: 'https://nric-generator.aivoryx.com/', cta: 'Generate test datasets', access: 'No sign-up', open: true,
    mode: 'local', privacy: 'Synthetic values · generated in your browser',
    keys: 'singapore nric fin test data qa checksum validator',
    can: ['Generate one or up to 250 checksum-valid test IDs', 'Validate any value and see the check letter worked out', 'Export as text, CSV, JSON, SQL, TypeScript or Python'],
    limits: ['M-series values are format-only — the official rule is not public', 'Same algorithm as the full app, without saved preferences'] },
  { id: 'gst', n: '06', cat: 'productivity', name: 'AI GST Notice Reply Generator', icon: 'gst',
    url: 'https://gstreply.aivoryx.com/', cta: 'Analyse a real GST notice', access: 'Sign-in · credits', open: false,
    mode: 'sample', privacy: 'Fictional notices · no AI runs in this preview',
    keys: 'gst india notice reply asmt drc reg tax ai draft',
    can: ['Read three fictional notices: ASMT-10, DRC-01 and REG-03', 'See the shape of a summary, issues and cited sections', 'Preview how a drafted reply is laid out'],
    limits: ['The analysis here is written in advance, not generated', 'Real notices are read by the AI in the full app — summary free, full draft 1 credit'] },
  { id: 'pdf', n: '07', cat: 'productivity', name: 'PDF Toolkit', icon: 'pdf',
    url: 'https://pdf-tools.aivoryx.com/', cta: 'Open full PDF Toolkit', access: 'No sign-up', open: true,
    mode: 'local', privacy: 'Runs in your browser · files are never uploaded',
    keys: 'merge split rotate watermark unlock jpg compress 100kb 1mb email',
    can: ['Merge, split, rotate, watermark and unlock real PDFs', 'Turn JPG and PNG images into a PDF', 'Compress, or compress to 100 KB, 1 MB or 5 MB for email'],
    limits: ['Compression here redraws pages as images — text stops being selectable', 'Files over 50 MB are refused in the preview'] },
  { id: 'image', n: '08', cat: 'productivity', name: 'Image Toolkit', icon: 'image',
    url: 'https://image-tools.aivoryx.com/', cta: 'Open full Image Toolkit', access: 'No sign-up', open: true,
    mode: 'local', privacy: 'Runs in your browser · images are never uploaded',
    keys: 'compress resize convert heic jpg png webp background remove',
    can: ['Compress JPG, PNG or WebP with a quality slider', 'Resize, convert HEIC, PNG and WebP', 'Remove a background with the same on-device model as the full app'],
    limits: ['Background removal downloads a 4.4 MB model the first time', 'Images over 25 MB are refused in the preview'] }
];
const CATS = { security: 'Security', developer: 'Developer', productivity: 'Productivity' };
const MODE = {
  sample: { label: 'Sample mode', tip: 'Fictional data, clearly simulated steps' },
  local: { label: 'Live in your browser', tip: 'Real processing on your device' }
};

const loaders = {
  fileshare: () => import('./t-fileshare.js'),
  secret: () => import('./t-secret.js'),
  vault: () => import('./t-vault.js'),
  json: () => import('./t-json.js'),
  nric: () => import('./t-nric.js'),
  gst: () => import('./t-gst.js'),
  pdf: () => import('./t-pdf.js'),
  image: () => import('./t-image.js')
};

const ws = $('#ws');
if (ws) boot();

function boot() {
  const list = $('#ws-list'), search = $('#ws-search'), stage = $('#ws-stage'), out = $('#ws-out-body');
  const top = { n: $('#ws-n'), name: $('#ws-name'), mode: $('#ws-mode'), privacy: $('#ws-privacy'), open: $('#ws-open'), status: $('#ws-status') };
  const foot = { can: $('#ws-can'), lim: $('#ws-lim'), cta: $('#ws-cta'), ctaName: $('#ws-cta-name') };
  let filter = 'all', current = null, cleanup = null, seq = 0;

  /* ---- build the selector ---- */
  const items = new Map();
  Object.keys(CATS).forEach(cat => {
    const g = h('li.ws-group', { 'data-cat': cat, role: 'presentation' }, h('span.ws-cat', { 'aria-hidden': 'true' }, CATS[cat]));
    list.append(g);
    TOOLS.filter(t => t.cat === cat).forEach(t => {
      const b = h('button.ws-item', {
        type: 'button', role: 'tab', id: 'tab-' + t.id, 'aria-selected': 'false', 'aria-controls': 'ws-panel', tabindex: -1,
        'data-id': t.id, onclick: () => select(t.id, true)
      },
        h('i.ws-num', t.n),
        h('span.ws-ic', { html: icon(t.icon) }),
        h('span.ws-label', h('b', t.name), h('em', CATS[t.cat] + ' · ' + (t.mode === 'local' ? 'runs locally' : 'sample'))),
        h('span.ws-acc' + (t.open ? '' : '.lock'), { title: t.access }, t.access)
      );
      items.set(t.id, b);
      list.append(h('li', { role: 'presentation', 'data-cat': cat }, b));
    });
  });

  /* ---- search + category filter ---- */
  const empty = $('#ws-empty');
  function applyFilter() {
    const q = search.value.trim().toLowerCase();
    let shown = 0;
    TOOLS.forEach(t => {
      const hit = (filter === 'all' || t.cat === filter) &&
        (!q || (t.name + ' ' + t.keys + ' ' + CATS[t.cat] + ' ' + t.n).toLowerCase().includes(q));
      items.get(t.id).parentElement.hidden = !hit;
      if (hit) shown++;
    });
    $$('.ws-group', list).forEach(g => {
      g.hidden = !TOOLS.some(t => t.cat === g.dataset.cat && !items.get(t.id).parentElement.hidden);
    });
    empty.hidden = shown > 0;
    $('#ws-count').textContent = String(shown).padStart(2, '0');
    rovingFix();
  }
  search.addEventListener('input', applyFilter);
  search.addEventListener('keydown', e => {
    if (e.key === 'Enter') { const first = visible()[0]; if (first) { select(first.dataset.id, true); first.focus(); } }
    if (e.key === 'ArrowDown') { e.preventDefault(); visible()[0]?.focus(); }
  });
  $$('#ws-filters button').forEach(b => b.addEventListener('click', () => {
    filter = b.dataset.f;
    $$('#ws-filters button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    applyFilter();
  }));

  /* ---- keyboard: arrows move between visible tools, Enter/Space opens ---- */
  const visible = () => [...items.values()].filter(b => !b.parentElement.hidden);
  function rovingFix() {
    const v = visible();
    const active = v.find(b => b.dataset.id === current) || v[0];
    items.forEach(b => { b.tabIndex = b === active ? 0 : -1; });
  }
  list.addEventListener('keydown', e => {
    const v = visible(); const i = v.indexOf(document.activeElement);
    if (i < 0) return;
    const horiz = getComputedStyle(list).flexDirection === 'row';
    const next = horiz ? 'ArrowRight' : 'ArrowDown', prev = horiz ? 'ArrowLeft' : 'ArrowUp';
    let n = null;
    if (e.key === next) n = (i + 1) % v.length;
    else if (e.key === prev) n = (i - 1 + v.length) % v.length;
    else if (e.key === 'Home') n = 0;
    else if (e.key === 'End') n = v.length - 1;
    if (n == null) return;
    e.preventDefault();
    v.forEach(b => { b.tabIndex = -1; });
    v[n].tabIndex = 0; v[n].focus();
    select(v[n].dataset.id, true); // automatic activation — switching is instant and cheap
  });

  /* ---- open a tool ---- */
  async function select(id, user) {
    const t = TOOLS.find(x => x.id === id);
    if (!t || id === current) return;
    current = id;
    const my = ++seq;
    items.forEach((b, k) => { b.setAttribute('aria-selected', String(k === id)); });
    rovingFix();
    const btn = items.get(id);
    if (user && btn.scrollIntoView && getComputedStyle(list).flexDirection === 'row') btn.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });

    ws.dataset.current = id;
    ws.dataset.mode = t.mode;
    $('#ws-panel').setAttribute('aria-labelledby', 'tab-' + id);
    top.n.textContent = t.n;
    top.name.textContent = t.name;
    top.mode.textContent = MODE[t.mode].label;
    top.mode.title = MODE[t.mode].tip;
    top.mode.className = 'ws-mode ' + t.mode;
    top.privacy.textContent = t.privacy;
    [top.open, foot.cta].forEach(a => { a.href = t.url; });
    top.open.setAttribute('aria-label', 'Open full ' + t.name + ' in a new tab');
    foot.ctaName.textContent = t.cta;
    foot.can.replaceChildren(...t.can.map(s => h('li', s)));
    foot.lim.replaceChildren(...t.limits.map(s => h('li', s)));
    setStatus('loading', 'Loading');
    if (user) history.replaceState(null, '', '#tool-' + id);

    if (cleanup) { try { cleanup(); } catch { /* a tool failing to clean up must not block the next one */ } cleanup = null; }
    ws.classList.add('switching');
    const minDelay = new Promise(r => setTimeout(r, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 160));
    let mod;
    try { [mod] = await Promise.all([loaders[id](), minDelay]); }
    catch (err) {
      if (my !== seq) return;
      stage.replaceChildren(h('div.tw-state.err', h('span.tw-state-ic'), h('b', 'This preview could not load'), h('p', 'Check your connection and pick the tool again — or open the full tool, it works on its own.')));
      out.replaceChildren();
      ws.classList.remove('switching');
      setStatus('error', 'Failed to load');
      return;
    }
    if (my !== seq) return; // the visitor already moved on
    stage.replaceChildren(); out.replaceChildren();
    stage.className = 'ws-stage t-' + id;
    out.parentElement.className = 'ws-out o-' + id;
    cleanup = mod.mount({ stage, out, tool: t, setStatus }) || null;
    setStatus('ready', 'Ready');
    requestAnimationFrame(() => ws.classList.remove('switching'));
  }

  function setStatus(kind, text) {
    top.status.dataset.s = kind;
    top.status.lastChild.textContent = text;
  }

  /* ---- collapsible output panel (tablet / phone) ---- */
  const outToggle = $('#ws-out-toggle');
  outToggle.addEventListener('click', () => {
    const open = outToggle.getAttribute('aria-expanded') !== 'true';
    outToggle.setAttribute('aria-expanded', String(open));
    ws.classList.toggle('out-closed', !open);
  });

  /* ---- deep links: #tool-json, and any link with data-tool ---- */
  function fromHash() {
    const m = location.hash.match(/^#tool-([a-z]+)/);
    return m && loaders[m[1]] ? m[1] : null;
  }
  addEventListener('hashchange', () => { const id = fromHash(); if (id) select(id, false); });
  document.addEventListener('click', e => {
    const a = e.target.closest('a[data-tool]');
    if (!a || !loaders[a.dataset.tool]) return;
    e.preventDefault();
    select(a.dataset.tool, true);
    $('#tools').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  });

  applyFilter();
  select(fromHash() || 'json', false);
}
