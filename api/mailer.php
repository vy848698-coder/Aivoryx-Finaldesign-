<?php
/* ============================================================
   MAILER

   A small SMTP client, plus a fallback to the server's own mail().
   The rest of this project has no dependencies and no build step,
   so it has none either — but the reason is not only tidiness.

   Shared hosting sends from an IP shared with strangers, and mail
   from it reaches Gmail's spam folder often enough to lose real
   enquiries. Relaying through the destination's own Gmail account
   with an App Password means Google is sending mail to itself,
   which is the most deliverable route available here. mail() is
   kept only for the case where the host blocks outbound SMTP.

   The body is always base64: it keeps every line short and cannot
   produce a line starting with "." , so SMTP dot-stuffing and the
   998-character line limit both stop being a concern.
   ============================================================ */

if (!defined('AX_MAIL')) { http_response_code(403); exit; }


/* A header value is a single line by definition. Anything carrying
   CR or LF is someone trying to inject extra headers. */
function ax_h($v) {
  return trim(str_replace(array("\r", "\n", "\0"), '', (string)$v));
}

/* RFC 2047, so non-ASCII subjects and names survive. */
function ax_enc_word($v) {
  $v = ax_h($v);
  if (preg_match('/^[\x20-\x7E]*$/', $v)) return $v;
  return '=?UTF-8?B?' . base64_encode($v) . '?=';
}

function ax_addr($email, $name = '') {
  $email = ax_h($email);
  return $name === '' ? $email : ax_enc_word($name) . ' <' . $email . '>';
}


/* A bare <div> is valid enough for mail clients but filters treat a
   fragment as a small negative signal, so send a real document. */
function ax_html_doc($html) {
  if (preg_match('/^\s*<(!doctype|html)/i', $html)) return $html;
  return '<!DOCTYPE html><html lang="en"><head>'
    . '<meta charset="UTF-8">'
    . '<meta name="viewport" content="width=device-width,initial-scale=1">'
    . '</head><body style="margin:0;padding:0">' . $html . '</body></html>';
}


/* ---------------- Message assembly ----------------
   multipart/alternative: a plain-text part for clients that want
   it and for spam scoring, and an HTML part for everyone else.
   No images or attachments, so it reads as an ordinary email.

   $auto marks generated mail (the confirmation) with Auto-Submitted,
   which is what RFC 3834 expects and what stops two autoresponders
   talking to each other forever. */
function ax_build_message($cfg, $to, $toName, $subject, $html, $text, $replyTo, $replyToName, $auto = false) {
  $alt    = 'axa' . bin2hex(random_bytes(10));
  $domain = substr(strrchr(ax_h($cfg['from']), '@'), 1);

  $headers = array(
    'Date: ' . date('r'),
    'Message-ID: <' . bin2hex(random_bytes(10)) . '@' . $domain . '>',
    'From: ' . ax_addr($cfg['from'], $cfg['from_name']),
    'To: ' . ax_addr($to, $toName),
    'Subject: ' . ax_enc_word($subject),
    'MIME-Version: 1.0',
  );
  if ($replyTo) $headers[] = 'Reply-To: ' . ax_addr($replyTo, $replyToName);
  if ($auto)    $headers[] = 'Auto-Submitted: auto-replied';

  $alternative =
    "--$alt\r\n" .
    "Content-Type: text/plain; charset=UTF-8\r\n" .
    "Content-Transfer-Encoding: base64\r\n\r\n" .
    chunk_split(base64_encode($text), 76, "\r\n") .
    "\r\n--$alt\r\n" .
    "Content-Type: text/html; charset=UTF-8\r\n" .
    "Content-Transfer-Encoding: base64\r\n\r\n" .
    chunk_split(base64_encode(ax_html_doc($html)), 76, "\r\n") .
    "\r\n--$alt--\r\n";

  $headers[] = 'Content-Type: multipart/alternative; boundary="' . $alt . '"';
  return array('headers' => $headers, 'body' => $alternative);
}


/* ---------------- SMTP ---------------- */

/* A reply can span several lines: "250-FOO" continues, "250 FOO" ends. */
function ax_smtp_read($fp) {
  $out = '';
  while (($line = fgets($fp, 1024)) !== false) {
    $out .= $line;
    if (strlen($line) < 4 || $line[3] !== '-') break;
  }
  return $out;
}

