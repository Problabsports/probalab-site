// Server-side members check for member-only content (e.g. the NBA props board).
// Same rule as the members lobby: a signed-in Supabase user whose email has a
// member_allowlist row, or the owner. Desk visibility rules live in members-desks.js
// and are not used or changed here.
import { SUPABASE_URL, SUPABASE_ANON } from "./owner-session.js";
import { isOwnerAccount } from "./members-desks.js";

export function bearerToken(request) {
  const auth = request.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(\S+)/i);
  return m ? m[1] : null;
}

/** @returns {Promise<{email:string, role:string, owner:boolean} | null>} */
export async function verifyMember(request) {
  const token = bearerToken(request);
  if (!token) return null;
  try {
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON, authorization: `Bearer ${token}` },
    });
    if (!userRes.ok) return null;
    const user = await userRes.json();
    const email = String((user && user.email) || "").trim();
    if (!email) return null;
    const q = new URL(`${SUPABASE_URL}/rest/v1/member_allowlist`);
    q.searchParams.set("select", "role");
    q.searchParams.set("email", "ilike." + email);
    const allowRes = await fetch(q.toString(), {
      headers: { apikey: SUPABASE_ANON, authorization: `Bearer ${token}` },
    });
    const rows = allowRes.ok ? await allowRes.json() : [];
    const row = Array.isArray(rows) && rows[0] ? rows[0] : null;
    const role = (row && row.role) || "";
    const owner = isOwnerAccount(email, role);
    if (!row && !owner) return null;
    return { email, role, owner };
  } catch (_) {
    return null;
  }
}
