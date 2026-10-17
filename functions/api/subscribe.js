// POST /api/subscribe — newsletter sign-up. Forwards to the Supabase function with the visitor's IP
// (used there only as a salted hash for spam throttling). Accepts JSON (site JS) or a plain form post (no JS).
const TARGET = "https://zwdpsereqicvzbtfrrnd.supabase.co/functions/v1/probalab-subscribe";

export async function onRequestPost(ctx) {
  const req = ctx.request, ct = req.headers.get("content-type") || "";
  const isForm = !ct.includes("application/json");
  let body;
  try {
    if (isForm) { const f = await req.formData(); body = { email: f.get("email"), website: f.get("website"), source: f.get("source") }; }
    else body = await req.json();
  } catch { body = {}; }
  let res, out;
  try {
    res = await fetch(ctx.env?.SUBSCRIBE_URL || TARGET, { method: "POST", headers: { "content-type": "application/json", "x-client-ip": req.headers.get("cf-connecting-ip") || "" },
      body: JSON.stringify({ email: String(body.email ?? ""), website: String(body.website ?? ""), source: String(body.source ?? "") }) });
    out = await res.json();
  } catch { res = { status: 502 }; out = { ok: false, error: "Something went wrong. Please try again." }; }
  if (!isForm) return new Response(JSON.stringify(out), { status: res.status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
  const msg = out.ok ? "Thanks — you're on the list. Watch your inbox for our weekly picks and results." : (out.error || "Something went wrong.");
  return new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Newsletter | ProbaLab</title><link rel="stylesheet" href="/page.css"><main class="wrap"><h1>${out.ok ? "You're in" : "Not quite"}</h1><section class="panel"><p>${msg.replace(/</g, "&lt;")}</p><p><a href="/">Back to ProbaLab</a></p></section></main>`,
    { status: out.ok ? 200 : res.status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}
