/* 05 · Singapore NRIC & FIN generator — same algorithm as nric-generator.aivoryx.com.
   Synthetic, checksum-valid test values only. */
import { h, copy, download, seg, state, tag } from './lib.js';

const weights = [2, 7, 6, 5, 4, 3, 2];
const tables = { S: 'JZIHGFEDCBA', T: 'JZIHGFEDCBA', F: 'XWUTRQPNMLK', G: 'XWUTRQPNMLK' };
const offsets = { S: 0, T: 4, F: 0, G: 4 };
const types = { S: 'NRIC S-series', T: 'NRIC T-series', F: 'FIN F-series', G: 'FIN G-series', M: 'FIN M-series' };
const notes = {
  S: 'Checksum-valid synthetic NRIC test value', T: 'Checksum-valid synthetic NRIC test value',
  F: 'Checksum-valid synthetic FIN test value', G: 'Checksum-valid synthetic FIN test value',
  M: 'Format-only M-series FIN test value'
};
const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const rnd = n => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; };

export const checksum = (prefix, digits) => {
  const sum = digits.split('').reduce((t, d, i) => t + Number(d) * weights[i], 0);
  return tables[prefix][(sum + offsets[prefix]) % 11];
};
const randomDigits = () => Array.from({ length: 7 }, () => rnd(10)).join('');
export const makeId = (prefix, digits = randomDigits()) =>
  prefix === 'M' ? `${prefix}${digits}${letters[rnd(letters.length)]}` : `${prefix}${digits}${checksum(prefix, digits)}`;
const pick = choice => {
  const o = choice === 'ANY' ? ['S', 'T', 'F', 'G'] : choice === 'NRIC' ? ['S', 'T'] : choice === 'FIN' ? ['F', 'G'] : [choice];
  return o[rnd(o.length)];
};
const normalize = v => v.toUpperCase().replace(/[\s-]/g, '').trim();

function validate(value) {
  const n = normalize(value);
  if (!n) return { n, level: 'empty', title: 'Enter a value', message: 'Paste an NRIC or FIN to check its structure.' };
  if (!/^[A-Z][0-9]{7}[A-Z]$/.test(n)) return { n, level: 'invalid', title: 'Invalid format', message: 'Expected one prefix letter, seven digits and one trailing letter.' };
  const prefix = n[0], digits = n.slice(1, 8), received = n[8];
  if (!['S', 'T', 'F', 'G', 'M'].includes(prefix)) return { n, level: 'invalid', title: 'Unsupported prefix', message: 'Supported prefixes are S, T, F, G and M.' };
  if (prefix === 'M') return { n, level: 'warning', prefix, digits, received, title: 'Format valid, checksum not verified', message: 'M-series format is recognised, but the official M rule is not public, so no checksum is claimed.' };
  const expected = checksum(prefix, digits);
  const ok = expected === received;
  return { n, level: ok ? 'valid' : 'invalid', prefix, digits, received, expected, title: ok ? 'Checksum valid' : 'Checksum mismatch',
    message: ok ? 'The check letter matches the prefix and the seven digits.' : `The check letter should be ${expected}, not ${received}.` };
}

const record = prefix => ({ id: makeId(prefix), prefix, type: types[prefix], note: notes[prefix] });

function qaPack() {
  const base = [['S', '1234567'], ['T', '7654321'], ['F', '0000000'], ['G', '9999999']]
    .map(([p, d]) => ({ id: makeId(p, d), prefix: p, type: types[p], note: 'Known checksum-valid fixture' }));
  return [...base,
    { id: 'M1234567B', prefix: 'M', type: types.M, note: 'M-series format-only fixture' },
    { id: base[0].id.slice(0, 8) + 'A', prefix: 'S', type: 'Invalid checksum', note: 'Valid shape with wrong check letter' },
    { id: 'A1234567Z', prefix: 'A', type: 'Unsupported prefix', note: 'Prefix should fail validation' },
    { id: 'S12A4567D', prefix: 'S', type: 'Malformed body', note: 'Middle characters must be digits' },
    { id: 's1234567d', prefix: 'S', type: 'Lowercase input', note: 'Validator should normalise case' }];
}

