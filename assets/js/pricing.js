/* AIVORYX · How we price (pricing.html)
   - scroll progress rule
   - project directions (ARIA tabs) + "Explore this direction" → form
   - process timeline: scroll-linked line, steps light up as it passes
   - value strata: the layer for the item in view / hovered lights up
   - FAQ accordion (keyboard: ↑ ↓ Home End between questions)
   - the enquiry form → api/send.php with kind:"pricing"

   The form never estimates, calculates or shows a price. Success is
   shown ONLY when the server answers { ok:true }; every other outcome
   keeps the answers in place and offers WhatsApp instead. */
(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];

  const yr = $('[data-year]');
  if (yr) yr.textContent = new Date().getFullYear();

  /* ---------- scroll-linked: progress rule + process line ---------- */
  const bar = $('.pr-progress');
  const track = $('.proc-track');
  const steps = track ? $$('.ps', track) : [];
  const wide = matchMedia('(min-width: 1081px)');
  const clamp = v => Math.max(0, Math.min(1, v));

  function frame() {
    ticking = false;
    const root = document.documentElement;
    const max = root.scrollHeight - innerHeight;
    if (bar) bar.style.setProperty('--sp', max > 0 ? clamp(scrollY / max).toFixed(4) : 0);

    if (!track) return;
    const vh = innerHeight;
    const r = track.getBoundingClientRect();
    let p;
    if (wide.matches) {
      // horizontal: the line fills while the row travels from 85% to 35% of the screen
      p = clamp((vh * 0.85 - r.top) / (vh * 0.5));
      steps.forEach((s, i) => s.classList.toggle('on', p >= (i + 0.25) / steps.length));
    } else {
      // vertical: the line follows a reading point at 60% of the screen
      const line = vh * 0.6;
      p = clamp((line - r.top) / r.height);
      steps.forEach(s => s.classList.toggle('on', s.getBoundingClientRect().top < line));
    }
    track.style.setProperty('--p', p.toFixed(4));
  }
  let ticking = false;
  const req = () => { if (!ticking) { ticking = true; requestAnimationFrame(frame); } };
  addEventListener('scroll', req, { passive: true });
  addEventListener('resize', req);
  frame();

  /* ---------- directions: tabs ---------- */
  const tabs = $$('.dir-tab');
  function select(tab, focus) {
    tabs.forEach(t => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      const panel = document.getElementById(t.getAttribute('aria-controls'));
      if (panel) panel.classList.toggle('on', on);
    });
    if (focus) tab.focus();
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(t));
    t.addEventListener('keydown', e => {
      let j = null;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') j = (i + 1) % tabs.length;
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') j = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === 'Home') j = 0;
      else if (e.key === 'End') j = tabs.length - 1;
      if (j === null) return;
      e.preventDefault();
      select(tabs[j], true);
    });
  });

  /* ---------- value: strata follow the list ---------- */
  const bands = $$('.strata .band');
  const items = $$('.vl');
  function layer(n) {
    bands.forEach(b => b.classList.toggle('on', b.dataset.layer === n));
    items.forEach(li => li.classList.toggle('on', li.dataset.layer === n));
  }
  if (items.length) {
    layer('1');
    items.forEach(li => {
      li.addEventListener('mouseenter', () => layer(li.dataset.layer));
    });
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(es => es.forEach(e => {
        if (e.isIntersecting) layer(e.target.dataset.layer);
      }), { rootMargin: '-45% 0px -50% 0px' });
      items.forEach(li => io.observe(li));
    }
  }

  /* ---------- FAQ accordion ---------- */
  const qBtns = $$('.qa button');
  qBtns.forEach((b, i) => {
    b.addEventListener('click', () => {
      const open = b.getAttribute('aria-expanded') !== 'true';
      b.setAttribute('aria-expanded', String(open));
      b.closest('.qa').classList.toggle('open', open);
    });
    b.addEventListener('keydown', e => {
      let j = null;
      if (e.key === 'ArrowDown') j = Math.min(i + 1, qBtns.length - 1);
      else if (e.key === 'ArrowUp') j = Math.max(i - 1, 0);
      else if (e.key === 'Home') j = 0;
      else if (e.key === 'End') j = qBtns.length - 1;
      if (j === null) return;
      e.preventDefault();
      qBtns[j].focus();
    });
  });

  /* ---------- the enquiry ---------- */
  const form = document.getElementById('pq');
  const done = document.getElementById('pqDone');
  if (!form || !done) return;

  const ENDPOINT = form.getAttribute('action') || 'api/send.php';
  const TIMEOUT = 25000;
  const btn = $('.enq-send', form);
  const label = $('.lbl', btn);
  const labelIdle = label.textContent;
  const alertBox = $('.enq-alert', form);
  const alertText = $('.msg', alertBox);
  const trap = $('input.hp', form);
  const more = $('[data-more]', form);
  const noteLabel = $('[data-note-label]', form);
  const hint = $('#pq-bm-hint');
  const dirInput = form.elements.direction;
  const dirChip = $('.pq-dir', form);

  // Same rules as the pricing branch of send.php, so the browser never accepts what the server rejects.
  const RULES = {
    build:       v => v !== '' || 'Pick the closest one. “Not sure yet” is a perfectly good answer.',
    budget_mode: v => v !== '' || 'Choose whichever feels right. None of them asks you for a number.',
    priority:    v => v !== '' || 'Pick one. “A balanced approach” is a good answer too.',
    name:        v => v.length >= 2 || 'Please tell us your name.',
    email:       v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) || "That email doesn't look quite right.",
    phone:       v => { if (!v) return true; const d = v.replace(/\D/g, '').length; return (d >= 10 && d <= 13) || 'A 10-digit mobile number, or leave it blank.'; }
  };
  const ORDER = ['build', 'budget_mode', 'priority', 'name', 'email', 'phone'];

  // What each budget answer opens up. Copy only; nothing here is a figure.
  const MODES = {
    "I have a budget in mind": { more: true, label: 'Your comfortable range', hint: '' },
    "I'd like help deciding": { more: false, hint: 'Good. We’ll explain what shapes the investment and suggest a sensible place to start.' },
    "I'd prefer to discuss this personally": { more: false, hint: 'Understood. We’ll leave it off the form and talk it through on a call or WhatsApp.' },
    "I want to share my budget privately": { more: true, label: 'Your budget, privately', hint: 'Seen only by the two founders. Leave it blank if you’d rather say it on a call.' }
  };

  const val = name => {
    const el = form.elements[name];
    return el ? String(el.value || '').trim() : '';
  };
  const box = name => $('[data-field="' + name + '"]', form);
  const check = name => { const r = RULES[name](val(name)); return r === true ? '' : r; };

  function show(name, msg) {
    const b = box(name);
    if (!b) return;
    b.classList.toggle('bad', !!msg);
    b.classList.toggle('ok', !msg && val(name) !== '');
    const err = $('.f-err', b);
    if (err) err.textContent = msg;
    const target = b.matches('fieldset') ? $('[role="radiogroup"]', b) : $('input,textarea', b);
    if (target) target.setAttribute('aria-invalid', msg ? 'true' : 'false');
  }

  function progress() {
    $$('.step', form).forEach(step => {
      const names = (step.dataset.needs || '').split(' ').filter(Boolean);
      step.classList.toggle('done', names.length ? names.every(n => !check(n)) : val('message') !== '');
    });
  }

  function mode() {
    const m = MODES[val('budget_mode')];
    more.hidden = !(m && m.more);
    if (m && m.label) noteLabel.firstChild.textContent = m.label + ' ';
    hint.textContent = m ? m.hint : '';
  }

  let tried = false;
  ['name', 'email', 'phone'].forEach(name => {
    const el = form.elements[name];
    el.addEventListener('blur', () => { if (tried || el.value.trim()) show(name, check(name)); progress(); });
    el.addEventListener('input', () => { if (box(name).classList.contains('bad')) show(name, check(name)); progress(); });
  });
  ['build', 'budget_mode', 'priority'].forEach(name => {
    box(name).addEventListener('change', e => {
      if (e.target.name !== name) return;
      show(name, '');
      if (name === 'budget_mode') mode();
      progress();
    });
  });
  form.elements.message.addEventListener('input', progress);

  /* "Explore this direction" carries the direction into the form */
  function setDirection(d) {
    dirInput.value = d || '';
    dirChip.hidden = !d;
    if (d) $('[data-dir-name]', dirChip).textContent = d;
  }
  $$('[data-direction]').forEach(a => a.addEventListener('click', () => setDirection(a.dataset.direction)));
  $('.pq-dir-x', dirChip).addEventListener('click', () => { setDirection(''); form.elements.build[0].focus(); });

  function setAlert(msg) {
    if (!msg) { alertBox.hidden = true; return; }
    alertText.textContent = msg;
    alertBox.hidden = false;
  }

  function busy(on) {
    form.classList.toggle('is-sending', on);
    form.setAttribute('aria-busy', String(on));
    btn.disabled = on;
    label.textContent = on ? 'Sending…' : labelIdle;
    $$('input:not(.hp),textarea', form).forEach(el => {
      if (el.type === 'radio') el.disabled = on; else el.readOnly = on;
    });
  }

  let sending = false;
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (sending) return;
    tried = true;
    setAlert('');

    let first = null;
    ORDER.forEach(name => {
      const msg = check(name);
      show(name, msg);
      if (msg && !first) first = name;
    });
    progress();
    if (first) {
      const n = $$('.bad', form).length;
      setAlert(n === 1 ? 'One answer needs another look.' : n + ' answers need another look.');
      const b = box(first);
      ($('input:not([type=radio])', b) || $('input', b)).focus();
      return;
    }

    // A person never sees the trap field; anything in it is automated.
    // Nothing is sent and nothing is claimed.
    if (trap && trap.value) return;

    const payload = {
      kind: 'pricing',
      name: val('name'),
      email: val('email'),
      phone: val('phone'),
      build: val('build'),
      budget_mode: val('budget_mode'),
      budget_note: more.hidden ? '' : val('budget_note'),
      priority: val('priority'),
      direction: val('direction'),
      message: val('message'),
      company: trap ? trap.value : '',
      page: 'How we price'
    };

    sending = true;
    busy(true);
    window.axPost(ENDPOINT, payload, TIMEOUT)
      .then(({ status, data }) => {
        if (data && data.ok === true) return succeed(payload.email);
        let msg = data && data.message;
        if (!msg) msg = status === 404 || status === 405 || status === 501
          ? "The form can't reach our inbox from here."
          : "We couldn't send that just now.";
        fail(msg);
      })
      .catch(err => fail(err && err.name === 'AbortError'
        ? 'That took too long to send, so it may not have reached us.'
        : "No connection, so your answers weren't sent."))
      .then(() => { sending = false; busy(false); });
  });

  function fail(msg) {
    setAlert(msg + ' Your answers are still here. Try again, or send them on WhatsApp.');
    alertBox.focus();
  }

  function succeed(email) {
    $('[data-email]', done).textContent = email;
    form.hidden = true;
    done.hidden = false;
    done.focus();
  }

  $('.done-again', done).addEventListener('click', () => {
    form.reset();
    tried = false;
    ORDER.forEach(n => show(n, ''));
    $$('.ok', form).forEach(el => el.classList.remove('ok'));
    setDirection('');
    mode();
    progress();
    setAlert('');
    done.hidden = true;
    form.hidden = false;
    form.elements.build[0].focus();
  });

  mode();
  progress();
})();
