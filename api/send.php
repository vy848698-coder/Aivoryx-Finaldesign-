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
foreach (array('to', 'from') as $k) {
  if (empty($cfg[$k]) || stripos($cfg[$k], 'CHANGE-ME') !== false) $cfgBad = $k;
}
if (!empty($cfg['smtp']['enabled'])
    && (empty($cfg['smtp']['pass']) || stripos($cfg['smtp']['pass'], 'CHANGE-ME') !== false)) $cfgBad = 'smtp pass';
if (!empty($cfgBad)) {
  error_log('[aivoryx] api/config.php is not filled in yet (' . $cfgBad . ')');
  ax_out(false, "The form isn't connected yet. Please use WhatsApp for now.", 500);
}

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
   Templates live in emails.php: one look for every form. Each form only
   decides what goes in them. */
require __DIR__ . '/emails.php';

$when = date('j F Y, g:i a');
/* A short reference both sides can quote: AX-YYMMDD-XXXX. */
$ref  = 'AX-' . date('ymd') . '-' . strtoupper(bin2hex(random_bytes(2)));
/* wa.me / tel: need a country code. A bare 10-digit Indian mobile
   has none, so add 91 rather than build a link that silently fails. */
$waNum = strlen($digits) === 10 ? '91' . $digits : $digits;

if ($quick) {
  $source   = 'Homepage popup';
  $who      = $name !== '' ? $name : ($email !== '' ? $email : $phone);
  $headline = $who . ' left their details';
  $rows     = array('Name' => $name, 'Email' => $email, 'Phone' => $phone);
  $blocks   = array();
  $subject  = 'New quick lead: ' . $who . ' (homepage popup)';
  $thanks   = 'Thank you for saying hello.';
  $recap    = array('Sent from' => 'The welcome popup on our homepage');
  $wrote    = false;
} elseif ($pricing) {
  $source   = 'How we price page';
  $headline = $name . ' wants: ' . $build;
  $rows     = array('Name' => $name, 'Email' => $email, 'Phone' => $phone,
                    'Wants to build' => $build, 'Budget' => $budgetMode,
                    'Budget, in their words' => $budgetNote,   /* owner only, never in the auto-reply */
                    'Matters most' => $priority, 'Starting point' => $direction);
  $blocks   = array('Project information' => $message);
  $subject  = 'New enquiry: ' . $name . ' (' . $build . ', How we price)';
  $thanks   = 'Thank you for telling us about your project.';
  $recap    = array('Looking to build' => $build, 'Budget' => $budgetMode, 'Matters most' => $priority);
  $wrote    = $message !== '';
} elseif ($contact) {
  $source   = 'Contact page';
  $headline = $name . ' needs: ' . $need;
  $rows     = array('Name' => $name, 'Email' => $email, 'Phone' => $phone,
                    'Needs' => $need, 'Plans to start' => $start);
  $blocks   = array('The idea' => $message, 'Additional details' => $details);
  $subject  = 'New enquiry: ' . $name . ' (' . $need . ', Contact page)';
  $thanks   = 'Thank you for telling us about your idea.';
  $recap    = array('You need' => $need, 'Planning to start' => $start);
  $wrote    = true;
} else {
  $source   = 'Homepage enquiry';
  $headline = $name . ' is looking for: ' . $need;
  $rows     = array('Name' => $name, 'Email' => $email, 'Phone' => $phone,
                    'Looking for' => $need, 'Budget' => $budget);
  $blocks   = array('Project description' => $message);
  $subject  = 'New enquiry: ' . $name . ' (' . $need . ', homepage)';
  $thanks   = 'Thank you for contacting Aivoryx.';
  $recap    = array('Looking for' => $need, 'Budget' => $budget);
  $wrote    = $message !== '';
}

/* ----- 1. To our inbox. If this fails, the visitor is told so. ----- */
list($ownerHtml, $ownerText) = ax_mail_owner($cfg, array(
  'source' => $source, 'headline' => $headline, 'ref' => $ref, 'when' => $when, 'page' => $page,
  'name' => $name, 'email' => $email, 'phone' => $phone, 'wa' => $waNum,
  'rows' => $rows, 'blocks' => $blocks,
));
try {
  ax_send($cfg, $cfg['to'], $cfg['to_name'], $subject, $ownerHtml, $ownerText,
    $email !== '' ? $email : null, $name);         /* Reply-To: replying reaches the enquirer */
} catch (Exception $e) {
  error_log('[aivoryx] ' . $source . ' send failed: ' . $e->getMessage());
  ax_out(false, "We couldn't send that just now. Please try WhatsApp, or call us.", 502);
}

/* ----- 2. The auto-reply. Best-effort: the enquiry is already safely in
   the inbox, so a bounce here must not report failure to the visitor. ----- */
if (!empty($cfg['autoreply']) && $email !== '') {
  list($replyHtml, $replyText) = ax_mail_client($cfg, array(
    'first' => ax_first_name($name), 'thanks' => $thanks,
    'recap' => $recap, 'wrote' => $wrote, 'ref' => $ref,
  ));
  try {
    ax_send($cfg, $email, $name, 'We have your enquiry, ref ' . $ref . ' (Aivoryx)', $replyHtml, $replyText,
      $cfg['to'], $cfg['to_name'], true);
  } catch (Exception $e) {
    error_log('[aivoryx] ' . $source . ' auto-reply failed: ' . $e->getMessage());
  }
}

ax_out(true, $email !== ''
  ? 'Sent. We\'ll reply to ' . $email . ' the same working day.'
  : 'Got it. We\'ll be in touch the same working day.');
