<?php
/* ============================================================
   EMAIL TEMPLATES — every form uses these two.

   1. ax_mail_owner()  the enquiry, to our inbox (admin@aivoryx.com)
   2. ax_mail_client() the auto-reply, to the person who wrote in

   Deliberately plain: black text on white, one ordinary font, no
   images, no buttons, no colour except the "x" in the wordmark. They
   should read like a letter a person typed, which is also what keeps
   them out of spam folders.

   Safety rule for the auto-reply: it goes to whatever address was
   typed into the form, so it must never carry text a stranger wrote
   (otherwise the form becomes a way to send their link or scam from
   our mailbox to anyone). It repeats only our own fixed choices, a
   first name that looks like a name, and the reference number.
   ============================================================ */

if (!defined('AX_MAIL')) { http_response_code(403); exit; }

function ax_e($v) { return htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8'); }

/* Our own details, shown in every auto-reply. config.php may override. */
function ax_us($cfg) {
  $site = rtrim(isset($cfg['site']) ? $cfg['site'] : 'https://aivoryx.com', '/');
  return array(
    'name'     => 'Aivoryx',
    'phone'    => isset($cfg['phone'])    ? $cfg['phone']    : '+91 93995 93499',
    'whatsapp' => isset($cfg['whatsapp']) ? $cfg['whatsapp'] : '919399593499',
    'email'    => isset($cfg['public_email']) ? $cfg['public_email'] : $cfg['to'],
    'site'     => $site,
    'host'     => preg_replace('~^https?://~', '', $site),
    'address'  => isset($cfg['address'])  ? $cfg['address']  : 'Dwarka Mor, New Delhi 110059',
  );
}

/* ---------- shared pieces ---------- */

define('AX_FONT', 'font-family:Arial,Helvetica,sans-serif;');
define('AX_INK',  '#1a1a1a');
define('AX_SOFT', '#6b6b6b');
define('AX_RULE', '#e4e4e4');

function ax_wrap($inner) {
  return '<div style="' . AX_FONT . 'font-size:15px;line-height:1.6;color:' . AX_INK . ';max-width:600px;margin:0 auto;padding:28px 24px">'
    . $inner . '</div>';
}
function ax_para($html, $style = '') {
  return '<p style="margin:0 0 14px;' . $style . '">' . $html . '</p>';
}
function ax_rule() {
  return '<hr style="border:0;border-top:1px solid ' . AX_RULE . ';margin:22px 0">';
}
function ax_label($text) {
  return '<p style="margin:0 0 8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:' . AX_SOFT . '">' . ax_e($text) . '</p>';
}
function ax_link($href, $text) {
  return '<a href="' . ax_e($href) . '" style="color:' . AX_INK . ';text-decoration:underline">' . ax_e($text) . '</a>';
}
function ax_wordmark() {
  return '<p style="margin:0 0 24px;font-size:20px;font-weight:bold;letter-spacing:-.02em;color:' . AX_INK . '">'
    . 'Aivory<span style="color:#e8431c">x</span></p>';
}
/* A two-column table of label / value. $rows values are already-safe HTML. */
function ax_rows_html($rows) {
  $h = '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;font-size:15px;line-height:1.5;color:' . AX_INK . '">';
  foreach ($rows as $k => $v) {
    $h .= '<tr>'
      . '<td style="padding:7px 16px 7px 0;border-bottom:1px solid ' . AX_RULE . ';color:' . AX_SOFT . ';vertical-align:top;white-space:nowrap;width:1%">' . ax_e($k) . '</td>'
      . '<td style="padding:7px 0;border-bottom:1px solid ' . AX_RULE . ';vertical-align:top">' . $v . '</td></tr>';
  }
  return $h . '</table>';
}
function ax_rows_text($rows) {
  $w = 0;
  foreach ($rows as $k => $v) $w = max($w, ax_len($k));
  $t = '';
  foreach ($rows as $k => $v) {
    $t .= $k . ':' . str_repeat(' ', $w - ax_len($k) + 2) . html_entity_decode(strip_tags($v), ENT_QUOTES, 'UTF-8') . "\n";
  }
  return $t;
}

/* A first name that is safe to print in the auto-reply, or "there". */
function ax_first_name($name) {
  $first = preg_split('/\s+/', trim((string)$name));
  $first = ax_cut($first[0], 30);
  return preg_match('/^[\p{L}\p{M}\'’-]{2,}$/u', $first) ? $first : 'there';
}


/* ============================================================
   1. To our inbox

   $o = array(
     'source'   => 'Contact page',          where it came from
     'headline' => 'Asha Rao: Web application',
     'ref'      => 'AX-261113-4F2A',
     'when'     => '13 November 2026, 3:42 pm',
     'name', 'email', 'phone' (tidy form), 'wa' (digits for wa.me)
     'rows'     => array(label => plain text),   the answers
     'blocks'   => array(label => plain text),   long free text
   )
   ============================================================ */
function ax_mail_owner($cfg, $o) {
  $name  = $o['name'];
  $email = $o['email'];
  $phone = $o['phone'];

  // one line of actions, so a lead can be answered in one tap
  $acts = array(); $actsText = array();
  if ($email !== '') {
    $acts[]     = ax_link('mailto:' . $email, 'Reply by email');
    $actsText[] = 'Reply to this email to answer ' . ($name !== '' ? $name : 'them') . ' directly';
  }
  if ($phone !== '') {
    $acts[]     = ax_link('tel:+' . $o['wa'], 'Call ' . $phone);
    $acts[]     = ax_link('https://wa.me/' . $o['wa'], 'WhatsApp');
    $actsText[] = 'Call or WhatsApp: ' . $phone . '  (https://wa.me/' . $o['wa'] . ')';
  }

  // answers, with email and phone made clickable
  $rows = array();
  foreach ($o['rows'] as $k => $v) {
    if ($v === '' || $v === null) continue;
    if ($k === 'Email')     $rows[$k] = ax_link('mailto:' . $v, $v);
    elseif ($k === 'Phone') $rows[$k] = ax_link('tel:+' . $o['wa'], $v);
    else                    $rows[$k] = ax_e($v);
  }
  $rows['Reference'] = ax_e($o['ref']);

  $html = ax_label('New enquiry · ' . $o['source'])
    . '<h1 style="margin:0 0 6px;font-size:21px;line-height:1.3;font-weight:bold;color:' . AX_INK . '">' . ax_e($o['headline']) . '</h1>'
    . ax_para(ax_e($o['when']), 'font-size:13px;color:' . AX_SOFT . ';margin-bottom:18px')
    . ($acts ? ax_para(implode(' &nbsp;·&nbsp; ', $acts), 'margin-bottom:22px') : '')
    . ax_rows_html($rows);

  $text = 'New enquiry · ' . $o['source'] . "\n"
    . $o['headline'] . "\n" . $o['when'] . "\n\n"
    . ax_rows_text($rows);

  foreach ($o['blocks'] as $label => $body) {
    if ($body === '') continue;
    $html .= '<div style="margin:22px 0 0">' . ax_label($label)
      . '<div style="padding:14px 16px;background:#f6f6f6;border-radius:4px;white-space:normal">' . nl2br(ax_e($body)) . '</div></div>';
    $text .= "\n" . $label . ":\n" . $body . "\n";
  }

  if (!$acts) {
    $html .= ax_para('Only a name was left, with no way to reach them.', 'margin-top:20px;color:' . AX_SOFT);
    $text .= "\nOnly a name was left, with no way to reach them.\n";
  }

  if ($email === '')                $ack = 'No email was given, so no acknowledgement was sent.';
  elseif (!empty($cfg['autoreply'])) $ack = 'An acknowledgement goes to them automatically, quoting reference ' . $o['ref'] . '.';
  else                               $ack = '';
  $from = 'Sent from the ' . $o['source'] . ' form on ' . ax_us($cfg)['host'] . '.';

  $html .= ax_rule()
    . ax_para(($email !== '' ? 'Replying to this email goes straight to ' . ax_e($name !== '' ? $name : $email) . '. ' : '')
      . ax_e($ack), 'font-size:13px;color:' . AX_SOFT)
    . ax_para(ax_e($from), 'font-size:13px;color:' . AX_SOFT . ';margin:0');

  $text .= "\n" . ($actsText ? implode("\n", $actsText) . "\n" : '')
    . ($ack !== '' ? "\n" . $ack : '') . "\n" . $from . "\n";

  return array(ax_wrap($html), $text);
}


/* ============================================================
   2. The auto-reply

   $c = array(
     'first'  => 'Asha',                   from ax_first_name()
     'thanks' => 'Thank you for telling us about your idea.',
     'recap'  => array(label => our own fixed text),
     'wrote'  => true,                     they also wrote a description
     'ref'    => 'AX-261113-4F2A',
   )
   ============================================================ */
function ax_mail_client($cfg, $c) {
  $us = ax_us($cfg);

  $recap = array();
  foreach ($c['recap'] as $k => $v) if ($v !== '') $recap[$k] = ax_e($v);
  if (!empty($c['wrote'])) $recap['Your message'] = 'Received in full';
  $recap['Reference'] = ax_e($c['ref']);

  $steps = array(
    array('We read it.', 'The two people who would build your project read every enquiry themselves.'),
    array('We reply.', 'Usually with a few questions or a recommended approach, sometimes a short call.'),
    array('You get a written proposal.', 'Scope, timeline and one clear price. Nothing is agreed or payable until you say yes.'),
  );
  $stepsHtml = '';
  $stepsText = '';
  foreach ($steps as $i => $s) {
    $stepsHtml .= '<tr><td style="padding:0 12px 10px 0;vertical-align:top;color:' . AX_SOFT . ';font-size:14px">' . ($i + 1) . '.</td>'
      . '<td style="padding:0 0 10px;vertical-align:top"><b>' . ax_e($s[0]) . '</b> ' . ax_e($s[1]) . '</td></tr>';
    $stepsText .= ($i + 1) . '. ' . $s[0] . ' ' . $s[1] . "\n";
  }

  $html = ax_wordmark()
    . ax_para('Hi ' . ax_e($c['first']) . ',')
    . ax_para(ax_e($c['thanks']) . ' Your enquiry has reached us, and we will get back to you <b>within the same working day</b>.')
    . '<div style="margin:22px 0">' . ax_label('Your enquiry') . ax_rows_html($recap) . '</div>'
    . ax_label('What happens next')
    . '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font-size:15px;line-height:1.55;color:' . AX_INK . '">' . $stepsHtml . '</table>'
    . ax_rule()
    . ax_label('Need us sooner?')
    . ax_para('Call or WhatsApp: ' . ax_link('tel:+' . $us['whatsapp'], $us['phone'])
        . ' &nbsp;·&nbsp; ' . ax_link('https://wa.me/' . $us['whatsapp'], 'Open WhatsApp') . '<br>'
        . 'Email: ' . ax_link('mailto:' . $us['email'], $us['email']) . ' (or simply reply to this email)', 'margin-bottom:22px')
    . ax_para('Kind regards,<br><b>Team Aivoryx</b>', 'margin-bottom:6px')
    . ax_para(ax_link($us['site'], $us['host']) . ' &nbsp;·&nbsp; ' . ax_e($us['address']), 'font-size:13px;color:' . AX_SOFT . ';margin:0 0 18px')
    . ax_para('You are receiving this because this address was entered in the enquiry form on ' . ax_e($us['host'])
        . '. If that wasn’t you, please ignore this email; nothing else will be sent.', 'font-size:12px;color:#999999;margin:0');

  $recapText = '';
  foreach ($recap as $k => $v) $recapText .= '  ' . $k . ': ' . html_entity_decode(strip_tags($v), ENT_QUOTES, 'UTF-8') . "\n";

  $text = 'Hi ' . $c['first'] . ",\n\n"
    . $c['thanks'] . " Your enquiry has reached us, and we will get back to you within the same working day.\n\n"
    . "YOUR ENQUIRY\n" . $recapText . "\n"
    . "WHAT HAPPENS NEXT\n" . $stepsText . "\n"
    . "NEED US SOONER?\n"
    . 'Call or WhatsApp: ' . $us['phone'] . "  (https://wa.me/" . $us['whatsapp'] . ")\n"
    . 'Email: ' . $us['email'] . " (or simply reply to this email)\n\n"
    . "Kind regards,\nTeam Aivoryx\n" . $us['host'] . ' · ' . $us['address'] . "\n\n"
    . 'You are receiving this because this address was entered in the enquiry form on ' . $us['host']
    . ". If that wasn't you, please ignore this email; nothing else will be sent.\n";

  return array(ax_wrap($html), $text);
}
