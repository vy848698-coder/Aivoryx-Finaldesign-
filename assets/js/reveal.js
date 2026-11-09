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
  if (reduce) return;
  function count(el) {
    const to = +el.dataset.count, pad = +(el.dataset.pad || 0), D = 1100, t0 = performance.now();
    (function step(t) {
      const p = Math.min(1, (t - t0) / D), e = 1 - Math.pow(1 - p, 4);
      el.textContent = String(Math.round(to * e)).padStart(pad, '0');
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  }
  const co = new IntersectionObserver(entries => entries.forEach(e => {
    if (e.isIntersecting) { count(e.target); co.unobserve(e.target); }
  }), { threshold: 0.6 });
  counters.forEach(el => co.observe(el));
})();
