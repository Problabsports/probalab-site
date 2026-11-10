// Verify the signed-in member is the owner, and read/write the httpOnly owner cookie.
import { OWNER_COOKIE, isOwnerAccount } from "./members-desks.js";

export const SUPABASE_URL = "https://zwdpsereqicvzbtfrrnd.supabase.co";
export const SUPABASE_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3ZHBzZXJlcWljdnpidGZycm5kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNDM4MjYsImV4cCI6MjEwNzYxOTgyNn0.c19K-qMceIR0Jp2HpyO_FCL3rE2AWcP_YbGcYi-8iBg";

function parseCookies(header) {
  const out = {};
  String(header || "").split(";").forEach((part) => {
    const i = part.indexOf("=");
    if (i < 0) return;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) out[k] = v;
  });
  return out;
}

export function readOwnerToken(request) {
  const auth = request.headers.get("authorization") || request.headers.get("Authorization") || "";
  const m = auth.match(/^Bearer\s+(\S+)/i);
  if (m) return m[1];
  const raw = parseCookies(request.headers.get("cookie"))[OWNER_COOKIE];
  if (!raw) return null;
  try { return decodeURIComponent(raw); } catch { return raw; }
}

export function ownerCookieHeader(token, maxAgeSec) {
  const parts = [
    `${OWNER_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    `Max-Age=${maxAgeSec}`,
  ];
  return parts.join("; ");
}

export function clearOwnerCookieHeader() {
  return `${OWNER_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export async function verifyOwner(request) {
  const token = readOwnerToken(request);
  if (!token) return null;
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON, authorization: `Bearer ${token}` },
  });
  if (!userRes.ok) return null;
  const user = await userRes.json();
  const email = String((user && user.email) || "").trim();
  if (!email) return null;
  let role = "";
  try {
    const q = new URL(`${SUPABASE_URL}/rest/v1/member_allowlist`);
    q.searchParams.set("select", "role");
    q.searchParams.set("email", "ilike." + email);
    const allowRes = await fetch(q.toString(), {
      headers: { apikey: SUPABASE_ANON, authorization: `Bearer ${token}` },
    });
    if (allowRes.ok) {
      const rows = await allowRes.json();
      role = (rows && rows[0] && rows[0].role) || "";
    }
  } catch (_) { /* role optional when the email is on the owner list */ }
  if (!isOwnerAccount(email, role)) return null;
  return { email, role, token };
}
