/* AIVORYX · Contact (contact.html)
   - "what happens next": the line fills as you scroll, steps light up
   - FAQ accordion (keyboard: ↑ ↓ Home End between questions)
   - copy-the-email button
   - the four-step enquiry → api/send.php with kind:"contact"

   Success is shown ONLY when the server answers { ok:true }. Every other
   outcome keeps the answers in place and offers WhatsApp instead. */
(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');

  const yr = $('[data-year]');
  if (yr) yr.textContent = new Date().getFullYear();

  /* ---------- hero: idea → life, four states on a loop ----------
     One rAF clock, running only while the panel is on screen, the tab is
     visible and the pointer isn't resting on it. Reduced motion: the
     finished state, still (the steps still switch it by hand). */
  const ia = $('.ia');
  if (ia) {
    const tabs = $$('[data-ia]', ia);
    const nowLbl = $('[data-ia-now]', ia);
    const DUR = { 1: 3400, 2: 4200, 3: 4000, 4: 5200 };
    let s = 4, t = 0, last = 0, raf = 0, seen = true, hover = false;

    function show(n) {
      s = n; t = 0;
      ia.dataset.s = n;
      nowLbl.textContent = '0' + n;
      tabs.forEach((b, i) => {
        b.setAttribute('aria-pressed', String(i + 1 === n));
        b.classList.toggle('done', i + 1 < n);
        b.style.setProperty('--t', i + 1 < n ? 1 : 0);
      });
    }
    function tick(now) {
      raf = 0;
      if (!running()) return;
      t += Math.min(64, now - (last || now));
      last = now;
      tabs[s - 1].style.setProperty('--t', Math.min(1, t / DUR[s]).toFixed(4));
      if (t >= DUR[s]) show(s % 4 + 1);
      raf = requestAnimationFrame(tick);
    }
    const running = () => !reduce.matches && seen && !hover && !document.hidden;
    function kick() { if (running() && !raf) { last = 0; raf = requestAnimationFrame(tick); } }

    tabs.forEach(b => b.addEventListener('click', () => { show(+b.dataset.ia); kick(); }));
    ia.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') hover = true; });
    ia.addEventListener('pointerleave', () => { hover = false; kick(); });
    document.addEventListener('visibilitychange', kick);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(es => { seen = es[0].isIntersecting; kick(); }).observe(ia);
    }
    if (reduce.matches) show(4);
    else { show(1); kick(); }
  }

  /* ---------- what happens next: scroll-linked line ---------- */
  const track = $('.nx-track');
  const steps = track ? $$('.nx-s', track) : [];
  const wide = matchMedia('(min-width: 1081px)');
  const narrow = matchMedia('(max-width: 860px)');
  const clamp = v => Math.max(0, Math.min(1, v));
  let ticking = false;

  function frame() {
    ticking = false;
    if (!track) return;
    const vh = innerHeight;
    const r = track.getBoundingClientRect();
    let p;
    if (narrow.matches) {
      // vertical: the line follows a reading point at 60% of the screen
      const line = vh * 0.6;
      p = clamp((line - r.top) / r.height);
      steps.forEach(s => s.classList.toggle('on', s.getBoundingClientRect().top < line));
    } else {
      // horizontal (or two-up): fills while the row travels from 85% to 40% of the screen
      p = clamp((vh * 0.85 - r.top) / (vh * 0.45));
      steps.forEach((s, i) => {
        const on = wide.matches ? p >= (i + 0.15) / steps.length : s.getBoundingClientRect().top < vh * 0.75;
        s.classList.toggle('on', on);
      });
    }
    track.style.setProperty('--p', p.toFixed(4));
  }
  const req = () => { if (!ticking) { ticking = true; requestAnimationFrame(frame); } };
  if (track) {
    addEventListener('scroll', req, { passive: true });
    addEventListener('resize', req);
    frame();
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

  /* ---------- copy the email address ---------- */
  $$('[data-copy]').forEach(btn => {
    const lbl = $('[data-copy-label]', btn);
    const idle = lbl.textContent;
    let t;
    btn.addEventListener('click', () => {
      const text = btn.dataset.copy;
      const done = ok => {
        lbl.textContent = ok ? 'Copied' : text;
        btn.classList.toggle('done', ok);
        clearTimeout(t);
        t = setTimeout(() => { lbl.textContent = idle; btn.classList.remove('done'); }, 2200);
      };
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => done(true), () => done(false));
      } else done(false); // no clipboard: show the address so it can be selected
    });
  });

  /* ---------- the enquiry ---------- */
  const form = document.getElementById('cf');
  const done = document.getElementById('cfDone');
  if (!form || !done) return;

  const ENDPOINT = form.getAttribute('action') || 'api/send.php';
  const TIMEOUT = 25000;
  const LAST = 4;
  const panes = $$('.cf-step', form);
  const marks = $$('.cf-prog li', form);
  const nowEl = $('[data-step-now]', form);
  const backBtn = $('[data-back]', form);
  const nextBtn = $('[data-next]', form);
  const sendBtn = $('[data-send]', form);
  const label = $('.lbl', sendBtn);
  const labelIdle = label.textContent;
  const alertBox = $('.enq-alert', form);
  const alertText = $('.msg', alertBox);
  const trap = $('input.hp', form);

  // Same rules as the "contact" branch of send.php, so the browser never
  // accepts what the server would reject.
  const RULES = {
    name:    v => v.length >= 2 || 'Please tell us your name.',
    email:   v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) || "That email doesn't look quite right.",
    phone:   v => { if (!v) return true; const d = v.replace(/\D/g, '').length; return (d >= 10 && d <= 13) || 'A 10-digit mobile number, or leave it blank.'; },
    need:    v => v !== '' || 'Pick the closest one. “Something else” is a perfectly good answer.',
    message: v => v.length >= 10 || (v ? 'A little more, please: a sentence or two is plenty.' : 'Tell us a little about the idea, even a sentence.'),
    start:   v => v !== '' || 'Pick one. “Just exploring” is a fine answer.'
  };
  const STEP_FIELDS = { 1: ['name', 'email', 'phone'], 2: ['need'], 3: ['message'], 4: ['start'] };

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

  function setAlert(msg) {
    if (!msg) { alertBox.hidden = true; return; }
    alertText.textContent = msg;
    alertBox.hidden = false;
  }

  let step = 1;
  function go(n, opts) {
    opts = opts || {};
    const back = n < step;
    step = n;
    panes.forEach(p => {
      const on = +p.dataset.step === n;
      p.classList.toggle('is-on', on);
      p.classList.toggle('from-back', on && back);
    });
    marks.forEach((m, i) => {
      m.classList.toggle('on', i + 1 === n);
      m.classList.toggle('done', i + 1 < n);
      if (i + 1 === n) m.setAttribute('aria-current', 'step'); else m.removeAttribute('aria-current');
    });
    nowEl.textContent = n;
    backBtn.hidden = n === 1;
    nextBtn.hidden = n === LAST;
    sendBtn.hidden = n !== LAST;
    setAlert('');
    if (opts.focus === false) return;

    // keep the form's top in view on small screens, then announce the step
    const top = form.getBoundingClientRect().top;
    if (top < 0 || top > innerHeight * 0.6) {
      form.scrollIntoView({ behavior: reduce.matches ? 'auto' : 'smooth', block: 'start' });
    }
    const pane = panes[n - 1];
    const field = back ? null : $('input:not([type=radio]),textarea', pane);
    (field || $('.cf-h', pane)).focus({ preventScroll: true });
  }

  // Validates the fields of one step. Returns true if it may be left.
  function validate(n) {
    let first = null;
    STEP_FIELDS[n].forEach(name => {
      const msg = check(name);
      show(name, msg);
      if (msg && !first) first = name;
    });
    if (!first) return true;
    const b = box(first);
    ($('input:not([type=radio]),textarea', b) || $('input', b)).focus();
    return false;
  }

  // live re-checks once a field has been flagged (or has content and loses focus)
  ['name', 'email', 'phone', 'message'].forEach(name => {
    const el = form.elements[name];
    el.addEventListener('blur', () => { if (el.value.trim() && name !== 'message') show(name, check(name)); });
    el.addEventListener('input', () => { if (box(name).classList.contains('bad')) show(name, check(name)); });
  });
  ['need', 'start'].forEach(name => {
    box(name).addEventListener('change', e => { if (e.target.name === name) show(name, ''); });
  });

  nextBtn.addEventListener('click', () => { if (validate(step)) go(step + 1); });
  backBtn.addEventListener('click', () => go(step - 1));

  // Enter inside a text input moves forward instead of submitting early
  form.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || e.target.tagName !== 'INPUT' || e.target.type === 'radio') return;
    if (step < LAST) { e.preventDefault(); nextBtn.click(); }
  });
  function busy(on) {
    form.classList.toggle('is-sending', on);
    form.setAttribute('aria-busy', String(on));
    sendBtn.disabled = on;
    backBtn.disabled = on;
    label.textContent = on ? 'Sending…' : labelIdle;
    $$('input:not(.hp):not([type=hidden]),textarea', form).forEach(el => {
      if (el.type === 'radio') el.disabled = on; else el.readOnly = on;
    });
  }

  let sending = false;
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (sending) return;
    if (step < LAST) { nextBtn.click(); return; }

    // every step again, in order: jump to the first one that needs a look
    for (let n = 1; n <= LAST; n++) {
      const bad = STEP_FIELDS[n].some(name => check(name));
      if (bad) {
        if (n !== step) go(n, { focus: false });
        validate(n);
        setAlert('One answer on this step needs another look.');
        return;
      }
    }

    // A person never sees the trap field; anything in it is automated.
    // Nothing is sent and nothing is claimed.
    if (trap && trap.value) return;

    const payload = {
      kind: 'contact',
      name: val('name'),
      email: val('email'),
      phone: val('phone'),
      need: val('need'),
      message: val('message'),
      details: val('details'),
      start: val('start'),
      company: trap ? trap.value : '',
      page: 'Contact'
    };

    sending = true;
    setAlert('');
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
        : "No connection, so your enquiry wasn't sent."))
      .then(() => { sending = false; busy(false); });
  });

  function fail(msg) {
    setAlert(msg + ' Everything you wrote is still here. Try again, or send it on WhatsApp.');
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
    Object.keys(RULES).forEach(n => show(n, ''));
    $$('.ok', form).forEach(el => el.classList.remove('ok'));
    done.hidden = true;
    form.hidden = false;
    go(1);
  });

  go(1, { focus: false });
})();
