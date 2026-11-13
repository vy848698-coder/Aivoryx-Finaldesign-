# Aivoryx — final design

The rebuild of aivoryx.com, from the approved design lab.
Plain HTML, CSS and JavaScript. No build step, no framework.

Status: **live-ready**. Five pages (home, work, tools, how we price, contact), a 404 page, sitemap.xml, and the PHP enquiry endpoint.

```
Final-Aivoryx-design/
├── index.html
├── 404.html             Shown for any missing URL (.htaccess ErrorDocument)
├── sitemap.xml          Listed in robots.txt
├── api/                 Enquiry endpoint (PHP) — send.php, validate.php, emails.php, mailer.php, config.example.php
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

## Free tools page (`tools.html`)

A working preview of each of the eight tools — no screenshots. Files:

    assets/css/tools.css         page + workspace + every tool's UI
    assets/js/tools/app.js       tool registry (names, URLs, access facts, limits), selector, search, #tool-<id> deep links
    assets/js/tools/lib.js       shared helpers + the pinned CDN library URLs
    assets/js/tools/t-*.js       one module per tool, loaded only when opened
    assets/js/tools/hero.js      the hero's live JSON / NRIC miniature
    assets/models/u2netp.onnx    background-removal model (same as image-tools.aivoryx.com)

JSON, NRIC, PDF and Image process real files in the browser (pdf-lib, PDF.js,
heic2any and ONNX Runtime load from CDNs on first use). File sharing, secrets,
vault and GST run in clearly labelled sample mode — nothing is uploaded.
The hero's "at a glance" numbers are plain markup in `tools.html`; tool access
facts live in the `TOOLS` array in `app.js`. ES modules need a server, not file://.

## How we price (`pricing.html`)

The nav's "How we price" link on every page goes here. Business rule: **no prices
on this page** — no figures, ranges, starting prices or packages. Files:

    assets/css/pricing.css   page styles (loaded after responsive.css)
    assets/js/pricing.js     progress rule, direction tabs, scroll-linked process,
                             value strata, FAQ accordion, the enquiry form

The enquiry posts to `api/send.php` with `kind: "pricing"`. That branch has its
own whitelists (build / budget_mode / priority / direction), which must match the
radio values in `pricing.html` exactly. Phone is optional there; the budget is
never required as a number (`budget_note` is optional free text, shown only to
the owner and never echoed in the auto-reply). Same rule as the homepage form:
success only on `{"ok":true}`, so on Vercel or without `api/config.php` the form
shows its error state with WhatsApp as the fallback.

## Contact page (`contact.html`)

The nav's "Contact us" and the footer's "Contact" link on every page go here
(the homepage keeps its own section-09 form for its in-page CTAs). Files:

    assets/css/contact.css   page styles (loaded after responsive.css)
    assets/js/contact.js     process line, FAQ accordion, copy-email, the 4-step enquiry

The enquiry posts to `api/send.php` with `kind: "contact"`: name, email,
optional phone, `need`, `message` (the idea, 10+ characters), optional
`details`, and `start`. `need` and `start` are whitelisted in that branch and
must match the radio values in `contact.html` exactly (note the en dash in
"In 2–3 months"). No budget is asked. The auto-reply repeats only those fixed
choices, never the visitor's own text. Same rule as the other forms: success
only on `{"ok":true}`; any failure keeps every answer and offers WhatsApp.
Without JavaScript all four steps show at once and the form still posts.

## Input rules (every form)

All four forms (homepage enquiry, homepage popup, How we price, Contact)
use one rule set, written twice so they always agree:

    assets/js/validate.js   in the browser: instant, friendly messages
    api/validate.php        on the server: the same rules, run again

Change a rule or a message in both files. Highlights: names (letters only,
no emails/links/digits/"test"), email (typo domains like gmial.com and
.con, throwaway inboxes, our own address; the server also checks the
domain exists), phone (Indian mobiles by default, any country with a
country code, no 0000000000 or our own number), free text (no HTML, at
most three links, no keyboard mash). Values are tidied (invisible
characters, stray spaces) before checking and before they're emailed.

The server also drops bots silently (honeypot `company`/`ax_hp`, or a
submit under 3 s after page load, sent as `t`), skips duplicates sent
within 15 minutes, and returns `fields: {name: message}` on a 422 so
each form can show a server-only problem next to its field.

## Adding a project screenshot

1. Capture the live site at 1440×900 with no browser chrome and no popups open.
2. Export two WebP files into `assets/img/work/`: `name-800.webp` and `name-1440.webp` (quality ~82).
3. Copy an existing `<figure class="browser">` block in `index.html` and change the url,
   `src`, `srcset` (the `w` values must be the real pixel widths), `width`/`height` and `alt`.

## Run locally

    python -m http.server 8000     # then open http://localhost:8000

## The emails (`api/emails.php`)

Every form sends the same two emails, from one template file:

- **To our inbox** (`to` in config.php): subject `New enquiry: <name> (<need>, <page>)`,
  a one-tap Reply / Call / WhatsApp line, the answers, their message, and a
  reference like `AX-261113-4F2A`. Reply-To is the enquirer.
- **Auto-reply** (only when they gave an email): a short letter, a recap of their
  *fixed* choices, what happens next, and our phone, WhatsApp, email, site and
  address. Same reference. It never repeats text the visitor typed (only a
  first name that looks like a name), so the form can't be used to send spam.

Plain black on white, Arial, no images. Our phone/email/address can be
overridden in config.php with `phone`, `whatsapp`, `public_email`, `address`.

## The enquiry form

The form posts to `api/send.php` (validates, emails the inbox, sends the
auto-reply). Success is only shown when it answers `{"ok":true}`.

- **PHP hosting (BigRock):** upload everything, then copy `api/config.example.php`
  to `api/config.php` on the server and fill in the mailbox details.
  `config.php` holds the password and is in `.gitignore` — never commit it.
- **Vercel:** static only, no PHP. `.vercelignore` leaves `api/` out, so on a
  Vercel preview the form shows its error state ("can't reach our inbox").

Section 08 shows no package prices — each card leads with delivery time
(~7 days / 2–3 weeks / scoped in 1 call) and promises a fixed quote in 24 hours.
Edit the copy in `index.html`.
