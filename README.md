# ProbaLab

Static site for probalabsports.com — NBA win predictions from a proprietary data model.

Plain HTML, no build step. Cloudflare Pages deploys every push to `main`.

While the site runs on sample data it is set to noindex (meta tag + robots.txt). Remove both at launch.

## Analytics and consent (preview/ga4-consent)

- GA4 `G-SS0L9DMVG3` via `/consent.js`, included once in every `<head>` (static pages and `functions/_shared/site.js`; the hidden NHL/EPL pages reuse `index.html`).
- Consent Mode v2: everything denied by default for all visitors. gtag.js is only fetched after Accept. Choice stored in localStorage `pl_consent`.
- The updated Google Analytics section of `privacy.html` is **pending a lawyer's check** before it's relied on.
