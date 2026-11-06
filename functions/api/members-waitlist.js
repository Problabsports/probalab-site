// POST /api/members-waitlist — public members waitlist. Honeypot + dedupe. Insert-only.
const SUPABASE_URL = "https://zwdpsereqicvzbtfrrnd.supabase.co";
const SUPABASE_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3ZHBzZXJlcWljdnpidGZycm5kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNDM4MjYsImV4cCI6MjEwNzYxOTgyNn0.c19K-qMceIR0Jp2HpyO_FCL3rE2AWcP_YbGcYi-8iBg";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function onRequestPost(ctx) {
  const req = ctx.request;
  const ct = req.headers.get("content-type") || "";
  const isForm = !ct.includes("application/json");
  let body = {};
  try {
    if (isForm) {
      const f = await req.formData();
      body = { email: f.get("email"), website: f.get("website"), source: f.get("source") };
    } else body = await req.json();
  } catch { body = {}; }

  const email = String(body.email ?? "").trim().toLowerCase();
  const website = String(body.website ?? "");
  const source = String(body.source ?? "members").slice(0, 80) || "members";

  // Honeypot: bots fill hidden "website". Pretend success; do not store.
  if (website) {
    const out = { ok: true };
    if (!isForm) return json(out, 200);
    return thanksHtml(true);
  }

  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    const out = { ok: false, error: "Please enter a valid email address." };
    if (!isForm) return json(out, 400);
    return thanksHtml(false, out.error);
  }

  const url = `${SUPABASE_URL}/rest/v1/members_waitlist`;
  let status = 200;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apikey: SUPABASE_ANON,
        authorization: `Bearer ${SUPABASE_ANON}`,
        prefer: "return=minimal",
      },
      body: JSON.stringify({ email, source }),
    });
    // 201 created, 409 conflict = already on list → both ok (dedupe)
    if (res.status === 201 || res.status === 200) status = 200;
    else if (res.status === 409) status = 200;
    else {
      const errText = await res.text();
      // unique_violation sometimes 409 with PostgREST; also check body
      if (/duplicate|unique/i.test(errText)) status = 200;
      else {
        console.log("members_waitlist insert failed", res.status, errText.slice(0, 200));
        const out = { ok: false, error: "Something went wrong. Please try again." };
        if (!isForm) return json(out, 502);
        return thanksHtml(false, out.error);
      }
    }
  } catch (e) {
    console.log("members_waitlist error", String(e));
    const out = { ok: false, error: "Something went wrong. Please try again." };
    if (!isForm) return json(out, 502);
    return thanksHtml(false, out.error);
  }

  const out = { ok: true };
  if (!isForm) return json(out, status);
  return thanksHtml(true);
}

const json = (o, status) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

function thanksHtml(ok, err) {
  const msg = ok
    ? "Thanks — you're on the members waitlist. We'll email you when it opens."
    : (err || "Something went wrong.");
  return new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Members waitlist | ProbaLab</title><link rel="stylesheet" href="/page.css"><main class="wrap"><h1>${ok ? "You're on the list" : "Not quite"}</h1><section class="panel"><p>${msg.replace(/</g, "&lt;")}</p><p><a href="/members">Back</a> · <a href="/">Home</a></p></section></main>`,
    { status: ok ? 200 : 400, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } }
  );
}
