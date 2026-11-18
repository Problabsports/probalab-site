// GET /api/geo: the visitor's country from Cloudflare (request.cf.country, else the CF-IPCountry header). No
// third-party geo service, no IP address stored or returned. The props pages call it once and keep the answer in
// localStorage (props-region.js): US -> US bookie prices, anything else or unknown -> AU prices.

/** Two-letter country code, or null when Cloudflare doesn't know (XX) or it's Tor (T1). */
export function countryOf(request) {
  const raw = (request && request.cf && request.cf.country) || (request && request.headers && request.headers.get("cf-ipcountry")) || "";
  const c = String(raw).trim().toUpperCase();
  return /^[A-Z]{2}$/.test(c) && c !== "XX" ? c : null;
}

/** Props price region for a country: "us" only for the US, "au" for everyone else and unknown. */
export const regionOf = (country) => (country === "US" ? "us" : "au");

export function onRequestGet(ctx) {
  const country = countryOf(ctx.request);
  return new Response(JSON.stringify({ country, region: regionOf(country) }), {
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "private, no-store", "x-robots-tag": "noindex, nofollow" },
  });
}
