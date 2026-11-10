// POST /api/billing-portal — Stripe Customer Portal session for manage/cancel.
import {
  findCustomerByEmail, isValidEmail, jsonResponse, normalizeEmail,
  publicOrigin, stripeRequest, SUPABASE_URL,
} from "../_shared/membership.js";

const SUPABASE_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3ZHBzZXJlcWljdnpidGZycm5kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNDM4MjYsImV4cCI6MjEwNzYxOTgyNn0.c19K-qMceIR0Jp2HpyO_FCL3rE2AWcP_YbGcYi-8iBg";

async function emailFromRequest(request, body, env) {
  const auth = request.headers.get("authorization") || request.headers.get("Authorization") || "";
  const m = auth.match(/^Bearer\s+(\S+)/i);
  const token = m && m[1];
  if (token) {
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: String((env && env.SUPABASE_ANON_KEY) || SUPABASE_ANON),
        authorization: `Bearer ${token}`,
      },
    });
    if (userRes.ok) {
      const user = await userRes.json();
      const email = normalizeEmail(user && user.email);
      if (isValidEmail(email)) return email;
    }
  }
  return normalizeEmail(body && body.email);
}

export async function onRequestPost(ctx) {
  const env = ctx.env || {};
  let body = {};
  try { body = await ctx.request.json(); } catch { body = {}; }
  const email = await emailFromRequest(ctx.request, body, env);
  if (!isValidEmail(email)) {
    return jsonResponse({ ok: false, error: "Sign in, or enter the email you used at checkout." }, 401);
  }
  try {
    const customer = await findCustomerByEmail(env, email);
    if (!customer || !customer.id) {
      return jsonResponse({ ok: false, error: "No billing account found for this email." }, 404);
    }
    const origin = publicOrigin(ctx.request, env);
    const session = await stripeRequest(env, "POST", "/billing_portal/sessions", {
      customer: customer.id,
      return_url: `${origin}/members`,
    });
    return jsonResponse({ ok: true, url: session.url });
  } catch (err) {
    console.log("billing-portal failed", err && err.message);
    return jsonResponse({ ok: false, error: "Could not open the billing portal. Please try again." }, 502);
  }
}

export async function onRequestGet() {
  return jsonResponse({ ok: false, error: "Use POST" }, 405);
}
