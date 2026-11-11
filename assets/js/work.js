/* AIVORYX · work page — reels, pins, real-state tabs, close-ups */
(function () {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ---------- hero: the verb rolls through what the parts do ---------- */
  const rot = document.querySelector('.wt-hero .rot');
  if (rot && !reduce) {
    const words = $$(':scope > span', rot);
    let i = 0, seen = true;
    if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { seen = e.isIntersecting; }).observe(rot);
    setInterval(() => {
      if (!seen || document.hidden) return;
      const cur = words[i];
      i = (i + 1) % words.length;
      cur.className = 'out';
      words[i].className = 'on';
      setTimeout(() => { if (cur.className === 'out') cur.className = ''; }, 650);
    }, 2400);
  }

  /* ---------- hero display: cycles through the case files. Each change is a wipe —
     the new scene sweeps up over the old one ('was' keeps the old one painted
     underneath until it's covered). Hovering a contents row shows that case;
     the rows themselves never change or move. ---------- */
  const peek = document.querySelector('.peek');
  if (peek) {
    const view = peek.querySelector('.peek-view');
    const shots = $$('.sc', view);
    const rows = $$('.toc a[data-peek]');
    const n = peek.querySelector('[data-peek-n]'), t = peek.querySelector('[data-peek-t]');
    // fast enough that a visitor sees several cases before scrolling past:
    // the first scene gets ~1.2s on screen after the hero's entrance, then a change every 2.2s
    const STEP = 2200, FIRST = 2000;
    let cur = 0, timer = 0, wasT = 0, held = false, seen = true, first = true;
    const show = i => {
      if (i !== cur || first) {
        const prev = shots[cur];
        shots.forEach(s => s.classList.toggle('was', !first && s === prev && i !== cur));
        shots.forEach((s, k) => s.classList.toggle('on', k === i));
        if (!first && !reduce) { view.classList.toggle('wipe', false); void view.offsetWidth; view.classList.add('wipe'); }
        clearTimeout(wasT);
        wasT = setTimeout(() => shots.forEach(s => s.classList.toggle('was', false)), 440);
        cur = i; first = false;
        const [num, txt] = rows[i].dataset.peek.split('|');
        if (n) n.textContent = num;
        if (t) t.textContent = txt;
        peek.href = rows[i].getAttribute('href');
      }
      // restart the progress rule
      peek.classList.toggle('run', false); void peek.offsetWidth;
      if (!held && !reduce) peek.classList.add('run');
    };
    const tick = (wait = STEP) => {
      clearTimeout(timer);
      if (reduce) return;
      peek.style.setProperty('--peek-t', wait + 'ms');
      timer = setTimeout(() => {
        if (!held && seen && !document.hidden) show((cur + 1) % rows.length);
        tick();
      }, wait);
    };
    rows.forEach((r, i) => {
      const hold = () => { held = true; show(i); };
      const free = () => { held = false; show(cur); tick(); };
      r.addEventListener('mouseenter', hold); r.addEventListener('focus', hold);
      r.addEventListener('mouseleave', free); r.addEventListener('blur', free);
    });
    peek.addEventListener('mouseenter', () => { held = true; peek.classList.toggle('run', false); });
    peek.addEventListener('mouseleave', () => { held = false; show(cur); tick(); });
    if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { seen = e.isIntersecting; }).observe(peek);
    tick(FIRST); show(0);
  }

  /* ---------- parts tray: clone each row once so the drift loops seamlessly ---------- */
  if (!reduce) {
    $$('.tray-track').forEach(t => {
      $$(':scope > *', t).forEach(a => {
        const c = a.cloneNode(true);
        c.setAttribute('aria-hidden', 'true');
        c.tabIndex = -1;
        t.appendChild(c);
      });
    });
  }

  /* ---------- pins <-> notes: hover or focus either one, both light up ---------- */
  $$('.part, .stage').forEach(box => {
    const pins = $$('.pin', box), notes = $$('.notes li', box);
    const set = n => {
      pins.forEach(p => p.classList.toggle('on', p.dataset.n === n));
      notes.forEach(l => l.classList.toggle('on', l.dataset.n === n));
    };
    [...pins, ...notes].forEach(el => {
      el.addEventListener('mouseenter', () => set(el.dataset.n));
      el.addEventListener('mouseleave', () => set(null));
      el.addEventListener('focus', () => set(el.dataset.n));
      el.addEventListener('blur', () => set(null));
    });
    // a tap on a pin lights its note (a tap also fires focus first, so never toggle here)
    // and, on touch screens, brings that note into view
    pins.forEach(p => p.addEventListener('click', e => {
      e.stopPropagation();
      set(p.dataset.n);
      const li = notes.find(l => l.dataset.n === p.dataset.n);
      if (li && matchMedia('(hover:none)').matches) li.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
    }));
  });

  /* ---------- real-state tabs: swap between captures of the live page ---------- */
  function flipper(root) {
    const btns = $$('button[data-i]', root);
    const panes = $$('img[data-i], .said p[data-i]', root);
    let timer = null;
    const show = i => {
      btns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.i === i)));
      panes.forEach(p => p.classList.toggle('on', p.dataset.i === i));
    };
    btns.forEach(b => b.addEventListener('click', () => { clearInterval(timer); timer = null; show(b.dataset.i); }));
    // Saathi cycles through its languages until someone picks one
    if (root.hasAttribute('data-auto') && !reduce && btns.length > 1) {
      const io = new IntersectionObserver(([e]) => {
        if (e.isIntersecting && timer === null && !root.dataset.stopped) {
          timer = setInterval(() => {
            const cur = btns.findIndex(b => b.getAttribute('aria-pressed') === 'true');
            show(btns[(cur + 1) % btns.length].dataset.i);
          }, 3200);
        } else if (!e.isIntersecting && timer) { clearInterval(timer); timer = null; }
      }, { threshold: .35 });
      io.observe(root);
      btns.forEach(b => b.addEventListener('click', () => { root.dataset.stopped = '1'; }));
    }
  }
  $$('.part.flip, [data-flip]').forEach(flipper);

  /* ---------- reels: arrows, counter, progress, mouse drag ---------- */
  $$('[data-reel]').forEach(reel => {
    const track = reel.querySelector('.reel-track');
    const cards = $$(':scope > *', track);
    const prev = reel.querySelector('.prev'), next = reel.querySelector('.next');
    const count = reel.querySelector('.reel-count b');
    const prog = reel.querySelector('.reel-prog');
    const pad = () => parseFloat(getComputedStyle(track).paddingLeft) || 0;

    const index = () => {
      const x = track.scrollLeft + pad() + 4;
      let i = 0;
      cards.forEach((c, k) => { if (c.offsetLeft <= x) i = k; });
      if (track.scrollLeft + track.clientWidth >= track.scrollWidth - 4) i = cards.length - 1;
      return i;
    };
    const update = () => {
      const i = index(), max = track.scrollWidth - track.clientWidth;
      count.textContent = String(i + 1).padStart(2, '0');
      prog.style.setProperty('--p', max > 0 ? Math.max(.08, track.scrollLeft / max) : 1);
      prev.disabled = track.scrollLeft <= 2;
      next.disabled = track.scrollLeft >= max - 2;
    };
    // step from where the reel actually is (not from the counter, which reads
    // "last card" once a short reel hits its end) so prev never gets stuck
    const go = d => {
      const x = track.scrollLeft, max = track.scrollWidth - track.clientWidth;
      const lefts = cards.map(c => Math.min(max, Math.max(0, c.offsetLeft - pad())));
      const target = d > 0
        ? lefts.find(l => l > x + 4)
        : [...lefts].reverse().find(l => l < x - 4);
      track.scrollTo({ left: target === undefined ? (d > 0 ? max : 0) : target, behavior: reduce ? 'auto' : 'smooth' });
    };
    prev.addEventListener('click', () => go(-1));
    next.addEventListener('click', () => go(1));
    track.addEventListener('keydown', e => {
      if (e.target !== track) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    });
    let raf = 0;
    track.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; update(); }); }, { passive: true });
    addEventListener('resize', update);
    update();

    // drag with a mouse (touch already scrolls natively)
    let down = false, sx = 0, sl = 0, moved = false;
    track.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'mouse' || e.button !== 0 || e.target.closest('button, a')) return;
      down = true; moved = false; sx = e.clientX; sl = track.scrollLeft;
    });
    addEventListener('pointermove', e => {
      if (!down) return;
      const dx = e.clientX - sx;
      if (!moved && Math.abs(dx) > 5) { moved = true; track.classList.add('dragging'); }
      if (moved) track.scrollLeft = sl - dx;
    });
    addEventListener('pointerup', () => {
      if (!down) return;
      down = false;
      if (moved) {
        track.classList.remove('dragging');
        // settle on the nearest card
        const x = track.scrollLeft + pad();
        let best = cards[0];
        cards.forEach(c => { if (Math.abs(c.offsetLeft - x) < Math.abs(best.offsetLeft - x)) best = c; });
        track.scrollTo({ left: best.offsetLeft - pad(), behavior: reduce ? 'auto' : 'smooth' });
        track.dataset.justDragged = '1';
        setTimeout(() => delete track.dataset.justDragged, 60);
      }
    });
  });

  /* ---------- deep links into a reel (#p-04-2): scroll the reel to that card ---------- */
  function reveal(hash) {
    const el = hash && hash.length > 1 && document.getElementById(hash.slice(1));
    if (!el || !el.classList.contains('part')) return;
    const track = el.closest('.reel-track');
    if (!track) return;
    const pad = parseFloat(getComputedStyle(track).paddingLeft) || 0;
    track.scrollTo({ left: el.offsetLeft - pad, behavior: reduce ? 'auto' : 'smooth' });
    const sec = el.closest('.case');
    if (sec) sec.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    el.animate && !reduce && el.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-6px)' }, { transform: 'translateY(0)' }], { duration: 600, delay: 450, easing: 'ease-out' });
  }
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#p-"]');
    if (!a) return;
    e.preventDefault();
    history.pushState(null, '', a.getAttribute('href'));
    reveal(a.getAttribute('href'));
  });
  addEventListener('hashchange', () => reveal(location.hash));
  if (location.hash.startsWith('#p-')) addEventListener('load', () => reveal(location.hash));

  /* ---------- close-up viewer ---------- */
  const lb = document.getElementById('lb');
  if (lb && lb.showModal) {
    const img = lb.querySelector('img'), cap = lb.querySelector('figcaption b');
    document.addEventListener('click', e => {
      const im = e.target.closest('.shot > img, .q-shot > img, .inset img');
      if (!im) return;
      const track = im.closest('.reel-track');
      if (track && track.dataset.justDragged) return;
      const part = im.closest('.inset, .part, .q, .stage');
      const h = part && part.querySelector('h3, figcaption');
      img.src = im.currentSrc || im.src;
      img.alt = im.alt;
      cap.textContent = h ? h.textContent : im.alt;
      lb.showModal();
    });
    lb.addEventListener('click', e => { if (e.target === lb || e.target.closest('[data-close]')) lb.close(); });
  }

  /* ---------- Case 07: the blank page types a few addresses ---------- */
  const url = document.querySelector('[data-type]');
  if (url && !reduce) {
    const names = ['yourbusiness.com', 'yourclinic.in', 'yourfactory.co', 'yourstore.in', 'yourbusiness.com'];
    let n = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      (function cycle() {
        const word = names[n % names.length];
        let i = word.length;
        const del = setInterval(() => {
          url.textContent = word.slice(0, --i);
          if (i <= 0) {
            clearInterval(del);
            const next = names[++n % names.length];
            let j = 0;
            const add = setInterval(() => {
              url.textContent = next.slice(0, ++j);
              if (j >= next.length) { clearInterval(add); if (n < names.length - 1) setTimeout(cycle, 1600); }
            }, 70);
          }
        }, 35);
      })();
    }, { threshold: .6 });
    io.observe(url);
  }

  /* footer year */
  $$('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });
})();
