/* AIVORYX · tools — the hero's live miniature. Not an animation of a tool:
   the same parser and checksum the workspace uses, fed by a typewriter until
   the visitor takes over. */
import { parse, linesHTML } from './t-json.js';
import { makeId, checksum } from './t-nric.js';

const root = document.getElementById('mini');
if (root) boot();

function boot() {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tabs = [...root.querySelectorAll('[role="tab"]')];
  const panes = [...root.querySelectorAll('[role="tabpanel"]')];
  const input = root.querySelector('#mini-in');
  const outEl = root.querySelector('#mini-out');
  const stat = root.querySelector('#mini-stat');
  const SAMPLES = [
    '{"tool":"json","status":"live","checks":["parse","format"],"ms":0.4}',
    '{"order":5521,"items":[{"sku":"AX-1","qty":2}],"paid":true}',
    '{"user":{"id":101,"roles":["admin","editor"]},"active":true}'
  ];
  let human = false, visible = true, typing = 0;

  function render() {
    const src = input.value;
    const t0 = performance.now();
    if (!src.trim()) { outEl.innerHTML = '<span class="ln"> </span>'; stat.dataset.s = 'idle'; stat.textContent = 'Waiting for JSON'; return; }
    const r = parse(src);
    if (r.ok) {
      const text = JSON.stringify(r.value, null, 2);
      outEl.innerHTML = linesHTML(text);
      stat.dataset.s = 'ok';
      stat.textContent = `Valid · ${new Blob([src]).size} B → ${new Blob([text]).size} B · ${(performance.now() - t0).toFixed(1)} ms`;
    } else {
      outEl.innerHTML = linesHTML(src);
      stat.dataset.s = 'err';
      stat.textContent = `Col ${r.error.col} · ${r.error.message}`;
    }
  }
  input.addEventListener('input', () => { human = true; render(); });
  input.addEventListener('focus', () => { human = true; });

  // the typewriter — pauses off-screen and stops for good once someone types
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: .2 }).observe(root);
  async function loop() {
    let i = 0;
    for (;;) {
      if (human) return;
      const s = SAMPLES[i++ % SAMPLES.length];
      if (reduce) { input.value = s; render(); return; }
      for (let k = 1; k <= s.length; k++) {
        while (!visible || document.hidden) await wait(400);
        if (human) return;
        input.value = s.slice(0, k); render();
        await wait(s[k - 1] === ',' ? 120 : 26 + Math.random() * 30);
      }
      await wait(2600);
      typing++;
    }
  }
  const wait = ms => new Promise(r => setTimeout(r, ms));

  /* NRIC pane */
  const idEl = root.querySelector('#mini-id');
  const sumEl = root.querySelector('#mini-sum');
  function newId() {
    const p = ['S', 'T', 'F', 'G'][Math.floor(Math.random() * 4)];
    const id = makeId(p);
    const d = id.slice(1, 8).split('').map(Number);
    const sum = d.reduce((a, x, i) => a + x * [2, 7, 6, 5, 4, 3, 2][i], 0);
    idEl.innerHTML = `<b>${id[0]}</b>${id.slice(1, 8)}<em>${id[8]}</em>`;
    sumEl.textContent = `Σ ${sum}${'TG'.includes(p) ? ' + 4' : ''} mod 11 → ${checksum(p, id.slice(1, 8))} · synthetic`;
  }
  root.querySelector('#mini-gen').addEventListener('click', newId);
  newId();

  /* tabs */
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(i));
    t.addEventListener('keydown', e => {
      const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (!d) return;
      e.preventDefault(); const n = (i + d + tabs.length) % tabs.length; select(n); tabs[n].focus();
    });
  });
  function select(i) {
    tabs.forEach((t, k) => { t.setAttribute('aria-selected', String(k === i)); t.tabIndex = k === i ? 0 : -1; });
    panes.forEach((p, k) => { p.hidden = k !== i; });
  }

  render();
  loop();
}
