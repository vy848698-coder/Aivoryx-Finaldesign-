<?php
/* ============================================================
   INPUT RULES — shared by every form branch in send.php.

   The browser runs the same rules (assets/js/validate.js) so people
   see a friendly message as they type; these run again here because
   a request can arrive without ever touching the form. Keep the two
   files in step: same limits, same messages.

   Every ax_v_* function returns '' when the value is fine, or a short
   message written for the visitor. Values are cleaned first (ax_clean_*)
   and the cleaned value is what gets used and emailed.
   ============================================================ */

if (!defined('AX_MAIL')) { http_response_code(403); exit; }


/* ---------- cleaning ---------- */

/* Invisible characters people paste in by accident (or on purpose):
   zero-width spaces/joiners, bidi overrides that can make text read
   backwards in a mail client, the BOM, and soft hyphens. */
function ax_strip_invisible($v) {
  return preg_replace('/[\x{00AD}\x{200B}-\x{200F}\x{202A}-\x{202E}\x{2060}-\x{2064}\x{2066}-\x{2069}\x{FEFF}]/u', '', $v);
}

function ax_nfc($v) {
  if (class_exists('Normalizer')) {
    $n = Normalizer::normalize($v, Normalizer::FORM_C);
    if ($n !== false) return $n;
  }
  return $v;
}

/* One-line fields: no control characters, no line breaks, single spaces. */
function ax_clean_line($v) {
  $v = (string)$v;
  if (!preg_match('//u', $v)) return '';                 // not valid UTF-8: drop it
  $v = ax_strip_invisible(ax_nfc($v));
  $v = preg_replace('/[\x00-\x1F\x7F]+/u', ' ', $v);
  $v = preg_replace('/[\s\x{00A0}\x{2000}-\x{200A}\x{3000}]+/u', ' ', $v);
  return trim($v);
}

/* Multi-line fields: keep line breaks (at most one blank line in a row),
   drop other control characters, trim trailing spaces on each line. */
function ax_clean_text($v) {
  $v = (string)$v;
  if (!preg_match('//u', $v)) return '';
  $v = ax_strip_invisible(ax_nfc($v));
  $v = str_replace(array("\r\n", "\r"), "\n", $v);
  $v = preg_replace('/[\x00-\x08\x0B-\x1F\x7F]/u', '', $v);
  $v = preg_replace('/\t/', ' ', $v);
  $v = preg_replace('/[ \x{00A0}]+\n/u', "\n", $v);
  $v = preg_replace('/\n{3,}/', "\n\n", $v);
  return trim($v);
}

function ax_letters($v) { return preg_match_all('/\p{L}/u', $v); }


/* ---------- name ---------- */
function ax_v_name($v, $required = true) {
  if ($v === '') return $required ? 'Please tell us your name.' : '';
  if (strpos($v, '@') !== false)                       return 'That looks like an email address. It goes in the email field.';
  if (preg_match('~(https?:|www\.|\.(com|in|net|org)\b)~i', $v)) return 'Just your name here, please. No links.';
  if (preg_match('/\d/u', $v))                         return 'Names don’t usually have numbers in them.';
  if (!preg_match('/^[\p{L}\p{M}][\p{L}\p{M} .\'’\-]*$/u', $v)) return 'Only letters, spaces, hyphens and apostrophes, please.';
  if (ax_letters($v) < 2)                              return 'Your name needs at least two letters.';
  if (ax_len($v) > 80)                                 return 'That name is a little long. 80 characters at most.';
  if (count(explode(' ', $v)) > 6)                     return 'Just your name, please. A few words at most.';
  $letters = preg_replace('/[^\p{L}]/u', '', function_exists('mb_strtolower') ? mb_strtolower($v, 'UTF-8') : strtolower($v));
  $fake = array('test', 'testing', 'asdf', 'qwerty', 'name', 'myname', 'abc', 'abcd', 'xyz', 'none', 'na', 'null', 'user', 'admin', 'aaa');
  if (preg_match('/^(.)\1+$/u', $letters) || in_array($letters, $fake, true)) return 'Please enter your real name.';
  // a Latin-only name with no vowel at all (e.g. "xkcdfgh") is a keyboard mash
  if (preg_match('/^[a-z]{4,}$/', $letters) && !preg_match('/[aeiouy]/', $letters)) return 'Please enter your real name.';
  return '';
}


