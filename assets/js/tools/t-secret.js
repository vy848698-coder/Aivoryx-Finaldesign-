/* 02 · Self-destructing secrets — a local, honest rehearsal.
   The secret is really encrypted (AES-256-GCM, WebCrypto) but only in this tab's
   memory. Nothing is sent anywhere. One view, then key and ciphertext are wiped. */
import { h, copy, seg, state, tag, sleep } from './lib.js';

const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const SAMPLE = 'sk_demo_4f9a2c7e1b8d6a3f0e5c2b9a7d4e1f8c — fictional API key';

export function mount({ stage, out, setStatus }) {
  let vault = null; // { key, iv, ct, views, max, expires }
  let ttl = '24h';
  let timer = 0;

  const input = h('textarea.tw-input.sc-in', { rows: 4, maxlength: 2000, spellcheck: false, autocomplete: 'off', placeholder: 'Paste a password, API key or note…', 'aria-label': 'Secret to share' });
  input.style.webkitTextSecurity = 'disc';
  let shown = false;
  const eye = h('button.tw-chip.sc-eye', { type: 'button', 'aria-pressed': 'false', onclick: () => {
    shown = !shown; input.style.webkitTextSecurity = shown ? 'none' : 'disc'; input.classList.toggle('masked', !shown);
    eye.setAttribute('aria-pressed', String(shown)); eye.textContent = shown ? 'Hide' : 'Show';
  } }, 'Show');
  input.classList.add('masked');
  const counter = h('span.tw-hint', '0 / 2000');
  input.addEventListener('input', () => { counter.textContent = input.value.length + ' / 2000'; err.hidden = true; });

  const ttlSeg = seg('Expires after', [['1h', '1 hour'], ['24h', '24 hours'], ['7d', '7 days']], ttl, v => { ttl = v; });
  const err = h('p.tw-err', { role: 'alert', hidden: true });
  const go = h('button.tw-btn', { type: 'button', onclick: create }, 'Encrypt & create demo link');

  stage.append(
    h('div.sc-head', h('span.tw-k', 'Your secret'), h('div.tw-row', h('button.tw-chip', { type: 'button', onclick: () => { input.value = SAMPLE; input.dispatchEvent(new Event('input')); } }, 'Use sample'), eye)),
    input, counter,
    h('div.sc-opts', h('div', h('span.tw-k', 'Expires after'), ttlSeg), h('div', h('span.tw-k', 'Views allowed'), h('p.sc-one', h('b', '1'), ' — burns after reading'))),
    err, go,
    h('ol.sc-flow', { 'aria-label': 'What happens' },
      h('li', { 'data-s': 'enc' }, h('i', '1'), 'Encrypt'),
      h('li', { 'data-s': 'link' }, h('i', '2'), 'Share link'),
      h('li', { 'data-s': 'view' }, h('i', '3'), 'Viewed once'),
      h('li', { 'data-s': 'gone' }, h('i', '4'), 'Destroyed'))
  );
  const flow = stage.querySelector('.sc-flow');
  const step = s => flow.dataset.at = s;

  out.append(state('empty', 'No secret yet', 'Write one on the left. You will see the ciphertext, the demo link and the recipient\'s single view here.'));

  async function create() {
    const text = input.value;
    if (!text.trim()) { err.textContent = 'Write something to protect first.'; err.hidden = false; input.focus(); return; }
    if (!crypto?.subtle) { err.textContent = 'This browser has no WebCrypto here (it needs https). Try the full app.'; err.hidden = false; return; }
    go.disabled = true; setStatus('working', 'Encrypting');
    // non-extractable: even this page's own code cannot read the key bytes back
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text));
    const ms = { '1h': 36e5, '24h': 864e5, '7d': 6048e5 }[ttl];
    vault = { key, iv, ct, views: 0, max: 1, expires: Date.now() + ms };
    input.value = ''; counter.textContent = '0 / 2000';
    const id = hex(crypto.getRandomValues(new Uint8Array(8)));
    const link = `secret.aivoryx.com/s/DEMO-${id}`;
    step('link'); go.disabled = false;
    setStatus('done', 'Encrypted locally');

    const payload = b64(new Uint8Array([...iv, ...new Uint8Array(ct)]));
    const view = h('button.tw-btn', { type: 'button', onclick: reveal }, 'Open as recipient');
    const viewBox = h('div.sc-view', { 'aria-live': 'polite' }, h('p', 'The recipient sees a single button. Opening it uses the only view.'), view);
    const left = h('span.sc-ttl');
    const tick = () => {
      if (!vault) return;
      const s = Math.max(0, vault.expires - Date.now());
      const hh = Math.floor(s / 36e5), mm = Math.floor(s % 36e5 / 6e4), ss = Math.floor(s % 6e4 / 1e3);
      left.textContent = `${hh}h ${String(mm).padStart(2, '0')}m ${String(ss).padStart(2, '0')}s left`;
    };
    clearInterval(timer); timer = setInterval(tick, 1000); tick();

    out.replaceChildren(
      h('section.tw-block', h('div.tw-ohead', h('h4.tw-k', 'Share link'), tag('Demo only', 'warn')),
        h('div.tw-link', h('code', link), h('button.tw-chip', { type: 'button', onclick: () => copy(link + '  (demo — opens nothing)', 'Demo link copied') }, 'Copy')),
        h('p.tw-hint', 'A demo string. It does not open anything — no secret was sent.')),
      h('section.tw-block', h('h4.tw-k', 'What is held now · this tab only'),
        h('dl.tw-stats.sc-dl',
          h('div', h('dt', 'Cipher'), h('dd', 'AES-256-GCM')),
          h('div', h('dt', 'Views'), h('dd.sc-views', '0 / 1')),
          h('div', h('dt', 'Expires'), h('dd', left))),
        h('pre.sc-ct', { tabindex: 0, 'aria-label': 'Ciphertext' }, payload.match(/.{1,44}/g).join('\n')),
        h('p.tw-hint', 'IV + ciphertext with auth tag, base64. The plaintext is no longer in the page.')),
      h('section.tw-block', h('h4.tw-k', 'Recipient'), viewBox)
    );
    step('link');
    view.focus({ preventScroll: true });

    async function reveal() {
      if (!vault) return;
      if (Date.now() > vault.expires) return burn('expired');
      view.disabled = true; setStatus('working', 'Decrypting');
      const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: vault.iv }, vault.key, vault.ct);
      vault.views++;
      out.querySelector('.sc-views').textContent = vault.views + ' / 1';
      const plain = new TextDecoder().decode(pt);
      step('view');
      viewBox.replaceChildren(
        h('p.sc-rev', plain),
        h('div.tw-row', h('button.tw-chip', { type: 'button', onclick: () => copy(plain, 'Copied') }, 'Copy'), h('span.tw-hint', 'This is the only time it can be read.')));
      setStatus('done', 'Viewed · destroying');
      await sleep(matchMedia('(prefers-reduced-motion: reduce)').matches ? 600 : 2600);
      burn('viewed');
    }
  }

  function burn(why) {
    clearInterval(timer);
    vault = null; // key, IV and ciphertext are dropped; nothing else references them
    step('gone');
    const ct = out.querySelector('.sc-ct');
    if (ct) { ct.classList.add('gone'); ct.textContent = '— wiped —'; }
    const ttlEl = out.querySelector('.sc-ttl');
    if (ttlEl) ttlEl.textContent = why === 'expired' ? 'Expired' : 'Destroyed';
    const vb = out.querySelector('.sc-view');
    if (vb) vb.replaceChildren(state('gone', 'This secret has been destroyed', why === 'expired'
      ? 'It expired before anyone opened it.'
      : 'Opening the link again shows only this. In the full app the server deletes the row on the last view.'));
    setStatus('ok', 'Destroyed');
  }

  return () => { clearInterval(timer); vault = null; };
}
