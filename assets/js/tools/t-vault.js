/* 03 · Vault — a sample vault of fictional entries.
   Strength scoring is the live app's own rule; reuse detection is computed on the
   entries; breach flags are ILLUSTRATIVE (no breach lookup runs here). */
import { h, copy, state, tag } from './lib.js';

/* vault.aivoryx.com's measureStrength, unchanged */
export function strength(t) {
  if (!t) return { score: 0, label: 'weak' };
  let n = 0;
  if (t.length >= 8) n++;
  if (t.length >= 14) n++;
  if (/[A-Z]/.test(t)) n++;
  if (/[0-9]/.test(t)) n++;
  if (/[^A-Za-z0-9]/.test(t)) n++;
  return { score: n, label: ['weak', 'weak', 'fair', 'good', 'strong'][Math.min(n, 4)] };
}
function generate(len = 20) {
  const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '!@#$%^&*-_=+?'];
  const all = sets.join('');
  const r = n => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; };
  const chars = sets.map(s => s[r(s.length)]);
  while (chars.length < len) chars.push(all[r(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) { const j = r(i + 1); [chars[i], chars[j]] = [chars[j], chars[i]]; }
  return chars.join('');
}

const SEED = [
  { site: 'Mailbox', host: 'mail.example.com', user: 'priya@example.com', pw: 'Summer2024', breach: true },
  { site: 'Cloud storage', host: 'drive.example.net', user: 'priya.s', pw: 'Summer2024', breach: false },
  { site: 'Bank (fictional)', host: 'netbank.example.org', user: 'PS-88213', pw: 'q7#Lm!vR2x@Tz9Kp', breach: false },
  { site: 'Shop', host: 'shop.example.com', user: 'priya@example.com', pw: 'priya123', breach: true },
  { site: 'Code host', host: 'git.example.dev', user: 'priyas', pw: 'Tr4il-Mango-Kite-07', breach: false },
  { site: 'Wi-Fi router', host: '192.168.0.1', user: 'admin', pw: 'admin', breach: false }
];

export function mount({ stage, out, setStatus }) {
  const entries = SEED.map((e, i) => ({ ...e, id: i, shown: false }));
  let q = '', view = 'all';

  const search = h('input.tw-input.vt-search', { type: 'search', placeholder: 'Search sample entries', 'aria-label': 'Search vault entries' });
  search.addEventListener('input', () => { q = search.value.trim().toLowerCase(); draw(); });
  const filters = h('div.vt-filters', { role: 'group', 'aria-label': 'Show' });
  const listEl = h('ul.vt-list', { 'aria-label': 'Sample vault entries' });
  const summary = h('div.vt-sum');

  stage.append(
    h('div.vt-acct', h('span.vt-lock', { 'aria-hidden': 'true' }), h('div', h('b', 'Account required for a real vault'), h('span', 'This is a fictional sample. Your own vault is unlocked with your master password and encrypted on your device before it is stored.'))),
    summary,
    h('div.vt-bar', search, filters),
    listEl
  );

  function reusedSet() {
    const c = {};
    entries.forEach(e => { c[e.pw] = (c[e.pw] || 0) + 1; });
    return c;
  }
  function flags(e, reuse) {
    const s = strength(e.pw);
    return { s, weak: s.score <= 2, reused: reuse[e.pw] > 1, breach: e.breach };
  }

  function draw() {
    const reuse = reusedSet();
    const all = entries.map(e => ({ e, f: flags(e, reuse) }));
    const n = { all: all.length, weak: all.filter(x => x.f.weak).length, reused: all.filter(x => x.f.reused).length, breach: all.filter(x => x.f.breach).length };
    const healthy = all.filter(x => !x.f.weak && !x.f.reused && !x.f.breach).length;
    const score = Math.round(healthy / all.length * 100);

    summary.replaceChildren(
      h('div.vt-score', h('b', score), h('span', 'Health score'), h('i', { style: { '--p': score + '%' } })),
      ...[['weak', 'Weak'], ['reused', 'Reused'], ['breach', 'Breach flag*']].map(([k, l]) =>
        h('div.vt-n' + (n[k] ? '.bad' : ''), h('b', n[k]), h('span', l))));

    filters.replaceChildren(...[['all', 'All'], ['weak', 'Weak'], ['reused', 'Reused'], ['breach', 'Flagged']].map(([k, l]) =>
      h('button.tw-chip', { type: 'button', 'aria-pressed': String(view === k), onclick: () => { view = k; draw(); } }, `${l} ${n[k]}`)));

    const rows = all.filter(({ e, f }) => (view === 'all' || f[view]) && (!q || (e.site + ' ' + e.host + ' ' + e.user).toLowerCase().includes(q)));
    listEl.replaceChildren(...rows.map(({ e, f }) => {
      const pwEl = h('code.vt-pw', e.shown ? e.pw : '•'.repeat(Math.min(14, e.pw.length)));
      return h('li.vt-row',
        h('span.vt-fav', { 'aria-hidden': 'true' }, e.site[0]),
        h('div.vt-main', h('b', e.site), h('span', e.user + ' · ' + e.host)),
        h('div.vt-pwc', pwEl,
          h('button.tw-icon', { type: 'button', 'aria-label': (e.shown ? 'Hide' : 'Show') + ' password for ' + e.site, 'aria-pressed': String(e.shown), onclick: () => { e.shown = !e.shown; draw(); } }, e.shown ? 'Hide' : 'Show'),
          h('button.tw-icon', { type: 'button', 'aria-label': 'Copy password for ' + e.site, onclick: () => copy(e.pw, 'Sample password copied') }, 'Copy')),
        h('div.vt-str.s' + f.s.label, { title: 'Strength: ' + f.s.label }, h('i', { style: { '--w': (f.s.score / 5 * 100) + '%' } }), h('span', f.s.label)),
        h('div.vt-flags',
          f.weak ? tag('Weak', 'bad') : null,
          f.reused ? tag('Reused ×' + reuse[e.pw], 'bad') : null,
          f.breach ? tag('Breach · sample', 'warn') : null,
          !f.weak && !f.reused && !f.breach ? tag('Healthy', 'ok') : null),
        (f.weak || f.reused || f.breach) ? h('button.tw-chip.vt-fix', { type: 'button', onclick: () => { e.pw = generate(); e.breach = false; e.shown = true; draw(); setStatus('done', e.site + ' rotated'); } }, 'Rotate') : h('span.vt-fix')
      );
    }));
    if (!rows.length) listEl.append(h('li.vt-none', 'No sample entries match.'));
    setStatus('ready', `${n.weak + n.reused + n.breach ? 'Issues found' : 'All healthy'}`);
  }

  /* ---- right panel: strength checker ---- */
  const pw = h('input.tw-input', { type: 'password', autocomplete: 'off', placeholder: 'Type any password', 'aria-label': 'Password to check' });
  const showPw = h('button.tw-chip', { type: 'button', 'aria-pressed': 'false', onclick: () => { const s = pw.type === 'password'; pw.type = s ? 'text' : 'password'; showPw.setAttribute('aria-pressed', String(s)); showPw.textContent = s ? 'Hide' : 'Show'; } }, 'Show');
  const meter = h('div.vt-meter', h('i'));
  const label = h('b.vt-label', '—');
  const checks = h('ul.vt-checks');
  const crack = h('p.tw-hint');
  pw.addEventListener('input', check);
  function check() {
    const v = pw.value;
    const s = strength(v);
    meter.className = 'vt-meter s' + (v ? s.label : '');
    meter.firstChild.style.width = (v ? s.score / 5 * 100 : 0) + '%';
    label.textContent = v ? s.label[0].toUpperCase() + s.label.slice(1) + ` · ${s.score}/5` : '—';
    const rules = [[v.length >= 8, 'At least 8 characters'], [v.length >= 14, '14 or more characters'], [/[A-Z]/.test(v), 'An uppercase letter'], [/[0-9]/.test(v), 'A number'], [/[^A-Za-z0-9]/.test(v), 'A symbol']];
    checks.replaceChildren(...rules.map(([ok, t]) => h('li' + (ok ? '.ok' : ''), t)));
    const pool = (/[a-z]/.test(v) ? 26 : 0) + (/[A-Z]/.test(v) ? 26 : 0) + (/[0-9]/.test(v) ? 10 : 0) + (/[^A-Za-z0-9]/.test(v) ? 33 : 0);
    const bits = v ? Math.round(v.length * Math.log2(Math.max(pool, 1))) : 0;
    crack.textContent = v ? `≈ ${bits} bits of entropy by character pool — a rough guide; a real attack also tries words and patterns.` : 'Checked in this tab. Nothing is stored or sent.';
    if (entries.some(e => e.pw === v)) crack.textContent += ' This one is already in the sample vault.';
  }
  out.append(
    h('section.tw-block', h('h4.tw-k', 'Password strength checker'), h('div.tw-row.vt-in', pw, showPw), meter, label, checks, crack,
      h('button.tw-chip', { type: 'button', onclick: () => { pw.value = generate(); pw.type = 'text'; showPw.textContent = 'Hide'; showPw.setAttribute('aria-pressed', 'true'); check(); } }, 'Generate a strong one')),
    h('section.tw-block', h('h4.tw-k', 'How a real vault is protected'),
      h('ul.vt-facts',
        h('li', h('b', 'AES-256-GCM'), ' encryption of your vault data'),
        h('li', h('b', 'PBKDF2'), ' turns your master password into the key'),
        h('li', h('b', 'Zero-knowledge'), ' — we store ciphertext we cannot decrypt'),
        h('li', h('b', 'Under 12 characters'), ' — a master password that short is flagged as weak'))),
    h('p.tw-hint.vt-foot', '* Breach flags in this sample are illustrative and fictional. No breach database was queried.')
  );

  draw(); check();
}