/* ---------- email ---------- */
function ax_clean_email($v) {
  $v = ax_clean_line($v);
  $v = preg_replace('/^mailto:/i', '', $v);
  $v = trim($v, " <>\"'");
  return function_exists('mb_strtolower') ? mb_strtolower($v, 'UTF-8') : strtolower($v);
}

function ax_email_typos() {
  return array(
    'gmial.com' => 'gmail.com', 'gmal.com' => 'gmail.com', 'gmaill.com' => 'gmail.com', 'gnail.com' => 'gmail.com',
    'gamil.com' => 'gmail.com', 'gmai.com' => 'gmail.com', 'gmil.com' => 'gmail.com', 'gmaul.com' => 'gmail.com',
    'gmali.com' => 'gmail.com', 'gemail.com' => 'gmail.com', 'gimail.com' => 'gmail.com', 'gmail.co' => 'gmail.com',
    'gmail.cm' => 'gmail.com', 'gmail.om' => 'gmail.com', 'gmail.in' => 'gmail.com', 'googlemail.co' => 'googlemail.com',
    'yaho.com' => 'yahoo.com', 'yahooo.com' => 'yahoo.com', 'yhoo.com' => 'yahoo.com', 'yahho.com' => 'yahoo.com',
    'yaoo.com' => 'yahoo.com', 'yahoo.co' => 'yahoo.com', 'yahoo.cm' => 'yahoo.com', 'yahoo.in' => 'yahoo.co.in',
    'hotmial.com' => 'hotmail.com', 'hotmal.com' => 'hotmail.com', 'hotmil.com' => 'hotmail.com', 'hotmai.com' => 'hotmail.com',
    'hotnail.com' => 'hotmail.com', 'homail.com' => 'hotmail.com', 'hotmail.co' => 'hotmail.com',
    'outlok.com' => 'outlook.com', 'outllok.com' => 'outlook.com', 'outlool.com' => 'outlook.com', 'otlook.com' => 'outlook.com',
    'outlook.co' => 'outlook.com', 'iclod.com' => 'icloud.com', 'icoud.com' => 'icloud.com', 'icloud.co' => 'icloud.com',
    'redifmail.com' => 'rediffmail.com', 'rediffmai.com' => 'rediffmail.com', 'rediffmail.co' => 'rediffmail.com',
  );
}

function ax_email_disposable() {
  return array('mailinator.com', 'guerrillamail.com', 'guerrillamail.net', 'sharklasers.com', 'grr.la', '10minutemail.com',
    '10minutemail.net', 'tempmail.com', 'temp-mail.org', 'tempmailo.com', 'tempmail.net', 'yopmail.com', 'yopmail.net',
    'trashmail.com', 'getnada.com', 'nada.email', 'dispostable.com', 'maildrop.cc', 'throwawaymail.com', 'fakeinbox.com',
    'mailnesia.com', 'mintemail.com', 'emailondeck.com', 'moakt.com', 'mohmal.com', 'burnermail.io', 'spamgourmet.com',
    'mailcatch.com', 'mytemp.email', 'tempr.email', 'discard.email', 'inboxkitten.com', 'mail.tm', 'tmail.ws');
}

/* Endings that are never real: almost always ".com" mistyped. */
function ax_email_bad_tld() {
  return array('con', 'cmo', 'comm', 'coom', 'c0m', 'cpm', 'xom', 'vom', 'ocm', 'cim', 'cok', 'copm', 'ccom', 'nett', 'ogr', 'rog', 'orgg', 'inn');
}

