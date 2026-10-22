// POST /api/subscribe — newsletter sign-up. Accepts JSON (site JS) or a plain form post (no JS).
// 1) Writes the consent record to the Supabase function (kept as backup; IP used there only as a salted hash for spam throttling).
// 2) If that succeeds, adds the address to beehiiv (same wiring as AI Form Guide). Needs Pages env vars
//    BEEHIIV_API_KEY and BEEHIIV_PUBLICATION_ID; without them, returns mode "preview" and beehiiv is skipped.
const TARGET = "https://zwdpsereqicvzbtfrrnd.supabase.co/functions/v1/probalab-subscribe";
const BEEHIIV = "https://api.beehiiv.com/v2/publications";

export async function onRequestPost(ctx) {
  const req = ctx.request, env = ctx.env || {}, ct = req.headers.get("content-type") || "";
  const isForm = !ct.includes("application/json");
  let body;
  try {
    if (isForm) { const f = await req.formData(); body = { email: f.get("email"), website: f.get("website"), source: f.get("source") }; }
    else body = await req.json();
  } catch { body = {}; }
  const email = String(body.email ?? "").trim(), website = String(body.website ?? "");
  let res, out;
  try {
    res = await fetch(env.SUBSCRIBE_URL || TARGET, { method: "POST", headers: { "content-type": "application/json", "x-client-ip": req.headers.get("cf-connecting-ip") || "" },
      body: JSON.stringify({ email, website, source: String(body.source ?? "") }) });
    out = await res.json();
  } catch { res = { status: 502 }; out = { ok: false, error: "Something went wrong. Please try again." }; }

  if (out.ok && !website) { // honeypot hits get ok:true from Supabase but are never sent to beehiiv
    if (!env.BEEHIIV_API_KEY || !env.BEEHIIV_PUBLICATION_ID) out = { ...out, mode: "preview" };
    else {
      try {
        const b = await fetch(`${BEEHIIV}/${env.BEEHIIV_PUBLICATION_ID}/subscriptions`, { method: "POST",
          headers: { authorization: `Bearer ${env.BEEHIIV_API_KEY}`, "content-type": "application/json" },
          body: JSON.stringify({ email, reactivate_existing: true, send_welcome_email: false, utm_source: "probalabsports", utm_medium: "website" }) });
        out = b.ok ? { ...out, mode: "beehiiv" } : { ...out, mode: "backup-only" }; // consent saved in Supabase; sync later
        if (!b.ok) console.log("beehiiv subscribe failed", b.status);
      } catch { out = { ...out, mode: "backup-only" }; console.log("beehiiv subscribe error"); }
    }
  }
  if (!isForm) return new Response(JSON.stringify(out), { status: res.status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
  const msg = out.ok ? "Thanks — you're on the list. Watch your inbox for our weekly predictions and results." : (out.error || "Something went wrong.");
  return new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Newsletter | ProbaLab</title><link rel="stylesheet" href="/page.css"><main class="wrap"><h1>${out.ok ? "You're in" : "Not quite"}</h1><section class="panel"><p>${msg.replace(/</g, "&lt;")}</p><p><a href="/">Back to ProbaLab</a></p></section></main>`,
    { status: out.ok ? 200 : res.status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}
