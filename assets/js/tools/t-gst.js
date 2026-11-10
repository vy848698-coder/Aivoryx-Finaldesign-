/* 06 · GST notice reply — a sample of the output, not a simulation of AI.
   Three fictional notices with analyses written in advance by us, each clearly
   labelled. Uploaded files are only checked for type/size and never read or sent. */
import { h, bytes, dropZone, seg, state, tag, busy, sleep, reduceMotion } from './lib.js';

const DISCLAIMER = 'AI-generated drafts are for assistance and require review by a qualified tax professional. This is not legal or tax advice.';

const N = {
  asmt: {
    form: 'FORM GST ASMT-10', title: 'Notice for intimating discrepancies in the return after scrutiny',
    ref: 'ZD07112600SAMPLE', date: '04 Nov 2026', period: 'FY 2023-24',
    to: 'M/s Kestrel Trading Co. (fictional)', gstin: '07AAAAA0000A1Z0 · sample',
    body: [
      'The returns furnished by you for the period mentioned above have been scrutinised under Section 61 of the CGST Act, 2017 read with Rule 99 of the CGST Rules, 2017. The following discrepancies have been noticed:',
      ['Input tax credit claimed in GSTR-3B: ₹4,82,600. Credit available as per GSTR-2B: ₹3,96,150. Excess credit claimed: ₹86,450.',
       'Taxable value of outward supplies declared in GSTR-1 exceeds that declared in GSTR-3B by ₹1,20,000 (tax effect ₹21,600 at 18%).'],
      'You are directed to explain the reasons for the discrepancies within 30 days of this notice in FORM GST ASMT-11, failing which proceedings shall be initiated in accordance with law.'
    ],
    summary: 'A scrutiny notice, not a demand. The officer has found two mismatches for FY 2023-24 and wants an explanation in ASMT-11 within 30 days. No tax, interest or penalty has been fixed yet.',
    deadline: '30 days · reply in ASMT-11',
    exposure: '₹1,08,050 tax in question (₹86,450 ITC + ₹21,600 output tax), before interest',
    issues: [
      ['ITC in 3B higher than 2B by ₹86,450', 'Check whether the gap is timing: supplier invoices filed late appear in a later month\'s 2B. Credit is allowed only once the invoice reflects in 2B.', 'Sec 16(2)(aa)'],
      ['Outward supplies: GSTR-1 above GSTR-3B by ₹1,20,000', 'Usually a credit note, an amendment or an invoice reported in the wrong month. Reconcile invoice by invoice.', 'Sec 34, Sec 37'],
      ['If any amount is truly payable', 'Paying it with interest via DRC-03 before the reply can close the matter at this stage.', 'Sec 50, Sec 61(2)']
    ],
    cites: [['Sec 61', 'Scrutiny of returns'], ['Rule 99', 'ASMT-10 / ASMT-11 procedure'], ['Sec 16(2)(aa)', 'ITC only if shown in GSTR-2B'], ['Sec 34', 'Credit and debit notes'], ['Sec 50', 'Interest on delayed payment']],
    draft: ['To,\nThe Proper Officer,\nWard 41, Delhi (sample)', 'Sub: Reply in FORM GST ASMT-11 to notice ZD07112600SAMPLE dated 04.11.2026 for FY 2023-24',
      'Respected Sir/Madam,\nWith reference to the above notice, we submit our point-wise explanation of the discrepancies noted, along with supporting reconciliations.'],
    outline: ['1. Excess ITC of ₹86,450 — invoice-wise reconciliation of GSTR-3B with GSTR-2B', '2. Outward supply difference of ₹1,20,000 — credit notes and amendments', '3. Annexures: reconciliation statement, copies of credit notes', '4. Prayer to drop proceedings under Section 61(2)']
  },
  drc: {
    form: 'FORM GST DRC-01', title: 'Summary of show cause notice',
    ref: 'ZD07102600SAMPLE', date: '21 Oct 2026', period: 'FY 2021-22',
    to: 'M/s Larkspur Interiors (fictional)', gstin: '07BBBBB0000B1Z0 · sample',
    body: [
      'Whereas it appears that you have availed and utilised input tax credit not admissible to you, a show cause notice is issued under Section 73 of the CGST Act, 2017 read with Rule 142(1)(a). Grounds:',
      ['ITC of ₹58,300 availed on purchase of a motor vehicle used for transportation of persons.',
       'ITC of ₹1,56,000 availed on invoices of a supplier whose registration was cancelled with retrospective effect.'],
      'You are required to show cause why tax of ₹2,14,300 along with interest under Section 50 and penalty under Section 73 should not be demanded. Reply may be filed in FORM GST DRC-06 within 30 days.'
    ],
    summary: 'A show cause notice under Section 73 (no fraud alleged) proposing a demand of ₹2,14,300 plus interest and penalty for FY 2021-22, on two grounds: a blocked credit and credit from a supplier cancelled later.',
    deadline: '30 days · reply in DRC-06',
    exposure: '₹2,14,300 tax + interest + penalty',
    issues: [
      ['₹58,300 ITC on a motor vehicle', 'Blocked unless the vehicle is used for specified purposes, such as further supply of vehicles or passenger transport services. Establish the actual use.', 'Sec 17(5)(a)'],
      ['₹1,56,000 ITC from a supplier cancelled retrospectively', 'Retrospective cancellation alone may not undo credit taken in good faith. Show tax invoices, payment through banking channels and goods received.', 'Sec 16(2)'],
      ['Penalty and interest', 'Under Section 73, paying tax and interest within 30 days of the notice can avoid penalty.', 'Sec 73(8), Sec 50']
    ],
    cites: [['Sec 73', 'Demand where no fraud is alleged'], ['Rule 142', 'DRC-01 and DRC-06'], ['Sec 17(5)', 'Blocked credits'], ['Sec 16(2)', 'Conditions for ITC'], ['Sec 50', 'Interest']],
    draft: ['To,\nThe Proper Officer,\nCircle 12, Delhi (sample)', 'Sub: Reply in FORM GST DRC-06 to show cause notice ZD07102600SAMPLE dated 21.10.2026 for FY 2021-22',
      'Respected Sir/Madam,\nWe deny the proposed demand and submit our reply on each ground, together with documents establishing the use of the vehicle and the genuineness of the purchases.'],
    outline: ['1. Ground 1 — use of the vehicle and the exception in Section 17(5)(a)', '2. Ground 2 — bona fide purchase: invoices, bank payments, delivery proof', '3. On interest and penalty', '4. Request for a personal hearing']
  },
  reg: {
    form: 'FORM GST REG-03', title: 'Notice seeking clarification / information on application for registration',
    ref: 'AA0711260SAMPLE', date: '07 Nov 2026', period: 'New registration',
    to: 'Applicant: Heron Analytics LLP (fictional)', gstin: 'ARN AA0711260SAMPLE',
    body: [
      'With reference to your application for registration, the following clarification / documents are required under Rule 9(2) of the CGST Rules, 2017:',
      ['The rent agreement uploaded for the principal place of business is unsigned and not stamped.',
       'The name on the electricity bill does not match the name of the owner in the rent agreement.'],
      'You are directed to submit the clarification in FORM GST REG-04 within seven working days, failing which your application is liable to be rejected.'
    ],
    summary: 'Not a demand. The officer needs two document fixes before approving a new registration. The reply goes in REG-04 within seven working days, or the application can be rejected.',
    deadline: '7 working days · reply in REG-04',
    exposure: 'No tax — rejection of the application if not answered',
    issues: [
      ['Unsigned, unstamped rent agreement', 'Upload a signed agreement on stamp paper of the right value, with the owner\'s ID.', 'Rule 8, Rule 9(2)'],
      ['Electricity bill in a different name', 'Add an NOC from the bill holder or proof that links them to the owner, such as a property tax receipt.', 'Rule 9(2)']
    ],
    cites: [['Sec 25', 'Procedure for registration'], ['Rule 9(2)', 'REG-03 clarification'], ['Rule 9(4)', 'Rejection if not answered']],
    draft: ['To,\nThe Proper Officer,\nRange 3, Delhi (sample)', 'Sub: Clarification in FORM GST REG-04 against notice dated 07.11.2026, ARN AA0711260SAMPLE',
      'Respected Sir/Madam,\nIn response to the above notice, we enclose the documents sought and clarify the points raised, requesting approval of the application.'],
    outline: ['1. Signed and stamped rent agreement attached', '2. NOC from the electricity bill holder with ID proof', '3. Request to approve the application']
  }
};