/* $deep: also look the domain up in DNS (server only; the browser can't). */
function ax_v_email($v, $required = true, $deep = false) {
  if ($v === '') return $required ? 'Please add your email so we can reply.' : '';
  if (preg_match('/\s/u', $v))                        return 'Email addresses can’t contain spaces.';
  if (preg_match('/[,;]/', $v) || substr_count($v, '@') > 1) return 'Just one email address, please.';
  if (strpos($v, '@') === false)                      return 'That’s missing the @, e.g. name@company.com.';
  list($local, $domain) = explode('@', $v, 2);
  if ($local === '')                                  return 'That’s missing the part before the @.';
  if ($domain === '')                                 return 'That’s missing the part after the @.';
  if (strpos($domain, '.') === false)                 return 'That’s missing the ending, like .com or .in.';
  if (strlen($local) > 64 || strlen($v) > 254)        return 'That email address is too long to be real.';
  if (!preg_match('/^[a-z0-9!#$%&\'*+\/=?^_`{|}~-]+(\.[a-z0-9!#$%&\'*+\/=?^_`{|}~-]+)*$/', $local))
    return 'The part before the @ has a character that isn’t allowed, or a stray dot.';
  $labels = explode('.', $domain);
  foreach ($labels as $l) {
    if (!preg_match('/^(?!-)[a-z0-9\p{L}\p{M}-]{1,63}(?<!-)$/u', $l)) return 'The part after the @ doesn’t look right.';
  }
  $tld = end($labels);
  if (in_array($tld, ax_email_bad_tld(), true))       return 'Check the ending. Did you mean .com?';
  if (!preg_match('/^([a-z]{2,24}|xn--[a-z0-9-]{2,59}|\p{L}{2,24})$/u', $tld)) return 'The ending after the last dot doesn’t look right.';
  $typos = ax_email_typos();
  if (isset($typos[$domain]))                         return 'Did you mean ' . $local . '@' . $typos[$domain] . '?';
  if (in_array($domain, ax_email_disposable(), true)) return 'Please use an email you’ll check. That’s where we reply.';
  if ($domain === 'aivoryx.com' || substr($domain, -12) === '.aivoryx.com') return 'That’s our address. We need yours so we can reply.';
  if (preg_match('/^[\x20-\x7E]+$/', $v) && !filter_var($v, FILTER_VALIDATE_EMAIL)) return 'That email doesn’t look quite right.';
  if ($deep && !ax_domain_exists($domain))            return 'We couldn’t find that email’s domain. Please check the spelling.';
  return '';
}

/* A domain that can receive mail has an MX record, or at least an A/AAAA
   record. To avoid ever blocking a real person when the server's own DNS
   is down, the check only counts if a lookup for gmail.com works. */
function ax_domain_exists($domain) {
  if (!function_exists('checkdnsrr')) return true;
  static $dnsWorks = null;
  if ($dnsWorks === null) $dnsWorks = @checkdnsrr('gmail.com', 'MX');
  if (!$dnsWorks) return true;
  $d = function_exists('idn_to_ascii') ? (idn_to_ascii($domain, 0, defined('INTL_IDNA_VARIANT_UTS46') ? INTL_IDNA_VARIANT_UTS46 : 0) ?: $domain) : $domain;
  return @checkdnsrr($d . '.', 'MX') || @checkdnsrr($d . '.', 'A') || @checkdnsrr($d . '.', 'AAAA');
}


/* ---------- phone ----------
   India by default; anywhere else with a country code.
   Returns array(message, normalised) — normalised is "+91 93995 93499"
   style, or "+<digits>" for other countries. */
