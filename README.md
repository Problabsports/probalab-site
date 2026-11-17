# ProbaLab

Static site for probalabsports.com — NBA win predictions from a proprietary data model.

Plain HTML, no build step. Cloudflare Pages deploys every push to `main`.

While the site runs on sample data it is set to noindex (meta tag + robots.txt). Remove both at launch.

## Analytics and consent (preview/ga4-consent)

- GA4 `G-SS0L9DMVG3` via `/consent.js`, included once in every `<head>` (static pages and `functions/_shared/site.js`; the hidden NHL/EPL pages reuse `index.html`).
- Consent Mode v2: everything denied by default for all visitors. gtag.js is only fetched after Accept. Choice stored in localStorage `pl_consent`.
- The updated Google Analytics section of `privacy.html` is **pending a lawyer's check** before it's relied on.

## Phone layout (preview/phone-first)

- Under 768px wide only. `phone-core.js` (pure helpers, tested in `tests/phone-first.test.cjs`) + `phone.js` + `phone.css`, loaded on every page template. All `phone.css` rules sit inside the phone media query and are scoped to `html.pf`, which `phone.js` sets only when that query matches, so desktop is unchanged.
- Home screen (top greens from `/today`, green record, yesterday's greens, tap grid), `/today` match cards (green first), tabbed match view on the app's `#view-game` (Overview / Stats-H2H / Form / Props), bottom tab bar.
- Installable: `site.webmanifest`, maskable icons, `sw.js` (registered on phones only). The service worker stores only public static files and `offline.html`; pages, `/api`, `/data` and `/members` are never cached.