function ax_smtp_cmd($fp, $cmd, $expect) {
  if ($cmd !== null) fwrite($fp, $cmd . "\r\n");
  $reply = ax_smtp_read($fp);
  $code  = (int)substr($reply, 0, 3);
  if (!in_array($code, (array)$expect, true)) {
    /* never echo the command back — one of them carries the password */
    throw new Exception('SMTP ' . $code . ': ' . trim(substr($reply, 0, 200)));
  }
  return $reply;
}

function ax_smtp_send($cfg, $to, $toName, $subject, $html, $text, $replyTo, $replyToName, $auto = false) {
  $s      = $cfg['smtp'];
  $secure = isset($s['secure']) ? $s['secure'] : 'tls';
  $target = ($secure === 'ssl' ? 'ssl://' : 'tcp://') . $s['host'] . ':' . (int)$s['port'];

  /* Shared hosts often serve a certificate for the server's own name
     rather than mail.<domain>; verify_cert=false keeps encryption but
     skips that name check. See config.php. */
  $verify = !isset($s['verify_cert']) || $s['verify_cert'];
  $ctx = stream_context_create(array('ssl' => array(
    'verify_peer'       => $verify,
    'verify_peer_name'  => $verify,
    'allow_self_signed' => !$verify,
  )));

  $fp = @stream_socket_client($target, $errno, $errstr, (int)$s['timeout'], STREAM_CLIENT_CONNECT, $ctx);
  if (!$fp) throw new Exception('connect failed: ' . $errstr);
  stream_set_timeout($fp, (int)$s['timeout']);

  try {
    ax_smtp_cmd($fp, null, 220);                       // greeting
    $ehlo = 'EHLO ' . (isset($_SERVER['HTTP_HOST']) ? preg_replace('/[^A-Za-z0-9.\-]/', '', $_SERVER['HTTP_HOST']) : 'localhost');
    ax_smtp_cmd($fp, $ehlo, 250);

    if ($secure === 'tls') {
      ax_smtp_cmd($fp, 'STARTTLS', 220);
      $ok = @stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
      if (!$ok) throw new Exception('STARTTLS failed');
      ax_smtp_cmd($fp, $ehlo, 250);                    // re-introduce over TLS
    }

    ax_smtp_cmd($fp, 'AUTH LOGIN', 334);
    ax_smtp_cmd($fp, base64_encode($s['user']), 334);
    ax_smtp_cmd($fp, base64_encode($s['pass']), 235);

    ax_smtp_cmd($fp, 'MAIL FROM:<' . ax_h($cfg['from']) . '>', 250);
    ax_smtp_cmd($fp, 'RCPT TO:<' . ax_h($to) . '>', array(250, 251));
    ax_smtp_cmd($fp, 'DATA', 354);

    $m = ax_build_message($cfg, $to, $toName, $subject, $html, $text, $replyTo, $replyToName, $auto);
    fwrite($fp, implode("\r\n", $m['headers']) . "\r\n\r\n" . $m['body']);
    ax_smtp_cmd($fp, '.', 250);

    @fwrite($fp, "QUIT\r\n");
  } finally {
    @fclose($fp);
  }
  return true;
}


/* ---------------- Fallback ---------------- */
function ax_mail_send($cfg, $to, $toName, $subject, $html, $text, $replyTo, $replyToName, $auto = false) {
  $m = ax_build_message($cfg, $to, $toName, $subject, $html, $text, $replyTo, $replyToName, $auto);

  /* mail() writes its own To and Subject, so drop ours from the list */
  $headers = array();
  foreach ($m['headers'] as $h) {
    if (stripos($h, 'To: ') === 0 || stripos($h, 'Subject: ') === 0) continue;
    $headers[] = $h;
  }

  return @mail(ax_h($to), ax_enc_word($subject), $m['body'], implode("\r\n", $headers));
}


/* Try SMTP, fall back to mail(). Returns the route that worked, or
   throws with both failures so the log says what actually happened. */
function ax_send($cfg, $to, $toName, $subject, $html, $text, $replyTo = null, $replyToName = '', $auto = false) {
  $smtpErr = null;

  if (!empty($cfg['smtp']['enabled'])) {
    try {
      ax_smtp_send($cfg, $to, $toName, $subject, $html, $text, $replyTo, $replyToName, $auto);
      return 'smtp';
    } catch (Exception $e) {
      $smtpErr = $e->getMessage();
      error_log('[aivoryx] SMTP failed, trying mail(): ' . $smtpErr);
    }
  }

  if (ax_mail_send($cfg, $to, $toName, $subject, $html, $text, $replyTo, $replyToName, $auto)) return 'mail';

  throw new Exception('both routes failed' . ($smtpErr ? ' — SMTP: ' . $smtpErr : ''));
}