export function mount({ stage, out, setStatus }) {
  let pick = 'asmt', runId = 0;

  const paper = h('article.gs-paper', { 'aria-label': 'Sample notice' });
  const pickSeg = seg('Sample notice', [['asmt', 'ASMT-10 · scrutiny'], ['drc', 'DRC-01 · show cause'], ['reg', 'REG-03 · registration']], pick, v => { pick = v; paint(); reset(); });
  const upNote = h('div.gs-up-note', { hidden: true, role: 'status' });
  const zone = dropZone({ accept: '.pdf,application/pdf', compact: true, label: 'Have a real notice? Drop the PDF', hint: 'Checked here for type and size only — analysed in the full app', onFiles: f => uploaded(f[0]) });
  const go = h('button.tw-btn', { type: 'button', onclick: analyse }, 'Show sample analysis');

  stage.append(
    h('div.gs-top', h('span.tw-k', 'Sample notice'), pickSeg),
    paper,
    h('div.gs-act', go, h('span.tw-hint', 'Pre-written for this fictional notice. No AI runs in this preview.')),
    zone, upNote
  );

  function paint() {
    const n = N[pick];
    paper.replaceChildren(
      h('span.gs-wm', { 'aria-hidden': 'true' }, 'SAMPLE'),
      h('header', h('b', n.form), h('span', n.title)),
      h('dl.gs-meta', h('div', h('dt', 'Reference'), h('dd', n.ref)), h('div', h('dt', 'Date'), h('dd', n.date)), h('div', h('dt', 'Period'), h('dd', n.period))),
      h('p.gs-to', h('b', n.to), h('br'), n.gstin),
      ...n.body.map(p => Array.isArray(p) ? h('ol', ...p.map(x => h('li', x))) : h('p', p)),
      h('p.gs-sign', 'Proper Officer · fictional document for demonstration')
    );
  }
  function reset() {
    runId++;
    go.disabled = false;
    out.replaceChildren(
      h('section.tw-block', h('h4.tw-k', 'In the full app'),
        h('ol.gs-cost',
          h('li', h('b', 'Analysis & summary'), h('span.free', 'Free · no credit used')),
          h('li', h('b', 'Full AI-drafted reply'), h('span', '1 credit per notice')),
          h('li', h('b', 'New accounts'), h('span', '5 free credits · Google sign-in'))),
        h('p.tw-hint', 'Supports ASMT-10, DRC-01, REG-03 and more. PDF only, up to 10 MB.')),
      state('empty', 'Ready when you are', 'Press “Show sample analysis” to see what a summary, the issues and a draft look like.'),
      h('p.gs-disc', DISCLAIMER)
    );
    setStatus('ready', 'Sample loaded');
  }
  function uploaded(f) {
    upNote.hidden = false;
    const isPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
    if (!isPdf) { upNote.className = 'gs-up-note bad'; upNote.textContent = `"${f.name}" is not a PDF. The full app accepts PDF notices up to 10 MB.`; return; }
    if (f.size > 10 * 1024 * 1024) { upNote.className = 'gs-up-note bad'; upNote.textContent = `${bytes(f.size)} is over the 10 MB limit.`; return; }
    upNote.className = 'gs-up-note';
    upNote.replaceChildren(h('b', f.name + ' · ' + bytes(f.size)),
      h('span', 'Your file has not been read or sent. This preview cannot analyse real notices — the full app does, after you sign in.'),
      h('a.tw-btn.ghost', { href: 'https://gstreply.aivoryx.com/', target: '_blank', rel: 'noopener' }, 'Analyse it in the full app ↗'));
  }

  async function analyse() {
    const my = ++runId, n = N[pick];
    go.disabled = true;
    const b = busy('Opening the pre-written sample');
    out.replaceChildren(h('section.tw-block', b));
    setStatus('working', 'Loading sample');
    const steps = ['Opening the pre-written sample', 'Summary', 'Issues', 'Sections cited', 'Draft layout'];
    for (const s of steps) { if (my !== runId) return; b.set(s); await sleep(reduceMotion() ? 0 : 260); }
    if (my !== runId) return;
    go.disabled = false;
    out.replaceChildren(
      h('div.gs-label', tag('Sample analysis', 'warn'), h('span', 'Written in advance for this fictional notice — not generated by AI.')),
      h('section.tw-block', h('div.tw-ohead', h('h4.tw-k', 'Summary'), h('span.gs-free', 'Free in the app')),
        h('p.gs-sum', n.summary),
        h('dl.tw-stats', h('div', h('dt', 'Deadline'), h('dd', n.deadline)), h('div', h('dt', 'At stake'), h('dd', n.exposure)))),
      h('section.tw-block', h('h4.tw-k', 'Issues identified'),
        h('ol.gs-issues', ...n.issues.map(([t, d, s]) => h('li', h('b', t), h('p', d), h('code', s))))),
      h('section.tw-block', h('h4.tw-k', 'Sections referenced'),
        h('ul.gs-cites', ...n.cites.map(([s, d]) => h('li', h('code', s), h('span', d))))),
      h('section.tw-block', h('div.tw-ohead', h('h4.tw-k', 'Draft reply · opening'), h('span.gs-paid', '1 credit for the full draft')),
        h('div.gs-draft', ...n.draft.map(p => h('p', p)),
          h('div.gs-outline', h('span.tw-k', 'Rest of the reply, by heading'), h('ol', ...n.outline.map(x => h('li', x)))))),
      h('p.gs-disc', DISCLAIMER)
    );
    setStatus('done', 'Sample shown');
  }

  paint(); reset();
  return () => { runId++; };
}
