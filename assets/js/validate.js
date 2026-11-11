/* AIVORYX · validate — the input rules every form uses.
   The server runs the same rules again (api/validate.php). Keep the two in
   step: same limits, same messages. Each check returns '' when the value is
   fine, or a short message written for the visitor.

   window.axV.clean.line / .text / .email  tidy a value (what gets sent)
   window.axV.name / email / phone / text  check a (cleaned) value
   window.axV.since()                      ms since the page opened (bot check) */
(function () {
  const T0 = Date.now();
  const INVISIBLE = /[­​-‏‪-‮⁠-⁤⁦-⁩﻿]/g;
  const lower = s => s.toLowerCase();
  const letters = s => (s.match(/\p{L}/gu) || []).length;
  const nfc = s => (s.normalize ? s.normalize('NFC') : s);

  const clean = {
    line: v => nfc(String(v || '')).replace(INVISIBLE, '').replace(/[\x00-\x1F\x7F]+/g, ' ')
      .replace(/[\s  - 　]+/g, ' ').trim(),
    text: v => nfc(String(v || '')).replace(INVISIBLE, '').replace(/\r\n?/g, '\n')
      .replace(/[\x00-\x08\x0B-\x1F\x7F]/g, '').replace(/\t/g, ' ').replace(/[  ]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n').trim(),
    email: v => lower(clean.line(v).replace(/^mailto:/i, '').replace(/^[\s<>"']+|[\s<>"']+$/g, ''))
  };

  function name(v, required) {
    if (!v) return required === false ? '' : 'Please tell us your name.';
    if (v.includes('@')) return 'That looks like an email address. It goes in the email field.';
    if (/(https?:|www\.|\.(com|in|net|org)\b)/i.test(v)) return 'Just your name here, please. No links.';
    if (/\d/.test(v)) return 'Names don’t usually have numbers in them.';
    if (!/^[\p{L}\p{M}][\p{L}\p{M} .'’-]*$/u.test(v)) return 'Only letters, spaces, hyphens and apostrophes, please.';
    if (letters(v) < 2) return 'Your name needs at least two letters.';
    if ([...v].length > 80) return 'That name is a little long. 80 characters at most.';
    if (v.split(' ').length > 6) return 'Just your name, please. A few words at most.';
    const l = lower(v).replace(/[^\p{L}]/gu, '');
    const fake = ['test', 'testing', 'asdf', 'qwerty', 'name', 'myname', 'abc', 'abcd', 'xyz', 'none', 'na', 'null', 'user', 'admin', 'aaa'];
    if (/^(.)\1+$/u.test(l) || fake.includes(l)) return 'Please enter your real name.';
    if (/^[a-z]{4,}$/.test(l) && !/[aeiouy]/.test(l)) return 'Please enter your real name.';
    return '';
  }

  const TYPOS = {
    'gmial.com': 'gmail.com', 'gmal.com': 'gmail.com', 'gmaill.com': 'gmail.com', 'gnail.com': 'gmail.com',
    'gamil.com': 'gmail.com', 'gmai.com': 'gmail.com', 'gmil.com': 'gmail.com', 'gmaul.com': 'gmail.com',
    'gmali.com': 'gmail.com', 'gemail.com': 'gmail.com', 'gimail.com': 'gmail.com', 'gmail.co': 'gmail.com',
    'gmail.cm': 'gmail.com', 'gmail.om': 'gmail.com', 'gmail.in': 'gmail.com', 'googlemail.co': 'googlemail.com',
    'yaho.com': 'yahoo.com', 'yahooo.com': 'yahoo.com', 'yhoo.com': 'yahoo.com', 'yahho.com': 'yahoo.com',
    'yaoo.com': 'yahoo.com', 'yahoo.co': 'yahoo.com', 'yahoo.cm': 'yahoo.com', 'yahoo.in': 'yahoo.co.in',
    'hotmial.com': 'hotmail.com', 'hotmal.com': 'hotmail.com', 'hotmil.com': 'hotmail.com', 'hotmai.com': 'hotmail.com',
    'hotnail.com': 'hotmail.com', 'homail.com': 'hotmail.com', 'hotmail.co': 'hotmail.com',
    'outlok.com': 'outlook.com', 'outllok.com': 'outlook.com', 'outlool.com': 'outlook.com', 'otlook.com': 'outlook.com',
    'outlook.co': 'outlook.com', 'iclod.com': 'icloud.com', 'icoud.com': 'icloud.com', 'icloud.co': 'icloud.com',
    'redifmail.com': 'rediffmail.com', 'rediffmai.com': 'rediffmail.com', 'rediffmail.co': 'rediffmail.com'
  };
  const DISPOSABLE = ['mailinator.com', 'guerrillamail.com', 'guerrillamail.net', 'sharklasers.com', 'grr.la', '10minutemail.com',
    '10minutemail.net', 'tempmail.com', 'temp-mail.org', 'tempmailo.com', 'tempmail.net', 'yopmail.com', 'yopmail.net',
    'trashmail.com', 'getnada.com', 'nada.email', 'dispostable.com', 'maildrop.cc', 'throwawaymail.com', 'fakeinbox.com',
    'mailnesia.com', 'mintemail.com', 'emailondeck.com', 'moakt.com', 'mohmal.com', 'burnermail.io', 'spamgourmet.com',
    'mailcatch.com', 'mytemp.email', 'tempr.email', 'discard.email', 'inboxkitten.com', 'mail.tm', 'tmail.ws'];
  const BAD_TLD = ['con', 'cmo', 'comm', 'coom', 'c0m', 'cpm', 'xom', 'vom', 'ocm', 'cim', 'cok', 'copm', 'ccom', 'nett', 'ogr', 'rog', 'orgg', 'inn'];

  function email(v, required) {
    if (!v) return required === false ? '' : 'Please add your email so we can reply.';
    if (/\s/.test(v)) return 'Email addresses can’t contain spaces.';
    if (/[,;]/.test(v) || v.split('@').length > 2) return 'Just one email address, please.';
    if (!v.includes('@')) return 'That’s missing the @, e.g. name@company.com.';
    const [local, domain] = v.split('@');
    if (!local) return 'That’s missing the part before the @.';
    if (!domain) return 'That’s missing the part after the @.';
    if (!domain.includes('.')) return 'That’s missing the ending, like .com or .in.';
    if (local.length > 64 || v.length > 254) return 'That email address is too long to be real.';
    if (!/^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/.test(local))
      return 'The part before the @ has a character that isn’t allowed, or a stray dot.';
    const labels = domain.split('.');
    if (labels.some(l => !/^(?!-)[a-z0-9\p{L}\p{M}-]{1,63}$/u.test(l) || l.endsWith('-'))) return 'The part after the @ doesn’t look right.';
    const tld = labels[labels.length - 1];
    if (BAD_TLD.includes(tld)) return 'Check the ending. Did you mean .com?';
    if (!/^([a-z]{2,24}|xn--[a-z0-9-]{2,59}|\p{L}{2,24})$/u.test(tld)) return 'The ending after the last dot doesn’t look right.';
    if (TYPOS[domain]) return 'Did you mean ' + local + '@' + TYPOS[domain] + '?';
    if (DISPOSABLE.includes(domain)) return 'Please use an email you’ll check. That’s where we reply.';
    if (domain === 'aivoryx.com' || domain.endsWith('.aivoryx.com')) return 'That’s our address. We need yours so we can reply.';
    return '';
  }

  // India by default; anywhere else with a country code. Same as ax_v_phone.
  function phone(v, required) {
    if (!v) return required ? 'Please add a phone number.' : '';
    if (/\p{L}/u.test(v) || !/^\+?[\d\s().\-/]+$/.test(v)) return 'Only numbers, spaces, + and dashes, please.';
    if ((v.match(/\+/g) || []).length > 1) return 'Just one + at the start, please.';
    let d = v.replace(/\D/g, ''), intl = v[0] === '+', nat;
    if (/^(\d)\1+$/.test(d)) return 'That doesn’t look like a real number.';
    if (!intl && d.startsWith('00')) { intl = true; d = d.slice(2); }
    if (intl) {
      if (d.length < 8 || d.length > 15) return 'That number looks too short or too long. Check the country code.';
      if (d[0] === '0') return 'Country codes don’t start with 0.';
      if (!d.startsWith('91')) return /^(\d)\1+$/.test(d) ? 'That doesn’t look like a real number.' : '';
      nat = d.slice(2);
    } else {
      if (d.length === 11 && d[0] === '0') d = d.slice(1);
      if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
      if (d.length !== 10) return 'A 10-digit mobile number, or add your country code (e.g. +44…).';
      nat = d;
    }
    if (nat.length !== 10) return 'Indian mobile numbers have 10 digits after +91.';
    if (!/^[6-9]/.test(nat)) return 'Indian mobiles start with 6, 7, 8 or 9. Abroad? Add your country code.';
    if (/^(\d)\1{9}$/.test(nat) || ['9876543210', '6789012345', '9999999999'].includes(nat)) return 'That doesn’t look like a real number.';
    if (nat === '9399593499') return 'That’s our number. We need yours.';
    return '';
  }

  const MASH = 'That doesn’t read like a description. A sentence in your own words is perfect.';
  function text(v, min, max) {
    min = min || 0; max = max || 4000;
    if (!v) return min > 0 ? 'Tell us a little about it, even a sentence.' : '';
    if ([...v].length > max) return 'That’s a bit long. ' + max + ' characters at most.';
    if (/<\s*\/?\s*[a-z][a-z0-9-]*(\s[^<>]*)?\/?\s*>|<!--|<\?php|javascript:/i.test(v))
      return 'Plain text only, please. No HTML or code.';
    if ((v.match(/(https?:\/\/|www\.)/gi) || []).length > 3) return 'A few links is fine, but not more than three.';
    if (/^(.)\1+$/su.test(v.replace(/\s+/g, ''))) return MASH;
    if (/[a-z]{25,}/i.test(v.replace(/\S*(https?:\/\/|www\.)\S*/gi, ''))) return MASH;
    if (min > 0) {
      if ([...v].length < min) return 'A little more, please: a sentence or two is plenty.';
      if (letters(v) < 5) return 'Please describe it in words.';
      if ((v.match(/\p{L}{2,}/gu) || []).length < 2) return 'A little more, please: a sentence or two is plenty.';
    }
    const words = v.match(/\b[a-z]{4,}\b/gi) || [];
    if (words.length >= 3 && words.filter(w => !/[aeiouy]/i.test(w)).length / words.length > 0.5) return MASH;
    return '';
  }

  /* Leaving a field by clicking something else fires "blur" on mouse-down.
     If an error message appears right then, the layout shifts before the
     mouse comes back up and the click lands on empty space (the option
     you clicked doesn't get picked). So while a pointer is down, blur
     work waits until just after the click has happened. */
  let down = false;
  const queue = [];
  addEventListener('pointerdown', () => { down = true; }, true);
  const release = () => { down = false; setTimeout(() => queue.splice(0).forEach(fn => fn()), 0); };
  addEventListener('pointerup', release, true);
  addEventListener('pointercancel', release, true);
  const later = fn => { if (down) queue.push(fn); else fn(); };

  window.axV = { clean, name, email, phone, text, later, since: () => Date.now() - T0 };
})();