function format(records, f) {
  const ids = records.map(r => r.id);
  if (f === 'csv') return ['id,prefix,type,note', ...records.map(r => `"${r.id}","${r.prefix}","${r.type}","${r.note}"`)].join('\n');
  if (f === 'json') return JSON.stringify(records, null, 2);
  if (f === 'typescript') return `const nricFinTestIds = ${JSON.stringify(ids, null, 2)} as const`;
  if (f === 'python') return `nric_fin_test_ids = ${JSON.stringify(ids, null, 2)}`;
  if (f === 'sql') return ['insert into test_identifiers (identifier, identifier_type) values',
    records.map((r, i) => `  ('${r.id}', '${r.type.replace(/'/g, "''")}')${i === records.length - 1 ? ';' : ','}`).join('\n')].join('\n');
  return ids.join('\n');
}
const EXT = { plain: ['txt', 'text/plain'], csv: ['csv', 'text/csv'], json: ['json', 'application/json'], sql: ['sql', 'application/sql'], typescript: ['ts', 'text/plain'], python: ['py', 'text/x-python'] };

export function mount({ stage, out, setStatus }) {
  let series = 'NRIC', fmt = 'plain', records = [];

  /* --- generate one --- */
  const big = h('output.nr-big', { 'aria-live': 'polite' });
  const bigType = h('span.nr-type');
  function one() {
    const p = pick(series);
    const id = makeId(p);
    big.replaceChildren(h('span.p', id[0]), h('span.d', id.slice(1, 8)), h('span.c', id[8]));
    big.dataset.id = id;
    bigType.textContent = types[p] + (p === 'M' ? ' · format only' : ' · checksum-valid');
    check.value = id; explain();
  }
  const seriesSeg = seg('Series', [['NRIC', 'NRIC'], ['FIN', 'FIN'], ['ANY', 'Any'], ['S', 'S'], ['T', 'T'], ['F', 'F'], ['G', 'G'], ['M', 'M']], series, v => { series = v; one(); });

  /* --- bulk --- */
  const qty = h('input.tw-input.nr-qty', { type: 'number', min: 1, max: 250, value: 25, inputmode: 'numeric', 'aria-label': 'How many' });
  const list = h('ol.nr-list', { 'aria-label': 'Generated identifiers' });
  const fmtSeg = seg('Export format', [['plain', 'Text'], ['csv', 'CSV'], ['json', 'JSON'], ['sql', 'SQL'], ['typescript', 'TS'], ['python', 'Python']], fmt, v => { fmt = v; render(); }, { small: true });
  const preview = h('pre.nr-pre', { tabindex: 0, 'aria-label': 'Export preview' });
  const countEl = h('span.nr-count');

  function bulk() {
    let n = Math.round(+qty.value);
    if (!Number.isFinite(n) || n < 1) n = 1;
    if (n > 250) n = 250;
    qty.value = n;
    records = Array.from({ length: n }, () => record(pick(series)));
    render(); setStatus('done', n + ' generated');
  }
  function render() {
    countEl.textContent = records.length ? `${records.length} record${records.length > 1 ? 's' : ''}` : 'Nothing yet';
    list.replaceChildren(...records.slice(0, 250).map((r, i) => h('li', h('i', String(i + 1).padStart(3, '0')), h('code', r.id), h('span', r.type))));
    preview.textContent = records.length ? format(records, fmt) : '— generate a list or load the QA pack —';
    outBody.hidden = !records.length; outEmpty.hidden = !!records.length;
  }

  /* --- validate + explain --- */
  const check = h('input.tw-input.nr-check', { type: 'text', maxlength: 12, spellcheck: false, autocomplete: 'off', placeholder: 'e.g. S1234567D', 'aria-label': 'NRIC or FIN to validate' });
  const verdict = h('div.nr-verdict', { 'aria-live': 'polite' });
  const work = h('div.nr-work');
  check.addEventListener('input', explain);
  function explain() {
    const r = validate(check.value);
    verdict.className = 'nr-verdict ' + r.level;
    verdict.replaceChildren(h('b', r.title), h('span', r.message));
    work.replaceChildren();
    if (!r.digits || r.prefix === 'M' || !tables[r.prefix]) return;
    const prods = r.digits.split('').map((d, i) => +d * weights[i]);
    const sum = prods.reduce((a, b) => a + b, 0);
    const idx = (sum + offsets[r.prefix]) % 11;
    work.append(
      h('table.nr-tbl', h('caption.vh', 'Check-letter calculation'),
        h('tr', h('th', { scope: 'row' }, 'Digit'), ...r.digits.split('').map(d => h('td', d))),
        h('tr', h('th', { scope: 'row' }, '× weight'), ...weights.map(w => h('td', w))),
        h('tr', h('th', { scope: 'row' }, '='), ...prods.map(p => h('td', p)))),
      h('ol.nr-steps',
        h('li', 'Sum of products ', h('b', sum)),
        h('li', `${r.prefix}-series offset `, h('b', '+' + offsets[r.prefix]), ' → ', h('b', sum + offsets[r.prefix])),
        h('li', 'Remainder ÷ 11 ', h('b', idx)),
        h('li', 'Look up position ', h('b', idx), ' in ',
          h('span.nr-table', ...tables[r.prefix].split('').map((c, i) => h('span' + (i === idx ? '.on' : ''), c))),
          ' → ', h('b.nr-exp', r.expected)))
    );
  }

  stage.append(
    h('p.nr-warn', { role: 'note' }, h('b', 'Synthetic test data.'), ' These are synthetic test identifiers, not issued identities. Never use them for real identity verification.'),
    h('div.nr-gen',
      h('div.nr-row', h('span.tw-k', 'Series'), seriesSeg),
      h('div.nr-show', big, bigType,
        h('div.nr-act',
          h('button.tw-btn', { type: 'button', onclick: one }, 'Generate one'),
          h('button.tw-chip', { type: 'button', onclick: () => copy(big.dataset.id, big.dataset.id + ' copied') }, 'Copy')))),
    h('div.nr-bulk',
      h('span.tw-k', 'Bulk'),
      h('label.nr-qtyl', qty, h('span', 'IDs · max 250')),
      h('button.tw-btn.ghost', { type: 'button', onclick: bulk }, 'Generate list'),
      h('button.tw-chip', { type: 'button', onclick: () => { records = qaPack(); render(); setStatus('done', 'QA pack loaded'); } }, 'QA edge-case pack')),
    h('div.nr-val',
      h('div.nr-row', h('label.tw-k', { for: check.id = 'nr-check' }, 'Validate'), check),
      verdict, work)
  );

  const outEmpty = state('empty', 'No list yet', 'Generate a list or load the QA pack to see it here, ready to export.');
  const outBody = h('div.nr-out',
    h('div.tw-ohead', h('h4.tw-k', 'Dataset'), countEl),
    list,
    h('div.tw-ohead', h('h4.tw-k', 'Export'), fmtSeg),
    preview,
    h('div.tw-row',
      h('button.tw-chip', { type: 'button', onclick: () => copy(format(records, fmt), 'Export copied') }, 'Copy'),
      h('button.tw-chip', { type: 'button', onclick: () => download(format(records, fmt), 'nric-fin-test-ids.' + EXT[fmt][0], EXT[fmt][1]) }, 'Download .' + EXT[fmt][0]),
      tag('Synthetic only')));
  // the download label follows the chosen format
  fmtSeg.addEventListener('click', () => { outBody.querySelector('.tw-row .tw-chip:nth-child(2)').textContent = 'Download .' + EXT[fmt][0]; });
  fmtSeg.addEventListener('keyup', () => { outBody.querySelector('.tw-row .tw-chip:nth-child(2)').textContent = 'Download .' + EXT[fmt][0]; });
  out.append(outEmpty, outBody);

  one(); render();
  records = Array.from({ length: 8 }, () => record(pick('ANY'))); render();
}
