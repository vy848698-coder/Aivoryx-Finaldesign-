<?php
/* ============================================================
   ENQUIRY ENDPOINT

   Takes the quote form, emails it to the inbox in config.php, and
   sends the enquirer a short confirmation.

   The client already validates, but everything here is checked
   again from scratch: the browser is not where the rules live,
   and a POST can arrive without ever touching the form.
   ============================================================ */

define('AX_MAIL', 1);

/* XAMPP ships date.timezone=Europe/Berlin and shared hosts vary, so the
   timezone is pinned here rather than inherited. It sets two things that
   are wrong otherwise: the Date header, which should agree with where the
   mail actually originates, and the "Received" time the owner reads. */
date_default_timezone_set('Asia/Kolkata');

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

function ax_out($ok, $msg, $code = 200) {
  /* A successful send marks this enquiry, so a repeat within 15 minutes
     is acknowledged without a second email (see "Duplicates"). */
  if ($ok && !empty($GLOBALS['axDupFile'])) @touch($GLOBALS['axDupFile']);
  http_response_code($code);
  echo json_encode(array('ok' => $ok, 'message' => $msg));
  exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  header('Allow: POST');
  ax_out(false, 'Method not allowed.', 405);
}

/* Same-origin only. Browsers attach Origin to cross-site POSTs, so another
   site can't make its visitors' browsers submit this form. Requests with no
   Origin (some privacy tools strip it) are still accepted; the honeypot,
   validation and rate limit below handle those. */
if (!empty($_SERVER['HTTP_ORIGIN'])) {
  $oHost = strtolower((string) parse_url($_SERVER['HTTP_ORIGIN'], PHP_URL_HOST));
  $sHost = strtolower(preg_replace('/:\d+$/', '', isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : ''));
  if ($oHost === '' || $oHost !== $sHost) {
    ax_out(false, 'Forbidden.', 403);
  }
}

$cfgFile = __DIR__ . '/config.php';
if (!is_file($cfgFile)) {
  error_log('[aivoryx] api/config.php is missing — copy config.example.php and fill it in');
  ax_out(false, "The form isn't connected yet. Please use WhatsApp for now.", 500);
}
$cfg = require $cfgFile;

require __DIR__ . '/mailer.php';


/* ---------------- Input ----------------
   Accepts JSON or a normal form post, so the endpoint still works
   if JavaScript is ever taken out of the path. */
$ctype = '';
if (isset($_SERVER['CONTENT_TYPE']))           $ctype = $_SERVER['CONTENT_TYPE'];
elseif (isset($_SERVER['HTTP_CONTENT_TYPE']))  $ctype = $_SERVER['HTTP_CONTENT_TYPE'];

$raw = file_get_contents('php://input', false, null, 0, 65537);
if (strlen($raw) > 65536) ax_out(false, 'That\'s more than the form can take.', 413);
$in  = array();
if ($raw !== '' && stripos($ctype, 'json') !== false) {
  $in = json_decode($raw, true);
  if (!is_array($in)) $in = array();
} else {
  $in = $_POST;
}

/* mbstring is normally present on cPanel but is not guaranteed, and a
   missing extension here would be a fatal error on a live form. */
function ax_len($v)      { return function_exists('mb_strlen') ? mb_strlen($v, 'UTF-8') : strlen($v); }
function ax_cut($v, $n)  { return function_exists('mb_substr') ? mb_substr($v, 0, $n, 'UTF-8') : substr($v, 0, $n); }

function ax_field($in, $k, $max = 2000) {
  $v = isset($in[$k]) && is_scalar($in[$k]) ? trim((string)$in[$k]) : '';
  return ax_cut($v, $max);
}

require __DIR__ . '/validate.php';

$kind = ax_field($in, 'kind', 20);
/* "quick" = the homepage popup: a name (optional) and ONE way to reach
   them, email or phone. A name alone can't be answered, so it isn't enough. */
$quick   = $kind === 'quick';
/* "pricing" = the How-we-price page (pricing.html). Its own fixed choices,
   no rupee ranges: the visitor may share a budget in their own words
   (budget_note, optional) or not at all. Phone is optional there. */
$pricing = $kind === 'pricing';
/* "contact" = the Contact page (contact.html): a four-step enquiry. Name,
   email, a need, the idea in their words and when they plan to start.
   Phone and extra details are optional; budget is never asked. */
$contact = $kind === 'contact';

