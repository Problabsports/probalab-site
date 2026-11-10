// POST /api/membership-activate — after a paid Checkout Session, set a password.
import {
  isValidEmail, jsonResponse, normalizeEmail, publicOrigin, setAuthPassword,
  setMemberAccess, stripeRequest,
} from "../_shared/membership.js";

export async function onRequestPost(ctx) {
  const env = ctx.env || {};
  let body = {};
  try { body = await ctx.request.json(); } catch { body = {}; }
  const sessionId = String(body.session_id || "").trim();
  const password = String(body.password || "");
  if (!sessionId.startsWith("cs_")) return jsonResponse({ ok: false, error: "Missing checkout session." }, 400);
  if (password.length < 12) return jsonResponse({ ok: false, error: "Use a password of at least 12 characters." }, 400);
  try {
    const session = await stripeRequest(env, "GET", `/checkout/sessions/${sessionId}`);
    const paid = session.payment_status === "paid" || session.payment_status === "no_payment_required";
    if (session.mode !== "subscription" || !paid) {
      return jsonResponse({ ok: false, error: "This checkout is not complete yet." }, 402);
    }
    const email = normalizeEmail(
      (session.customer_details && session.customer_details.email)
      || session.customer_email
      || (session.metadata && session.metadata.email)
      || body.email,
    );
    if (!isValidEmail(email)) return jsonResponse({ ok: false, error: "No email on this checkout." }, 400);
    await setMemberAccess(env, { email, grant: true });
    await setAuthPassword(env, email, password);
    return jsonResponse({ ok: true, email, origin: publicOrigin(ctx.request, env) });
  } catch (err) {
    console.log("membership-activate failed", err && err.message);
    return jsonResponse({ ok: false, error: "Could not finish sign-up. Please try again, or email hello@probalabsports.com." }, 502);
  }
}