function ax_v_phone($v, $required = false) {
  if ($v === '') return array($required ? 'Please add a phone number.' : '', '');
  if (preg_match('/\p{L}/u', $v))                    return array('Only numbers, spaces, + and dashes, please.', '');
  if (!preg_match('/^\+?[\d\s().\-\/]+$/', $v))      return array('Only numbers, spaces, + and dashes, please.', '');
  if (substr_count($v, '+') > 1)                     return array('Just one + at the start, please.', '');
  $d = preg_replace('/\D/', '', $v);
  if (preg_match('/^(\d)\1+$/', $d))                 return array('That doesn’t look like a real number.', '');
  $intl = $v[0] === '+';
  if (!$intl && substr($d, 0, 2) === '00') { $intl = true; $d = substr($d, 2); }

  if ($intl) {
    if (strlen($d) < 8 || strlen($d) > 15)           return array('That number looks too short or too long. Check the country code.', '');
    if ($d[0] === '0')                               return array('Country codes don’t start with 0.', '');
    if (substr($d, 0, 2) === '91') { $nat = substr($d, 2); }
    else {
      if (preg_match('/^(\d)\1+$/', $d))             return array('That doesn’t look like a real number.', '');
      return array('', '+' . $d);
    }
  } else {
    if (strlen($d) === 11 && $d[0] === '0') $d = substr($d, 1);           // 0 trunk prefix
    if (strlen($d) === 12 && substr($d, 0, 2) === '91') $d = substr($d, 2); // 91 without +
    if (strlen($d) !== 10)                           return array('A 10-digit mobile number, or add your country code (e.g. +44…).', '');
    $nat = $d;
  }
  if (strlen($nat) !== 10)                           return array('Indian mobile numbers have 10 digits after +91.', '');
  if (!preg_match('/^[6-9]/', $nat))                 return array('Indian mobiles start with 6, 7, 8 or 9. Abroad? Add your country code.', '');
  if (preg_match('/^(\d)\1{9}$/', $nat) || in_array($nat, array('9876543210', '6789012345', '9999999999'), true))
    return array('That doesn’t look like a real number.', '');
  if ($nat === '9399593499')                         return array('That’s our number. We need yours.', '');
  return array('', '+91 ' . substr($nat, 0, 5) . ' ' . substr($nat, 5));
}


/* ---------- free text (idea, message, details, budget note) ----------
   $min = 0 for optional fields: then only the "is this sensible" checks run
   if something was typed. */
function ax_v_text($v, $min = 0, $max = 4000) {
  if ($v === '') return $min > 0 ? 'Tell us a little about it, even a sentence.' : '';
  if (ax_len($v) > $max)                              return 'That’s a bit long. ' . $max . ' characters at most.';
  if (preg_match('/<\s*\/?\s*[a-z][a-z0-9-]*(\s[^<>]*)?\/?\s*>|<!--|<\?php|javascript:/i', $v))
    return 'Plain text only, please. No HTML or code.';
  if (preg_match_all('~(https?://|www\.)~i', $v) > 3) return 'A few links is fine, but not more than three.';
  $flat = preg_replace('/\s+/u', '', $v);
  if (preg_match('/^(.)\1+$/us', $flat))              return 'That doesn’t read like a description. A sentence in your own words is perfect.';
  // keyboard mash: a long run of letters with no space ("asdkjhaskjdhaskjdh")
  if (preg_match('/[a-z]{25,}/i', preg_replace('~\S*(https?://|www\.)\S*~i', '', $v))) return 'That doesn’t read like a description. A sentence in your own words is perfect.';
  if ($min > 0) {
    if (ax_len($v) < $min)                            return 'A little more, please: a sentence or two is plenty.';
    if (ax_letters($v) < 5)                           return 'Please describe it in words.';
    if (preg_match_all('/\p{L}{2,}/u', $v) < 2)      return 'A little more, please: a sentence or two is plenty.';
  }
  // mostly vowel-less Latin "words" is a mash too
  preg_match_all('/\b[a-z]{4,}\b/i', $v, $m);
  if (count($m[0]) >= 3) {
    $noVowel = 0;
    foreach ($m[0] as $w) if (!preg_match('/[aeiouy]/i', $w)) $noVowel++;
    if ($noVowel / count($m[0]) > 0.5)                return 'That doesn’t read like a description. A sentence in your own words is perfect.';
  }
  return '';
}
