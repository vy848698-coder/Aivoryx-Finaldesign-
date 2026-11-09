/* AIVORYX · hero demo — the Clans Machina solar maths, live.
   Assumptions are printed under the demo (.assume) — keep them in sync. */
(function () {
  const bill = document.getElementById('bill');
  if (!bill) return;

  const C = {
    tariff: 8,          // ₹ per unit
    kWunits: 118,       // units per kW per month
    loss: 0.92,         // system losses 8%
    costKw: 60000,      // ₹ per kW installed
    // PM Surya Ghar: ₹30k/kW for the first 2 kW, ₹18k for the 3rd, capped at ₹78k
    subsidy(kw) { return Math.round(Math.min(kw, 2) * 30000 + Math.max(0, Math.min(kw, 3) - 2) * 18000); }
  };
  const MIN = +bill.min, MAX = +bill.max;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const inr = n => '₹' + Math.round(n).toLocaleString('en-IN');
  const $ = id => document.getElementById(id);

  const last = {};
  const raf = {};
  function setVal(id, to, fmt) {
    const el = $(id);
    const from = last[id] ?? to;
    last[id] = to;
    cancelAnimationFrame(raf[id]);
    if (reduce || from === to) { el.textContent = fmt(to); return; }
    const t0 = performance.now(), D = 420;
    (function step(t) {
      const p = Math.min(1, (t - t0) / D), e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(from + (to - from) * e);
      if (p < 1) raf[id] = requestAnimationFrame(step);
    })(t0);
  }

  function calc() {
    const m = +bill.value;
    const units = m / C.tariff;
    const kw = Math.max(1, Math.round(units / C.kWunits * 10) / 10);
    const gross = kw * C.costKw;
    const sub = C.subsidy(kw);
    const net = gross - sub;
    const annual = m * 12 * C.loss;

    setVal('kwOut', kw, v => v.toFixed(1) + ' KW');
    setVal('costOut', gross / 1e5, v => '₹' + v.toFixed(1) + ' L');
    setVal('payOut', Math.min(net / annual, 12), v => v.toFixed(1) + ' YRS');
    setVal('unitsOut', kw * C.kWunits, v => Math.round(v) + ' U/MO');
    setVal('saveOut', (annual * 25 * 0.97 - net) / 1e5, v => '₹' + v.toFixed(1));
    $('co2Out').textContent = (units * 12 * 0.82 / 1000).toFixed(1) + ' t / yr';
    $('subOut').textContent = 'PM SURYA SUBSIDY: ' + inr(sub);
    $('billOut').textContent = inr(m);
    bill.setAttribute('aria-valuetext', inr(m) + ' per month');
    bill.style.setProperty('--fill', ((m - MIN) / (MAX - MIN) * 100) + '%');
  }

  bill.addEventListener('input', calc);
  calc();
})();
