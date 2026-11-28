// Newsletter unsubscribe tokens: HMAC-SHA256 over the lower-cased email, keyed with SUPABASE_SERVICE_ROLE_KEY
// (already set in Cloudflare Pages). Links: /api/unsubscribe?e=<base64url email>&t=<base64url hmac>.
// Stateless: nothing to store, and a token only ever unsubscribes the one address it was made for.

const enc = new TextEncoder();
const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (s) => {
  const t = String(s || "").replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(t + "===".slice((t.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

export const normEmail = (e) => String(e || "").trim().toLowerCase();

function secretOf(env) {
  const k = String((env && env.SUPABASE_SERVICE_ROLE_KEY) || "");
  if (!k) throw new Error("missing SUPABASE_SERVICE_ROLE_KEY");
  return k;
}

async function hmac(env, email) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secretOf(env)), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", key, enc.encode(`newsletter-unsubscribe:v1:${normEmail(email)}`));
}

export async function unsubscribeToken(env, email) {
  return b64url(await hmac(env, email));
}

/** Absolute unsubscribe URL for an email, on the given origin (production or a preview). */
export async function unsubscribeUrl(env, email, origin = "https://probalabsports.com") {
  const e = b64url(enc.encode(normEmail(email)));
  return `${origin.replace(/\/+$/, "")}/api/unsubscribe?e=${e}&t=${await unsubscribeToken(env, email)}`;
}

/** Decodes and checks ?e=&t=. Returns the email, or null if the link is malformed or the token is wrong. */
export async function verifyUnsubscribe(env, e, t) {
  let email;
  try { email = new TextDecoder().decode(fromB64url(e)); } catch { return null; }
  email = normEmail(email);
  if (!email || email.length > 254 || !email.includes("@") || !t) return null;
  let want;
  try { want = new Uint8Array(await hmac(env, email)); } catch { return null; }
  let got;
  try { got = fromB64url(t); } catch { return null; }
  if (got.length !== want.length) return null;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= want[i] ^ got[i]; // constant time
  return diff === 0 ? email : null;
}
