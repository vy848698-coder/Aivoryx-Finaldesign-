/* AIVORYX · post — one JSON POST to api/send.php, shared by every form.
   Resolves { status, data } (data is null when the reply isn't our JSON);
   rejects on a network error or timeout (err.name === 'AbortError').

   BigRock's bot filter answers a .php request without its "humans_NNNN"
   cookie with a 409 page that sets the cookie and reloads. Static pages are
   never challenged, so the first POST always meets it: read the cookie from
   that page, set it, and retry once. */
window.axPost = function axPost(endpoint, payload, timeout) {
  timeout = timeout || 25000;
  function go(canRetry) {
    const ctrl = 'AbortController' in window ? new AbortController() : null;
    const timer = ctrl && setTimeout(() => ctrl.abort(), timeout);
    return fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(payload),
      signal: ctrl ? ctrl.signal : undefined
    })
      .then(res => res.text().then(body => {
        if (timer) clearTimeout(timer);
        const m = /document\.cookie\s*=\s*["']([^"';]+)/.exec(body);
        if (canRetry && m && !res.ok) {
          document.cookie = m[1] + '; path=/; SameSite=Lax';
          return go(false);
        }
        let data = null;
        try { data = JSON.parse(body); } catch (e) { /* not our endpoint talking */ }
        return { status: res.status, data };
      }))
      .catch(err => { if (timer) clearTimeout(timer); throw err; });
  }
  return go(true);
};
