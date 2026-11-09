# Aivoryx — final design

The rebuild of aivoryx.com, from the approved design lab.
Plain HTML, CSS and JavaScript. No build step, no framework.

Status: **homepage only** (nav, hero + live solar demo, work, standard, pricing, contact, footer). Other pages come next.

```
Final-Aivoryx-design/
├── index.html
├── api/                 Enquiry endpoint (PHP) — send.php, mailer.php, config.example.php
├── site.webmanifest
├── robots.txt
└── assets/
    ├── css/
    │   ├── tokens.css       Colour, type, spacing, easing — edit here first
    │   ├── base.css         Reset, frame, shared type roles, LIVE dot, reveal motion
    │   ├── components.css   Nav + mobile sheet, buttons, links, browser frame for screenshots
    │   ├── home.css         Hero, live demo, work section, standard
    │   ├── close.css        08 pricing, 09 contact + enquiry form, footer
    │   └── responsive.css   1080 / 860 / 560, reduced motion, print — always loaded last
    ├── js/
    │   ├── nav.js           Scrolled nav state, burger + mobile sheet
    │   ├── reveal.js        Fade-in on scroll
    │   ├── solar.js         The Clans Machina calculator in the hero
    │   └── enquiry.js       Contact form → ../api/send.php (validation, states, BigRock retry)
    └── img/
        ├── brand/           Monogram (light/dark), lockup, favicon
        ├── clients/         Client marks shown beside each project name
        └── work/            Site screenshots — <name>-800.webp and <name>-1440.webp
```

## Adding a project screenshot

1. Capture the live site at 1440×900 with no browser chrome and no popups open.
2. Export two WebP files into `assets/img/work/`: `name-800.webp` and `name-1440.webp` (quality ~82).
3. Copy an existing `<figure class="browser">` block in `index.html` and change the url,
   `src`, `srcset` (the `w` values must be the real pixel widths), `width`/`height` and `alt`.

## Run locally

    python -m http.server 8000     # then open http://localhost:8000

## The enquiry form

The form posts to `api/send.php` (validates, emails the inbox, sends the
auto-reply). Success is only shown when it answers `{"ok":true}`.

- **PHP hosting (BigRock):** upload everything, then copy `api/config.example.php`
  to `api/config.php` on the server and fill in the mailbox details.
  `config.php` holds the password and is in `.gitignore` — never commit it.
- **Vercel:** static only, no PHP. `.vercelignore` leaves `api/` out, so on a
  Vercel preview the form shows its error state ("can't reach our inbox").

Prices in section 08: ₹7,999 / ₹14,999 / from ₹24,999 — edit them in `index.html`.
