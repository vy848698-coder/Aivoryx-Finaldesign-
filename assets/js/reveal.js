/* AIVORYX · reveal — fade sections in once, and count numbers up once */
(function () {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const els = document.querySelectorAll('.reveal');
  const counters = document.querySelectorAll('[data-count]');

  if (!('IntersectionObserver' in window)) { els.forEach(el => el.classList.add('in')); return; }

  const io = new IntersectionObserver(entries => entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  els.forEach(el => io.observe(el));

  // <span data-count="8" data-pad="2">08</span> — the markup already holds the final value,
  // so without JS (or with reduced motion) the right number is simply shown.
  //
  // Cheap by design: nothing runs until a number scrolls into view; each one
  // counts once (~1s of requestAnimationFrame, which the browser pauses in a
  // background tab), then its observer lets go. Every number keeps its final
  // width while counting, so nothing around it shifts or re-wraps.
  if (reduce) return;
  const fmt = (el, n) => String(n).padStart(+(el.dataset.pad || 0), '0');
  function count(el) {
    const to = +el.dataset.count, D = to > 9 ? 1200 : 900, t0 = performance.now();
    (function step(t) {
      const p = Math.min(1, (t - t0) / D), e = 1 - Math.pow(1 - p, 4);
      el.textContent = fmt(el, Math.round(to * e));
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  }
  // measure every number first (one layout read), then reset them all to zero
  const widths = [...counters].map(el => el.getBoundingClientRect().width);
  counters.forEach((el, i) => {
    el.style.display = 'inline-block';
    el.style.minWidth = widths[i] + 'px';
    el.textContent = fmt(el, 0);
  });
  const co = new IntersectionObserver(entries => entries.forEach(e => {
    if (e.isIntersecting) { count(e.target); co.unobserve(e.target); }
  }), { threshold: 1, rootMargin: '0px 0px -8% 0px' });
  counters.forEach(el => co.observe(el));
})();
