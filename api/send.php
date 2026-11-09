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
  http_response_code($code);
  echo json_encode(array('ok' => $ok, 'message' => $msg));
  exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  ax_out(false, 'Method not allowed.', 405);
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

$raw = file_get_contents('php://input');
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

$name    = ax_field($in, 'name', 120);
$phone   = ax_field($in, 'phone', 40);
$email   = ax_field($in, 'email', 200);
$need    = ax_field($in, 'need', 120);
$budget  = ax_field($in, 'budget', 120);
$message = ax_field($in, 'message', 4000);
$trap    = ax_field($in, 'company', 200);
$page    = ax_field($in, 'page', 200);


/* ---------------- Honeypot ----------------
   Answer as though it worked. Telling a bot it failed only tells
   it which field to leave alone next time. */
if ($trap !== '') {
  ax_out(true, 'Thanks — we\'ll be in touch.');
}


/* ---------------- Validation ---------------- */
$digits = preg_replace('/\D/', '', $phone);
$errors = array();

if (ax_len($name) < 2)                                     $errors[] = 'name';
if (strlen($digits) < 10 || strlen($digits) > 13)          $errors[] = 'phone';
if (!filter_var($email, FILTER_VALIDATE_EMAIL))            $errors[] = 'email';
if ($need === '')                                          $errors[] = 'need';
if ($budget === '')                                        $errors[] = 'budget';

if ($errors) {
  ax_out(false, 'Some details are missing or look wrong. Please check the form.', 422);
}


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
  $first = preg_split('/\s+/', $name);
  $first = $first[0];

  $replyHtml = ax_letter(
      ax_p('Dear ' . ax_e($first) . ',')
    . ax_p('Thank you for contacting Aivoryx. We have received your enquiry and '
        . 'will get back to you the same working day.')
    . ax_p('For your reference, here is what you sent us:')
    . '<p style="margin:0 0 14px;padding-left:14px;border-left:2px solid #dddddd;color:#555555">'
    . ax_e($need) . '<br>Budget: ' . ax_e($budget)
    . ($message !== '' ? '<br><br>' . nl2br(ax_e($message)) : '')
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
    . ($message !== '' ? "\n  " . str_replace("\n", "\n  ", $message) . "\n" : '')
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
