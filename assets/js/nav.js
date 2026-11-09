/* AIVORYX · nav — scrolled state + mobile sheet */
(function () {
  const nav = document.getElementById('nav');
  const burger = document.getElementById('burger');
  const sheet = document.getElementById('sheet');
  if (!nav) return;

  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 8);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // scroll spy — the last section whose top has passed ~35% of the viewport is
  // "current". Tools sits inside Work, so it simply wins once it's reached.
  const spies = [...nav.querySelectorAll('.menu a[data-spy]')]
    .map(a => [a, document.getElementById(a.dataset.spy)]).filter(([, s]) => s);
  let ticking = false;
  function spy() {
    ticking = false;
    const line = innerHeight * 0.35;
    const atEnd = innerHeight + scrollY >= document.documentElement.scrollHeight - 4;
    let cur = spies[0];
    spies.forEach(p => { if (p[1].getBoundingClientRect().top <= line) cur = p; });
    if (atEnd) cur = spies[spies.length - 1]; // short last section still lights up
    spies.forEach(([a]) => a === cur[0] ? a.setAttribute('aria-current', 'location') : a.removeAttribute('aria-current'));
  }
  if (spies.length) {
    addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(spy); } }, { passive: true });
    addEventListener('resize', spy);
    spy();
  }

  if (!burger || !sheet) return;

  function setOpen(open) {
    nav.classList.toggle('open', open);
    document.body.classList.toggle('locked', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    sheet.inert = !open;
  }
  setOpen(false);

  burger.addEventListener('click', () => setOpen(!nav.classList.contains('open')));
  sheet.addEventListener('click', e => { if (e.target.closest('a')) setOpen(false); });
  addEventListener('keydown', e => {
    if (e.key === 'Escape' && nav.classList.contains('open')) { setOpen(false); burger.focus(); }
  });
  matchMedia('(min-width: 1081px)').addEventListener('change', e => { if (e.matches) setOpen(false); });
})();
