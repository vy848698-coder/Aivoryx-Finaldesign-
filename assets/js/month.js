/* AIVORYX · month — keeps "December has room" / "Claim the December slot"
   current without anyone editing the page.

   Every [data-month] gets the month we're taking builds for. From the 25th
   onward that's next month: a build booked that late really starts then.
   Links with data-month-href get the same month in their WhatsApp message.
   The markup holds a sensible month, so without JavaScript it still reads. */
(function () {
  const NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];
  const CUTOFF = 25; // from this day, offer next month instead

  const now = new Date();
  const m = (now.getMonth() + (now.getDate() >= CUTOFF ? 1 : 0)) % 12;
  const month = NAMES[m];

  document.querySelectorAll('[data-month]').forEach(el => { el.textContent = month; });
  document.querySelectorAll('[data-month-href]').forEach(a => {
    a.href = a.dataset.monthHref.replace('{month}', encodeURIComponent(month));
  });
})();
