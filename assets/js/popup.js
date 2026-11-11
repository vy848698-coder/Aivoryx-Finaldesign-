/* AIVORYX · welcome popup — homepage only (this script is only on index.html).

   When:  3 seconds after EVERY homepage load — each refresh, each new tab, each
          visit. Nothing is written to cookies or storage, so it never
          "remembers" a visitor and stays away. Skipped for anyone who arrives
          at, or jumps to, a section (#contact…) or is already at the form.
          If the tab opens in the
          background, the 3 seconds start when it is first looked at.
   Never forced: ×, Esc and a click outside all close it, and it
          waits rather than interrupt someone typing in a form or using the
          mobile menu. Once closed, it stays closed until the next load.
   Sends: an email OR a phone number (required, so we can reply) and an
          optional name to api/send.php as kind:"quick". */
(function () {
  const root = document.getElementById('hello');
  if (!root) return;

  const DELAY = 3000;
  const card = root.querySelector('.hello-card');
  const form = root.querySelector('#helloForm');
  const mark = root.querySelector('.hello-mark');
  const done = root.querySelector('.hello-done');
  const err = root.querySelector('.hello-err');
  const btn = form.querySelector('.hello-send');
  const label = btn.querySelector('.lbl');
  const labelIdle = label.textContent;
  const nameIn = form.elements.name;
  const reachIn = form.elements.reach;
  const trap = form.querySelector('input.hp');
  const ENDPOINT = form.getAttribute('action') || 'api/send.php';
  const WA = 'https://wa.me/919399593499?text=Hi%20Aivoryx%2C%20I%27d%20like%20to%20discuss%20a%20project';
  const behind = [...document.querySelectorAll('body > .skip, body > .nav, body > .sheet, body > main, body > footer')];

  let opened = false, isOpen = false, lastFocus = null;

  /* ---------- timing ---------- */
  function busyElsewhere() {
    const a = document.activeElement;
    const typing = a && a.matches && a.matches('input:not([type=range]),textarea,select') && !root.contains(a);
    return typing || document.body.classList.contains('locked'); // mobile menu open
  }
  /* Only for people who landed on the homepage itself. Anyone sent to a
     section (#contact from "Start a project" on another page, #pricing…)
     or who jumps there before the 3 seconds are up came for that section —
     a popup in front of the form they came to fill in is the irritation. */
  const contact = document.getElementById('contact');
  let skip = !!location.hash && location.hash !== '#top';
  addEventListener('hashchange', () => { if (location.hash && location.hash !== '#top') skip = true; });
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (a && a.getAttribute('href').length > 1 && a.getAttribute('href') !== '#top') skip = true;
  });
  function atForm() {
    if (!contact) return false;
    const r = contact.getBoundingClientRect();
    return r.top < innerHeight && r.bottom > 0;
  }
  function tryOpen() {
    if (opened || skip || atForm()) return;
    if (busyElsewhere()) { setTimeout(tryOpen, 1500); return; }
    open();
  }
  function arm() { setTimeout(tryOpen, DELAY); }
  if (document.visibilityState === 'visible') arm();
  else document.addEventListener('visibilitychange', function once() {
    if (document.visibilityState !== 'visible') return;
    document.removeEventListener('visibilitychange', once);
    arm();
  });

  /* ---------- open / close ---------- */
  /* ---------- live numbers: measured, never typed in ---------- */
  const clockEl = root.querySelector('[data-clock]');
  const kbEl = root.querySelector('[data-kb]');
  let clockTimer = 0;
  const pad = n => String(n).padStart(2, '0');
  function tick() {
    const s = Math.floor(performance.now() / 1000);
    clockEl.textContent = pad(Math.floor(s / 60)) + ':' + pad(s % 60);
  }
  // Self-weight = this window's markup + its own stylesheet and script, as this
  // browser received them (Resource Timing; a cached re-fetch if that is blank).
  function weigh() {
    let bytes = new Blob([root.outerHTML]).size;
    const want = ['assets/css/popup.css', 'assets/js/popup.js'];
    const seen = performance.getEntriesByType('resource');
    const later = [];
    want.forEach(path => {
      const e = seen.find(x => x.name.split('?')[0].endsWith(path));
      const n = e && (e.decodedBodySize || e.encodedBodySize);
      if (n) bytes += n; else later.push(path);
    });
    return Promise.all(later.map(path =>
      fetch(path, { cache: 'force-cache' }).then(r => r.ok ? r.blob() : null).then(b => { if (b) bytes += b.size; }).catch(() => {})
    )).then(() => bytes / 1024);
  }
  function countTo(el, to, fmt) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = fmt(to); return; }
    const t0 = performance.now(), D = 1100;
    (function step(t) {
      const p = Math.min(1, (t - t0) / D), e = 1 - Math.pow(1 - p, 4);
      el.textContent = fmt(to * e);
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  }

  // hovering the mark builds it again
  mark.addEventListener('pointerenter', () => {
    if (!isOpen || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    mark.classList.add('again'); void mark.getBoundingClientRect(); mark.classList.remove('again');
  });

  function open() {
    opened = isOpen = true;
    tick();
    clockTimer = setInterval(tick, 1000);
    weigh().then(kb => setTimeout(() => countTo(kbEl, kb, v => v.toFixed(1) + ' KB'), 500));
    lastFocus = document.activeElement;
    root.hidden = false;
    behind.forEach(el => { el.inert = true; });
    document.body.classList.add('locked');
    void root.offsetWidth;            // commit the hidden state so the entrance plays
    root.classList.add('on');
    card.focus({ preventScroll: true }); // the dialog, not a field — no keyboard pops up on phones
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    clearInterval(clockTimer);
    root.classList.remove('on');
    behind.forEach(el => { el.inert = false; });
    document.body.classList.remove('locked');
    if (lastFocus && lastFocus.focus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
    let finished = false;
    const end = () => { if (!finished) { finished = true; root.hidden = true; } };
    card.addEventListener('transitionend', e => { if (e.target === card) end(); }, { once: true });
    setTimeout(end, 650); // reduced motion has no transition to end
  }

  root.addEventListener('click', e => { if (e.target.closest('[data-close]')) close(); });
  addEventListener('keydown', e => {
    if (!isOpen) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key !== 'Tab') return;
    // keep Tab inside the dialog
    const items = [...card.querySelectorAll('button,a[href],input:not([tabindex="-1"])')]
      .filter(el => el.offsetParent !== null && !el.disabled);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === card)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  /* ---------- the form: a way to reply (required) + a name (optional) ---------- */
  const V = window.axV;
  // the second box takes either; anything made only of digits and phone
  // punctuation is treated as a phone number, everything else as an email
  const phoneish = v => v !== '' && /^[+\d\s().\-/]+$/.test(v);
  const reachVal = () => {
    const raw = V.clean.line(reachIn.value);
    return phoneish(raw) ? raw : V.clean.email(raw);
  };

  // the second field takes either; switch the keyboard hint once it's clear which
  reachIn.addEventListener('input', () => {
    reachIn.setAttribute('inputmode', phoneish(reachIn.value.trim()) ? 'tel' : 'email');
    if (form.classList.contains('bad') || form.classList.contains('bad-name')) say('');
  });
  nameIn.addEventListener('input', () => { if (form.classList.contains('bad-name')) say(''); });

  function say(msg, which) {
    err.innerHTML = '';
    form.classList.remove('bad', 'bad-name');
    reachIn.setAttribute('aria-invalid', 'false');
    nameIn.setAttribute('aria-invalid', 'false');
    if (!msg) return;
    err.append(msg);
    if (which === 'reach') { form.classList.add('bad'); reachIn.setAttribute('aria-invalid', 'true'); }
    if (which === 'name') { form.classList.add('bad-name'); nameIn.setAttribute('aria-invalid', 'true'); }
  }

  function check() {
    const name = V.clean.line(nameIn.value), reach = reachVal();
    const nErr = V.name(name, false);
    if (nErr) return [nErr, 'name'];
    if (!reach) return ['Leave an email or a phone number so we can reply.', 'reach'];
    const rErr = phoneish(reach) ? V.phone(reach, true) : V.email(reach);
    return rErr ? [rErr, 'reach'] : null;
  }
  [nameIn, reachIn].forEach(el => el.addEventListener('blur', () => {
    if (el.value.trim()) el.value = el === nameIn ? V.clean.line(el.value) : reachVal();
  }));

  let sending = false;
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (sending) return;
    const bad = check();
    if (bad) { say(bad[0], bad[1]); (bad[1] === 'name' ? nameIn : reachIn).focus(); return; }
    say('');
    if (trap && trap.value) return; // automated: nothing sent, nothing claimed

    const name = V.clean.line(nameIn.value), reach = reachVal();
    const phone = phoneish(reach) ? reach : '';
    const email = phone ? '' : reach;
    const payload = { kind: 'quick', name, email, phone, company: trap ? trap.value : '', t: V.since(), page: document.title + ' — welcome popup' };

    sending = true;
    form.classList.add('is-sending');
    btn.disabled = true;
    label.textContent = 'Sending…';

    window.axPost(ENDPOINT, payload)
      .then(({ status, data }) => {
        if (data && data.ok === true) return succeed(name, email, phone);
        if (data && data.fields) {
          const k = data.fields.name ? 'name' : 'reach';
          say(data.fields[k], k); (k === 'name' ? nameIn : reachIn).focus(); return;
        }
        let msg = data && data.message;
        if (!msg) msg = status === 404 || status === 405 || status === 501
          ? "This can't reach our inbox from here."
          : "We couldn't send that just now.";
        fail(msg);
      })
      .catch(e2 => fail(e2 && e2.name === 'AbortError' ? 'That took too long to send.' : "No connection — it wasn't sent."))
      .then(() => { sending = false; form.classList.remove('is-sending'); btn.disabled = false; label.textContent = labelIdle; });
  });

  function fail(msg) {
    say(msg + ' ');
    const a = document.createElement('a');
    a.href = WA; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'WhatsApp us instead ↗';
    err.append(a);
  }

  function succeed(name, email, phone) {
    done.querySelector('[data-first]').textContent = name ? ', ' + name.split(/\s+/)[0] : '';
    done.querySelector('[data-via]').textContent = email ? 'at ' + email : phone ? 'on ' + phone : '';
    if (!email && !phone) done.querySelector('.hello-done-p').textContent =
      "Thanks for saying hello. For a reply, the contact form below takes a minute — or WhatsApp us.";
    form.hidden = true;
    done.hidden = false;
    done.focus({ preventScroll: true });
  }
})();
