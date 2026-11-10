/* AIVORYX · enquiry — the project form in 09 / The conversation.
   Posts to the existing endpoint (api/send.php), which validates again,
   emails admin@aivoryx.com and sends the auto-reply.

   Success is shown ONLY when the server answers { ok:true }. A network
   failure, a timeout, a non-JSON reply (host challenge page, static
   server, 404) or { ok:false } all keep the answers in place and show
   the error with WhatsApp as the other way in. */
(function () {
  const form = document.getElementById('enquiry');
  const done = document.getElementById('enquiryDone');
  if (!form) return;

  const ENDPOINT = form.getAttribute('action') || 'api/send.php';
  const TIMEOUT = 25000;
  const btn = form.querySelector('.enq-send');
  const label = btn.querySelector('.lbl');
  const labelIdle = label.textContent;
  const alertBox = form.querySelector('.enq-alert');
  const alertText = alertBox.querySelector('.msg');
  const trap = form.querySelector('input.hp');

  // Same rules as send.php, so the browser never accepts what the server rejects.
  const RULES = {
    name:   v => v.length >= 2 || 'Please tell us your name.',
    email:  v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) || "That email doesn't look quite right.",
    phone:  v => { const d = v.replace(/\D/g, '').length; return (d >= 10 && d <= 13) || 'A 10-digit mobile number, please.'; },
    need:   v => v !== '' || 'Pick whichever is closest.',
    budget: v => v !== '' || "Pick a range — or “Tell me what's realistic”."
  };
  const ORDER = ['name', 'email', 'phone', 'need', 'budget'];

  const val = name => {
    const el = form.elements[name];
    return el ? String(el.value || '').trim() : '';
  };
  const box = name => form.querySelector('[data-field="' + name + '"]');

  function check(name) {
    const r = RULES[name](val(name));
    return r === true ? '' : r;
  }

  // One place that marks a field, so class, message and aria state never drift apart.
  function show(name, msg) {
    const b = box(name);
    if (!b) return;
    b.classList.toggle('bad', !!msg);
    b.classList.toggle('ok', !msg && val(name) !== '');
    const err = b.querySelector('.f-err');
    if (err) err.textContent = msg;
    const target = b.matches('fieldset') ? b.querySelector('[role="radiogroup"]') : b.querySelector('input,textarea');
    if (target) target.setAttribute('aria-invalid', msg ? 'true' : 'false');
  }

  // Step numbers turn ink once the step is complete — the 01→04 progression.
  function progress() {
    form.querySelectorAll('.step').forEach(step => {
      const names = (step.dataset.needs || '').split(' ').filter(Boolean);
      step.classList.toggle('done', names.length ? names.every(n => !check(n)) : val('message') !== '');
    });
  }

  let tried = false; // after the first submit, errors update live
  ['name', 'email', 'phone'].forEach(name => {
    const el = form.elements[name];
    el.addEventListener('blur', () => { if (tried || el.value.trim()) show(name, check(name)); progress(); });
    el.addEventListener('input', () => {
      if (box(name).classList.contains('bad')) show(name, check(name));
      progress();
    });
  });
  ['need', 'budget'].forEach(name => {
    box(name).addEventListener('change', () => { show(name, ''); progress(); });
  });
  form.elements.message.addEventListener('input', progress);

  function setAlert(msg) {
    if (!msg) { alertBox.hidden = true; return; }
    alertText.textContent = msg;
    alertBox.hidden = false;
  }

  // the POST itself (with BigRock's cookie-challenge retry) lives in post.js
  const post = payload => window.axPost(ENDPOINT, payload, TIMEOUT);

  function busy(on) {
    form.classList.toggle('is-sending', on);
    form.setAttribute('aria-busy', String(on));
    btn.disabled = on;
    label.textContent = on ? 'Sending…' : labelIdle;
    // read-only rather than disabled, so nothing can change mid-flight
    form.querySelectorAll('input:not(.hp),textarea').forEach(el => {
      if (el.type === 'radio') el.disabled = on; else el.readOnly = on;
    });
  }

  let sending = false;
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (sending) return; // one request in flight, ever
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
      const n = form.querySelectorAll('.bad').length;
      setAlert(n === 1 ? 'One answer needs another look.' : n + ' answers need another look.');
      const b = box(first);
      (b.querySelector('input:not([type=radio])') || b.querySelector('input')).focus();
      return;
    }

    // A person never sees the trap field; anything in it is automated.
    // send.php drops such posts too. Nothing is sent and nothing is claimed.
    if (trap && trap.value) return;

    const payload = {
      name: val('name'),
      email: val('email'),
      phone: val('phone'),
      need: val('need'),
      budget: val('budget'),
      message: val('message'),
      company: trap ? trap.value : '',
      page: document.title + ' — homepage enquiry'
    };

    sending = true;
    busy(true);

    post(payload)
      .then(({ status, data }) => {
        if (data && data.ok === true) return succeed(payload.email);
        let msg = data && data.message;
        if (!msg) msg = status === 404 || status === 405 || status === 501
          ? "The form can't reach our inbox from here."
          : "We couldn't send that just now.";
        fail(msg);
      })
      .catch(err => fail(err && err.name === 'AbortError'
        ? 'That took too long to send — it may not have reached us.'
        : 'No connection — your enquiry wasn\'t sent.'))
      .then(() => { sending = false; busy(false); });
  });

  function fail(msg) {
    setAlert(msg + ' Your answers are still here — try again, or send them on WhatsApp.');
    alertBox.focus();
  }

  function succeed(email) {
    done.querySelector('[data-email]').textContent = email;
    form.hidden = true;
    done.hidden = false;
    done.focus();
  }

  done.querySelector('.done-again').addEventListener('click', () => {
    form.reset();
    tried = false;
    ORDER.forEach(n => show(n, ''));
    form.querySelectorAll('.ok').forEach(el => el.classList.remove('ok'));
    progress();
    setAlert('');
    done.hidden = true;
    form.hidden = false;
    form.elements.name.focus();
  });

  /* Package CTAs pre-select the matching answers — only where the visitor
     hasn't already chosen, so nothing they picked is overwritten. Budget is
     left for the visitor: the cards show no prices, so the form doesn't either. */
  const PLANS = {
    starter: { need: 'Business website' },
    growth:  { need: 'Business website' }
  };
  document.querySelectorAll('[data-plan]').forEach(a => a.addEventListener('click', () => {
    const p = PLANS[a.dataset.plan];
    if (!p) return;
    Object.keys(p).forEach(name => {
      if (val(name)) return;
      const r = form.querySelector('input[name="' + name + '"][value="' + p[name] + '"]');
      if (r) r.checked = true;
    });
    progress();
  }));

  const yr = document.querySelector('[data-year]');
  if (yr) yr.textContent = new Date().getFullYear();
})();