/* Everything is cleaned before it is checked, and the cleaned value is what
   gets emailed: invisible characters, control characters and stray
   whitespace never reach the inbox. */
$name       = ax_clean_line(ax_field($in, 'name', 200));
$email      = ax_clean_email(ax_field($in, 'email', 300));
$phone      = ax_clean_line(ax_field($in, 'phone', 60));
$message    = ax_clean_text(ax_field($in, 'message', 6000));
$details    = ax_clean_text(ax_field($in, 'details', 3000));
$budgetNote = ax_clean_line(ax_field($in, 'budget_note', 300));
$page       = ax_clean_line(ax_field($in, 'page', 200));
$need       = ax_field($in, 'need', 120);
$budget     = ax_field($in, 'budget', 120);
$build      = ax_field($in, 'build', 120);
$budgetMode = ax_field($in, 'budget_mode', 120);
$priority   = ax_field($in, 'priority', 120);
$direction  = ax_field($in, 'direction', 40);
$start      = ax_field($in, 'start', 60);


/* ---------------- Bots ----------------
   Answer as though it worked. Telling a bot it failed only tells it
   what to change next time.
   - the honeypot: JS forms send it as "company"; a plain form post
     (no JavaScript) sends the field's own name, "ax_hp"
   - speed: the forms send "t", milliseconds since the page opened.
     Nobody reads a form and types a real enquiry in under 3 seconds. */
if (ax_field($in, 'company', 200) !== '' || ax_field($in, 'ax_hp', 200) !== '') {
  ax_out(true, 'Thanks — we\'ll be in touch.');
}
$elapsed = ax_field($in, 't', 12);
if ($elapsed !== '' && ctype_digit($elapsed) && (int)$elapsed < 3000) {
  ax_out(true, 'Thanks — we\'ll be in touch.');
}


/* ---------------- Validation ----------------
   $fields maps a form field to the message the visitor should see next
   to it. The forms show these, so even a rule only the server can apply
   (the email domain lookup) lands on the right field. */
$fields = array();
$deep   = !isset($cfg['check_email_domain']) || $cfg['check_email_domain'];
function ax_err(&$fields, $k, $msg) { if ($msg !== '' && !isset($fields[$k])) $fields[$k] = $msg; }

if ($quick) {
  ax_err($fields, 'name', ax_v_name($name, false));
  if ($email === '' && $phone === '') {
    ax_err($fields, 'reach', 'Leave an email or a phone number so we can reply.');
  }
  ax_err($fields, 'reach', ax_v_email($email, false, $deep));
  list($pErr, $pNorm) = ax_v_phone($phone, false);
  ax_err($fields, 'reach', $pErr);
} else {
  ax_err($fields, 'name',  ax_v_name($name, true));
  ax_err($fields, 'email', ax_v_email($email, true, $deep));
  /* phone: required on the homepage enquiry, optional elsewhere */
  list($pErr, $pNorm) = ax_v_phone($phone, !$pricing && !$contact);
  ax_err($fields, 'phone', $pErr);
}

if ($pricing) {
  /* Must match the radio values in pricing.html exactly. */
  $builds     = array('Business website', 'E-commerce website', 'Web application', 'SaaS product',
                      'AI-powered solution', 'Mobile application', 'Custom digital solution', 'Not sure yet');
  $modes      = array('I have a budget in mind', "I'd like help deciding",
                      "I'd prefer to discuss this personally", 'I want to share my budget privately');
  $priorities = array('Premium design and experience', 'Features and functionality',
                      'Getting started within my budget', 'Scalability and long-term growth', 'A balanced approach');
  $directions = array('', 'Get started', 'Grow further', 'Think bigger');
  if (!in_array($build, $builds, true))          ax_err($fields, 'build', 'Pick the closest one.');
  if (!in_array($budgetMode, $modes, true))      ax_err($fields, 'budget_mode', 'Choose whichever feels right.');
  if (!in_array($priority, $priorities, true))   ax_err($fields, 'priority', 'Pick one.');
  if (!in_array($direction, $directions, true))  $direction = '';
  ax_err($fields, 'budget_note', ax_v_text($budgetNote, 0, 200));
  ax_err($fields, 'message', ax_v_text($message, 0, 4000));
} elseif ($contact) {
  /* Must match the radio values in contact.html exactly. */
  $cNeeds  = array('Business website', 'Web application', 'Mobile application', 'E-commerce store',
                   'AI assistant / automation', 'Something else');
  $cStarts = array('Immediately', 'Within a month', 'In 2–3 months', 'Just exploring');
  if (!in_array($need, $cNeeds, true))           ax_err($fields, 'need', 'Pick the closest one.');
  ax_err($fields, 'message', ax_v_text($message, 10, 4000));
  ax_err($fields, 'details', ax_v_text($details, 0, 2000));
  if (!in_array($start, $cStarts, true))         ax_err($fields, 'start', 'Pick one.');
} elseif (!$quick) {
  /* The homepage enquiry. Fixed choices only, so the confirmation email
     can only ever repeat text we wrote. */
  $needs   = array('Business website', 'Web application', 'Mobile app', 'Online store', 'AI automation', 'Other');
  $budgets = array('Under ₹8,000', '₹8,000 – ₹15,000', '₹15,000 – ₹25,000', '₹25,000+', "Tell me what's realistic");
  if (!in_array($need, $needs, true))            ax_err($fields, 'need', 'Pick whichever is closest.');
  if (!in_array($budget, $budgets, true))        ax_err($fields, 'budget', 'Pick a range.');
  ax_err($fields, 'message', ax_v_text($message, 0, 4000));
}

