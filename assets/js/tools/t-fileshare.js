/* 01 · Secure file sharing — a simulation of fileshare.aivoryx.com's flow.
   Your file is only measured (name, size, type). It is never read, uploaded or stored.
   The rules match the live app: PDF only, up to 100 MB, expiry 1/7/30 days or never,
   optional download limit (1–10,000), optional password (bcrypt-hashed there). */
import { h, bytes, copy, dropZone, field, state, tag, busy, sleep, reduceMotion } from './lib.js';

const MAX = 100 * 1024 * 1024;
const EXPIRY = [['1', '1 day'], ['7', '7 days'], ['30', '30 days'], ['0', 'Never']];
const SAMPLE = { name: 'Q3-board-pack-SAMPLE.pdf', size: 2_431_118, type: 'application/pdf', sample: true };

export function mount({ stage, out, setStatus }) {
  let file = null, link = null, cancelled = false;

  const err = h('p.tw-err', { role: 'alert', hidden: true });
  const chosen = h('div.fs-file', { hidden: true });
  const zone = dropZone({ accept: '.pdf,application/pdf', label: 'Drop a PDF here or browse', hint: 'PDF only · up to 100 MB · same rules as the live app', onFiles: f => choose(f[0]) });

  const exp = h('select.tw-select', ...EXPIRY.map(([v, l]) => h('option', { value: v, selected: v === '7' }, l)));
  const maxDl = h('input.tw-input', { type: 'number', min: 1, max: 10000, placeholder: 'Unlimited', inputmode: 'numeric' });
  const pw = h('input.tw-input', { type: 'password', placeholder: 'Leave blank for no password', autocomplete: 'new-password' });
  const go = h('button.tw-btn', { type: 'button', disabled: true, onclick: share }, 'Prepare demo share link');

  stage.append(
    h('div.fs-drop', zone, h('button.tw-chip', { type: 'button', onclick: () => choose(SAMPLE) }, 'Use a sample file')),
    chosen, err,
    h('div.fs-opts',
      field('Expires after', exp),
      field('Max downloads', maxDl, 'Blank = unlimited'),
      field('Password (optional)', pw, 'Never leaves this tab')),
    go,
    h('p.fs-note', tag('Sample mode'), ' Nothing is uploaded. The live app stores real files on our server and enforces these rules there.')
  );
  out.append(state('empty', 'No link yet', 'Choose a file and set the rules. The link, its rules and a recipient\'s view appear here.'));

  function choose(f) {
    err.hidden = true;
    const isPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
    if (!isPdf) return fail(`"${f.name}" is not a PDF. The live app accepts PDF files only.`);
    if (f.size > MAX) return fail(`${bytes(f.size)} is over the 100 MB limit.`);
    if (f.size === 0) return fail('That file is empty.');
    file = f;
    chosen.hidden = false;
    chosen.replaceChildren(
      h('span.fs-ic', { 'aria-hidden': 'true' }, 'PDF'),
      h('div', h('b', f.name), h('span', bytes(f.size) + (f.sample ? ' · fictional sample' : ' · measured locally, not read'))),
      h('button.tw-x', { type: 'button', 'aria-label': 'Remove file', onclick: () => { file = null; chosen.hidden = true; go.disabled = true; } }, '×'));
    go.disabled = false;
    setStatus('ready', 'File checked');
  }
  function fail(msg) { file = null; chosen.hidden = true; go.disabled = true; err.textContent = msg; err.hidden = false; setStatus('error', 'Rejected'); }

  async function share() {
    if (!file) return;
    const lim = maxDl.value.trim() === '' ? null : Math.round(+maxDl.value);
    if (lim !== null && (!Number.isFinite(lim) || lim < 1 || lim > 10000)) { err.textContent = 'Max downloads must be between 1 and 10,000, or blank.'; err.hidden = false; return; }
    err.hidden = true; go.disabled = true; cancelled = false;
    const b = busy('Simulating upload — nothing leaves your browser');
    const bar = h('div.tw-bar', h('i'));
    out.replaceChildren(h('section.tw-block', h('h4.tw-k', 'Preparing'), b, bar));
    setStatus('working', 'Simulating');
    const steps = reduceMotion() ? 4 : 24;
    for (let i = 1; i <= steps && !cancelled; i++) { bar.firstChild.style.width = (i / steps * 100) + '%'; await sleep(reduceMotion() ? 40 : 45); }
    if (cancelled) return;
    go.disabled = false;

    const days = +exp.value;
    const expires = days ? new Date(Date.now() + days * 864e5) : null;
    const token = [...crypto.getRandomValues(new Uint8Array(10))].map(x => x.toString(16).padStart(2, '0')).join('');
    link = { url: `fileshare.aivoryx.com/download.php?t=DEMO-${token}`, limit: lim, used: 0, expires, password: pw.value, name: file.name, size: file.size };
    pw.value = '';
    render();
    setStatus('done', 'Demo link ready');
  }

  function render() {
    const L = link;
    const left = L.limit === null ? '∞' : Math.max(0, L.limit - L.used);
    const dead = L.limit !== null && L.used >= L.limit;
    const pwIn = h('input.tw-input', { type: 'password', placeholder: 'Password', 'aria-label': 'Recipient password', autocomplete: 'off' });
    const msg = h('p.tw-hint', { 'aria-live': 'polite' });
    const dl = h('button.tw-btn', { type: 'button', disabled: dead, onclick: () => {
      if (L.password && pwIn.value !== L.password) { msg.textContent = 'Wrong password — the live app checks it against a bcrypt hash.'; msg.className = 'tw-err'; return; }
      L.used++; render();
      const m = out.querySelector('.fs-recip .tw-hint');
      if (m) { m.className = 'tw-hint ok'; m.textContent = `Download ${L.used} counted. ${L.limit === null ? 'No limit set.' : L.limit - L.used > 0 ? (L.limit - L.used) + ' left.' : 'That was the last one.'}`; }
    } }, dead ? 'Link no longer available' : 'Download (simulated)');

    out.replaceChildren(
      h('section.tw-block', h('div.tw-ohead', h('h4.tw-k', 'Share link'), tag('Demo only', 'warn')),
        h('div.tw-link', h('code', L.url), h('button.tw-chip', { type: 'button', onclick: () => copy(L.url + '  (demo — opens nothing)', 'Demo link copied') }, 'Copy')),
        h('p.tw-hint', 'Not a real link. Your file was not uploaded.')),
      h('section.tw-block', h('h4.tw-k', 'Rules on this link'),
        h('dl.tw-stats',
          h('div', h('dt', 'File'), h('dd', bytes(L.size))),
          h('div', h('dt', 'Expires'), h('dd', L.expires ? L.expires.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Never')),
          h('div', h('dt', 'Downloads'), h('dd', L.limit === null ? `${L.used} · unlimited` : `${L.used} / ${L.limit}`)),
          h('div', h('dt', 'Password'), h('dd', L.password ? 'Required' : 'None')))),
      h('section.tw-block.fs-recip' + (dead ? '.dead' : ''), h('h4.tw-k', 'What the recipient sees'),
        dead ? state('gone', 'This link has expired', 'The download limit was reached. The live app refuses the file from here on.')
          : h('div.fs-card',
            h('div.fs-card-f', h('span.fs-ic', 'PDF'), h('div', h('b', L.name), h('span', bytes(L.size) + ' · ' + left + ' downloads left'))),
            L.password ? pwIn : null, dl, msg))
    );
  }

  return () => { cancelled = true; link = null; };
}
