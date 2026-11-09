<?php
/* ============================================================
   MAIL CONFIG — TEMPLATE (BigRock)

   Copy this file to config.php and fill it in. config.php is in
   .gitignore and holds the real password; this template is
   committed, so keep real values out of it.

   Fill in the four CHANGE-ME values below, nothing else.
   ============================================================ */

if (!defined('AX_MAIL')) { http_response_code(403); exit; }

return array(

  /* 1. The inbox where enquiries arrive (the one you read). */
  'to'        => 'CHANGE-ME-inbox@aivoryx.com',
  'to_name'   => 'Aivoryx',

  /* 2. The mailbox the site sends FROM. Must be the same address
        as 'user' below, or BigRock will refuse / rewrite it. */
  'from'      => 'CHANGE-ME-sender@aivoryx.com',
  'from_name' => 'Aivoryx',

  /* BigRock mailbox SMTP.
     - host: mail.<your-domain>. If BigRock's email settings page
       shows a different "Outgoing server", use that instead.
     - 465 + ssl is BigRock's standard. If it ever fails, try
       587 + tls.
     - verify_cert: BigRock shared servers often present a
       certificate for the server's own hostname, not for
       mail.<your-domain>, and PHP then refuses the connection.
       false keeps the connection encrypted but skips that name
       check. Set true if your host has a matching certificate. */
  'smtp' => array(
    'enabled'     => true,
    'host'        => 'mail.aivoryx.com',
    'port'        => 465,
    'secure'      => 'ssl',          // 'ssl' for 465, 'tls' for 587
    'user'        => 'CHANGE-ME-sender@aivoryx.com',   // same as 'from'
    'pass'        => 'CHANGE-ME-password',             // 3. the sender mailbox password
    'timeout'     => 20,
    'verify_cert' => false,
  ),

  /* Send the enquirer a short "we've received it" reply. */
  'autoreply' => true,

  /* Most submissions accepted from one IP per hour. */
  'rate_limit' => 10,

  /* Used for the link in the signature. */
  'site' => 'https://aivoryx.com',
);