if ($fields) {
  http_response_code(422);
  echo json_encode(array('ok' => false,
    'message' => count($fields) === 1 ? 'One detail needs another look.' : count($fields) . ' details need another look.',
    'fields'  => $fields));
  exit;
}

/* From here on the phone is the tidy, international form. */
$phone  = isset($pNorm) ? $pNorm : '';
$digits = preg_replace('/\D/', '', $phone);


/* ---------------- Duplicates ----------------
   A double-click, a retry after a slow network, or Back + Send again:
   the same enquiry within 15 minutes is acknowledged but not emailed
   twice. Best-effort, like the rate limit. */
$dupFile = sys_get_temp_dir() . '/ax_dd_' . substr(sha1($kind . '|' . $name . '|' . $email . '|' . $phone . '|' . $message . '|' . $details), 0, 24);
if (is_file($dupFile) && time() - (int)@filemtime($dupFile) < 900) {
  ax_out(true, $email !== '' ? 'Sent. We\'ll reply to ' . $email . ' the same working day.' : 'Got it. We\'ll be in touch the same working day.');
}
$GLOBALS['axDupFile'] = $dupFile;


/* ---------------- Rate limit ----------------
   One small file per IP in the system temp directory, so nothing
   in the web root has to be writable. Best-effort by design: if
   the filesystem says no, a real enquiry still gets through. */
$limit = isset($cfg['rate_limit']) ? (int)$cfg['rate_limit'] : 6;
if ($limit > 0) {
  $ip   = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '0.0.0.0';
  $file = sys_get_temp_dir() . '/ax_rl_' . substr(sha1($ip), 0, 20);
  $now  = time();
  $hits = array();
  if (is_readable($file)) {
    $prev = json_decode((string)@file_get_contents($file), true);
    if (is_array($prev)) $hits = $prev;
  }
  $hits = array_values(array_filter($hits, function ($t) use ($now) { return $now - (int)$t < 3600; }));
  if (count($hits) >= $limit) {
    ax_out(false, 'That\'s a few enquiries in a short time. Please try again later, or message us on WhatsApp.', 429);
  }
  $hits[] = $now;
  @file_put_contents($file, json_encode($hits), LOCK_EX);
}


/* ---------------- The two emails ----------------
   Deliberately plain: black text on white, one ordinary font, no
   logo, no colour, no buttons. They should read like a letter a
   person typed, not a template. */
$site     = rtrim(isset($cfg['site']) ? $cfg['site'] : '', '/');
$siteHost = preg_replace('~^https?://~', '', $site);
$when     = date('j F Y, g:i a');

function ax_e($v) { return htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8'); }

/* One wrapper for both: a single column of 15px Arial, the way a
   mail client sets a message someone wrote by hand. */
function ax_letter($inner) {
  return '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;'
    . 'line-height:1.6;color:#222222;max-width:600px">' . $inner . '</div>';
}
function ax_p($html, $extra = '') {
  return '<p style="margin:0 0 14px' . $extra . '">' . $html . '</p>';
}

/* wa.me / tel: need a country code. A bare 10-digit Indian mobile
   has none, so add 91 rather than build a link that silently fails. */
$waNum = strlen($digits) === 10 ? '91' . $digits : $digits;


/* ----- Quick lead (homepage popup) — one short note to the owner ----- */
if ($quick) {
  $who  = $name !== '' ? $name : ($email !== '' ? $email : $phone);
  $rows = array();
  if ($name !== '')  $rows['Name']  = ax_e($name);
  if ($phone !== '') $rows['Phone'] = '<a href="tel:+' . ax_e($waNum) . '" style="color:#222222">' . ax_e($phone) . '</a>';
  if ($email !== '') $rows['Email'] = '<a href="mailto:' . ax_e($email) . '" style="color:#222222">' . ax_e($email) . '</a>';
  $rowsHtml = '';
  foreach ($rows as $k => $v) {
    $rowsHtml .= '<tr><td style="padding:3px 16px 3px 0;color:#666666;vertical-align:top;white-space:nowrap">'
      . $k . ':</td><td style="padding:3px 0;vertical-align:top">' . $v . '</td></tr>';
  }
  $howTo = $email !== '' ? 'Reply to this email to answer them directly.'
         : ($phone !== '' ? 'Call or WhatsApp them on the number above.'
         : 'Only a name was left — no way to reach them was given.');

  $html = ax_letter(
      ax_p('Someone left their details in the welcome popup on the homepage.')
    . '<table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#222222">'
    . $rowsHtml . '</table>'
    . ax_p(ax_e($howTo))
    . '<p style="margin:20px 0 0;font-size:13px;color:#888888">Sent from the popup on '
    . ax_e($page !== '' ? $page : 'the website') . ' &middot; ' . ax_e($when) . '</p>'
  );
  $text = "Someone left their details in the welcome popup on the homepage.\n\n"
    . ($name !== ''  ? "Name:  " . $name  . "\n" : '')
    . ($phone !== '' ? "Phone: " . $phone . "\n" : '')
    . ($email !== '' ? "Email: " . $email . "\n" : '')
    . "\n" . $howTo . "\n\nSent from the popup on " . ($page !== '' ? $page : 'the website') . " - " . $when . "\n";

  try {
    ax_send($cfg, $cfg['to'], $cfg['to_name'], 'Quick lead from the website: ' . $who, $html, $text,
      $email !== '' ? $email : null, $name);
  } catch (Exception $e) {
    error_log('[aivoryx] quick lead send failed: ' . $e->getMessage());
    ax_out(false, "We couldn't send that just now. Please try WhatsApp, or call us.", 502);
  }
  ax_out(true, 'Got it. We\'ll be in touch the same working day.');
}

/* ----- How-we-price enquiry — owner note + a confirmation that repeats
   only fixed choices (never budget_note or the message, which a stranger
   typed). ----- */
if ($pricing) {
  $rows = array('Name' => ax_e($name),
    'Email' => '<a href="mailto:' . ax_e($email) . '" style="color:#222222">' . ax_e($email) . '</a>');
  if ($phone !== '') $rows['Phone'] = '<a href="tel:+' . ax_e($waNum) . '" style="color:#222222">' . ax_e($phone) . '</a>';
  $rows['Wants to build'] = ax_e($build);
  $rows['Budget']         = ax_e($budgetMode);
  if ($budgetNote !== '') $rows['Their words'] = ax_e($budgetNote);
  $rows['Matters most']   = ax_e($priority);
  if ($direction !== '')  $rows['Starting point'] = ax_e($direction);

  $rowsHtml = '';
  foreach ($rows as $k => $v) {
    $rowsHtml .= '<tr><td style="padding:3px 16px 3px 0;color:#666666;vertical-align:top;white-space:nowrap">'
      . $k . ':</td><td style="padding:3px 0;vertical-align:top">' . $v . '</td></tr>';
  }
  $ownerHtml = ax_letter(
      ax_p('A new enquiry has come in through the How we price page.')
    . '<table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#222222">'
    . $rowsHtml . '</table>'
    . ($message !== '' ? ax_p('<span style="color:#666666">Project information:</span><br>' . nl2br(ax_e($message))) : '')
    . ax_p('Reply to this email to answer ' . ax_e($name) . ' directly.')
    . '<p style="margin:20px 0 0;font-size:13px;color:#888888">Sent from the form on '
    . ax_e($page !== '' ? $page : 'the website') . ' &middot; ' . ax_e($when) . '</p>'
  );
  $ownerText = "A new enquiry has come in through the How we price page.\n\n";
  foreach ($rows as $k => $v) $ownerText .= str_pad($k . ':', 16) . html_entity_decode(strip_tags($v), ENT_QUOTES, 'UTF-8') . "\n";
  $ownerText .= ($message !== '' ? "\nProject information:\n" . $message . "\n" : '')
    . "\nReply to this email to answer " . $name . " directly.\n\n"
    . "Sent from the form on " . ($page !== '' ? $page : 'the website') . " - " . $when . "\n";

  try {
    ax_send($cfg, $cfg['to'], $cfg['to_name'], 'Website enquiry from ' . $name . ' (How we price)',
      $ownerHtml, $ownerText, $email, $name);
  } catch (Exception $e) {
    error_log('[aivoryx] pricing enquiry send failed: ' . $e->getMessage());
    ax_out(false, "We couldn't send that just now. Please try WhatsApp, or call us.", 502);
  }

  if (!empty($cfg['autoreply'])) {
    $first = preg_split('/\s+/', $name);
    $first = ax_cut($first[0], 30);
    if (!preg_match('/^[\p{L}\p{M}\'’-]+$/u', $first)) $first = 'there';
    $replyHtml = ax_letter(
        ax_p('Dear ' . ax_e($first) . ',')
      . ax_p('Thank you for telling us about your project. We have your answers and '
          . 'will get back to you the same working day.')
      . ax_p('For your reference, you told us:')
      . '<p style="margin:0 0 14px;padding-left:14px;border-left:2px solid #dddddd;color:#555555">'
      . ax_e($build) . '<br>' . ax_e($budgetMode) . '<br>Matters most: ' . ax_e($priority) . '</p>'
      . ax_p('Nothing is agreed or payable until you have a written proposal in front of you and are happy with it.')
      . ax_p('If you need to reach us sooner, you can call or WhatsApp us on +91 93995 93499.')
      . ax_p('Kind regards,<br>Aivoryx'
          . ($site ? '<br><a href="' . ax_e($site) . '" style="color:#222222">' . ax_e($siteHost) . '</a>' : ''),
          ';margin-top:20px')
    );
    $replyText = "Dear " . $first . ",\n\n"
      . "Thank you for telling us about your project. We have your answers and will get back to you the same working day.\n\n"
      . "For your reference, you told us:\n\n  " . $build . "\n  " . $budgetMode . "\n  Matters most: " . $priority . "\n\n"
      . "Nothing is agreed or payable until you have a written proposal in front of you and are happy with it.\n\n"
      . "If you need to reach us sooner, you can call or WhatsApp us on +91 93995 93499.\n\n"
      . "Kind regards,\nAivoryx\n" . ($site ? $siteHost . "\n" : '');
    try {
      ax_send($cfg, $email, $name, 'Thank you for telling us about your project', $replyHtml, $replyText, $cfg['to'], $cfg['to_name'], true);
    } catch (Exception $e) {
      error_log('[aivoryx] pricing auto-reply failed: ' . $e->getMessage());
    }
  }
  ax_out(true, 'Sent. We\'ll reply to ' . $email . ' the same day.');
}

/* ----- Contact page enquiry — owner note + a confirmation that repeats
   only fixed choices (never the idea or details, which a stranger typed). ----- */
if ($contact) {
  $rows = array('Name' => ax_e($name),
    'Email' => '<a href="mailto:' . ax_e($email) . '" style="color:#222222">' . ax_e($email) . '</a>');
  if ($phone !== '') $rows['Phone'] = '<a href="tel:+' . ax_e($waNum) . '" style="color:#222222">' . ax_e($phone) . '</a>';
  $rows['Needs']        = ax_e($need);
  $rows['Plans to start'] = ax_e($start);

  $rowsHtml = '';
  foreach ($rows as $k => $v) {
    $rowsHtml .= '<tr><td style="padding:3px 16px 3px 0;color:#666666;vertical-align:top;white-space:nowrap">'
      . $k . ':</td><td style="padding:3px 0;vertical-align:top">' . $v . '</td></tr>';
  }
  $ownerHtml = ax_letter(
      ax_p('A new enquiry has come in through the Contact page.')
    . '<table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#222222">'
    . $rowsHtml . '</table>'
    . ax_p('<span style="color:#666666">The idea:</span><br>' . nl2br(ax_e($message)))
    . ($details !== '' ? ax_p('<span style="color:#666666">Additional details:</span><br>' . nl2br(ax_e($details))) : '')
    . ax_p('Reply to this email to answer ' . ax_e($name) . ' directly.')
    . '<p style="margin:20px 0 0;font-size:13px;color:#888888">Sent from the form on '
    . ax_e($page !== '' ? $page : 'the website') . ' &middot; ' . ax_e($when) . '</p>'
  );
  $ownerText = "A new enquiry has come in through the Contact page.\n\n";
  foreach ($rows as $k => $v) $ownerText .= str_pad($k . ':', 16) . html_entity_decode(strip_tags($v), ENT_QUOTES, 'UTF-8') . "\n";
  $ownerText .= "\nThe idea:\n" . $message . "\n"
    . ($details !== '' ? "\nAdditional details:\n" . $details . "\n" : '')
    . "\nReply to this email to answer " . $name . " directly.\n\n"
    . "Sent from the form on " . ($page !== '' ? $page : 'the website') . " - " . $when . "\n";

  try {
    ax_send($cfg, $cfg['to'], $cfg['to_name'], 'Website enquiry from ' . $name . ' (Contact)',
      $ownerHtml, $ownerText, $email, $name);
  } catch (Exception $e) {
    error_log('[aivoryx] contact enquiry send failed: ' . $e->getMessage());
    ax_out(false, "We couldn't send that just now. Please try WhatsApp, or call us.", 502);
  }

  if (!empty($cfg['autoreply'])) {
    $first = preg_split('/\s+/', $name);
    $first = ax_cut($first[0], 30);
    if (!preg_match('/^[\p{L}\p{M}\'’-]+$/u', $first)) $first = 'there';
    $replyHtml = ax_letter(
        ax_p('Dear ' . ax_e($first) . ',')
      . ax_p('Thank you for telling us about your idea. Your enquiry has been received, and the people '
          . 'who would build it will read it and get back to you the same working day.')
      . ax_p('For your reference, you told us:')
      . '<p style="margin:0 0 14px;padding-left:14px;border-left:2px solid #dddddd;color:#555555">'
      . ax_e($need) . '<br>Planning to start: ' . ax_e($start) . '<br><br>Plus the description you wrote — we have it.</p>'
      . ax_p('Nothing is agreed or payable until you have a written proposal in front of you and are happy with it.')
      . ax_p('If you need to reach us sooner, you can call or WhatsApp us on +91 93995 93499.')
      . ax_p('Kind regards,<br>Aivoryx'
          . ($site ? '<br><a href="' . ax_e($site) . '" style="color:#222222">' . ax_e($siteHost) . '</a>' : ''),
          ';margin-top:20px')
    );
    $replyText = "Dear " . $first . ",\n\n"
      . "Thank you for telling us about your idea. Your enquiry has been received, and the people who would build it will read it and get back to you the same working day.\n\n"
      . "For your reference, you told us:\n\n  " . $need . "\n  Planning to start: " . $start . "\n\n  Plus the description you wrote - we have it.\n\n"
      . "Nothing is agreed or payable until you have a written proposal in front of you and are happy with it.\n\n"
      . "If you need to reach us sooner, you can call or WhatsApp us on +91 93995 93499.\n\n"
      . "Kind regards,\nAivoryx\n" . ($site ? $siteHost . "\n" : '');
    try {
      ax_send($cfg, $email, $name, 'Thank you for telling us about your idea', $replyHtml, $replyText, $cfg['to'], $cfg['to_name'], true);
    } catch (Exception $e) {
      error_log('[aivoryx] contact auto-reply failed: ' . $e->getMessage());
    }
  }
  ax_out(true, 'Sent. We\'ll reply to ' . $email . ' the same working day.');
}

/* ----- 1. To the owner ----- */
$rows = array(
  'Name'        => ax_e($name),
  'Phone'       => '<a href="tel:+' . ax_e($waNum) . '" style="color:#222222">' . ax_e($phone) . '</a>',
  'Email'       => '<a href="mailto:' . ax_e($email) . '" style="color:#222222">' . ax_e($email) . '</a>',
  'Looking for' => ax_e($need),
  'Budget'      => ax_e($budget),
);
$rowsHtml = '';
foreach ($rows as $k => $v) {
  $rowsHtml .= '<tr><td style="padding:3px 16px 3px 0;color:#666666;vertical-align:top;white-space:nowrap">'
    . $k . ':</td><td style="padding:3px 0;vertical-align:top">' . $v . '</td></tr>';
}

$ownerHtml = ax_letter(
    ax_p('A new enquiry has come in through the website.')
  . '<table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#222222">'
  . $rowsHtml . '</table>'
  . ($message !== ''
      ? ax_p('<span style="color:#666666">Message:</span><br>' . nl2br(ax_e($message)))
      : '')
  . ax_p('Simply reply to this email to answer ' . ax_e($name) . ' directly.')
  . '<p style="margin:20px 0 0;font-size:13px;color:#888888">Sent from the form on '
  . ax_e($page !== '' ? $page : 'the website') . ' &middot; ' . ax_e($when) . '</p>'
);

$ownerText =
    "A new enquiry has come in through the website.\n\n"
  . "Name:        " . $name   . "\n"
  . "Phone:       " . $phone  . "\n"
  . "Email:       " . $email  . "\n"
  . "Looking for: " . $need   . "\n"
  . "Budget:      " . $budget . "\n"
  . ($message !== '' ? "\nMessage:\n" . $message . "\n" : '')
  . "\nSimply reply to this email to answer " . $name . " directly.\n\n"
  . "Sent from the form on " . ($page !== '' ? $page : 'the website') . " - " . $when . "\n";

try {
  ax_send(
    $cfg, $cfg['to'], $cfg['to_name'],
    'Website enquiry from ' . $name,
    $ownerHtml, $ownerText,
    $email, $name                       /* Reply-To, so replying reaches the enquirer */
  );
} catch (Exception $e) {
  error_log('[aivoryx] enquiry send failed: ' . $e->getMessage());
  ax_out(false, "We couldn't send that just now. Please try WhatsApp, or call us.", 502);
}


/* ----- 2. To the enquirer -----
   Best-effort: the enquiry is already safely in the inbox, so a
   bounce here must not report failure to the sender. */
if (!empty($cfg['autoreply'])) {
  /* The auto-reply goes to whatever address was typed in, so it must not
     carry text a stranger wrote — otherwise the form becomes a way to send
     their message (a link, a scam) from our mailbox to anyone. It repeats
     only the fixed choices, and a first name that looks like a name. */
  $first = preg_split('/\s+/', $name);
  $first = ax_cut($first[0], 30);
  if (!preg_match('/^[\p{L}\p{M}\'’-]+$/u', $first)) $first = 'there';

  $replyHtml = ax_letter(
      ax_p('Dear ' . ax_e($first) . ',')
    . ax_p('Thank you for contacting Aivoryx. We have received your enquiry and '
        . 'will get back to you the same working day.')
    . ax_p('For your reference, here is what you sent us:')
    . '<p style="margin:0 0 14px;padding-left:14px;border-left:2px solid #dddddd;color:#555555">'
    . ax_e($need) . '<br>Budget: ' . ax_e($budget)
    . ($message !== '' ? '<br><br>Plus the message you wrote — we have it.' : '')
    . '</p>'
    . ax_p('If you need to reach us sooner, you can call or WhatsApp us on +91 93995 93499.')
    . ax_p('Kind regards,<br>Aivoryx'
        . ($site ? '<br><a href="' . ax_e($site) . '" style="color:#222222">' . ax_e($siteHost) . '</a>' : ''),
        ';margin-top:20px')
  );

  $replyText =
      "Dear " . $first . ",\n\n"
    . "Thank you for contacting Aivoryx. We have received your enquiry and will get back to you the same working day.\n\n"
    . "For your reference, here is what you sent us:\n\n"
    . "  " . $need . "\n"
    . "  Budget: " . $budget . "\n"
    . ($message !== '' ? "\n  Plus the message you wrote - we have it.\n" : '')
    . "\nIf you need to reach us sooner, you can call or WhatsApp us on +91 93995 93499.\n\n"
    . "Kind regards,\nAivoryx\n"
    . ($site ? $siteHost . "\n" : '');

  try {
    ax_send($cfg, $email, $name, 'Thank you for your enquiry', $replyHtml, $replyText, $cfg['to'], $cfg['to_name'], true);
  } catch (Exception $e) {
    error_log('[aivoryx] auto-reply failed: ' . $e->getMessage());
  }
}

ax_out(true, 'Sent. We\'ll reply to ' . $email . ' the same day.');
