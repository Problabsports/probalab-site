/* Owner-session helper for members pages. Sets an httpOnly cookie the Functions can check. */
(function (root) {
  const SB_URL = "https://zwdpsereqicvzbtfrrnd.supabase.co";
  const SB_ANON = root.__SB_ANON || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3ZHBzZXJlcWljdnpidGZycm5kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNDM4MjYsImV4cCI6MjEwNzYxOTgyNn0.c19K-qMceIR0Jp2HpyO_FCL3rE2AWcP_YbGcYi-8iBg";

  async function claim(session) {
    if (!session || !session.access_token) return false;
    try {
      const r = await fetch("/api/owner-access", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json", authorization: "Bearer " + session.access_token },
        body: "{}",
      });
      return r.ok;
    } catch (_) {
      return false;
    }
  }

  async function clear() {
    try { await fetch("/api/owner-access", { method: "DELETE", credentials: "include" }); } catch (_) {}
  }

  function authFetch(url, opts, session) {
    const headers = Object.assign({}, (opts && opts.headers) || {});
    if (session && session.access_token) headers.authorization = "Bearer " + session.access_token;
    return fetch(url, Object.assign({}, opts || {}, { credentials: "include", headers }));
  }

  async function gateDesk() {
    const dest = "/members";
    const msg = document.getElementById("gateMsg");
    if (!root.supabase) { location.replace(dest); return; }
    const sb = root.supabase.createClient(SB_URL, SB_ANON, { auth: { persistSession: true, autoRefreshToken: true } });
    const { data } = await sb.auth.getSession();
    const session = data && data.session;
    if (!session) { location.replace(dest); return; }
    const email = session.user && session.user.email;
    const { data: allow } = await sb.from("member_allowlist").select("role").ilike("email", email).maybeSingle();
    const D = root.TipsModel || root.MembersDesks;
    const isOwner = D && D.isOwnerAccount ? D.isOwnerAccount(email, allow && allow.role) : false;
    if (!isOwner) { location.replace(dest); return; }
    const flag = "pl_owner_gate";
    if (sessionStorage.getItem(flag) === "1") {
      if (msg) msg.textContent = "Could not open this private desk. Open it from the members lobby, or sign in again.";
      return;
    }
    sessionStorage.setItem(flag, "1");
    if (msg) msg.textContent = "Opening your private desks…";
    const ok = await claim(session);
    if (!ok) {
      sessionStorage.removeItem(flag);
      if (msg) msg.textContent = "Could not open this private desk. Open it from the members lobby, or sign in again.";
      return;
    }
    location.reload();
  }

  root.MembersOwner = { claim, clear, authFetch, gateDesk };
})(typeof window !== "undefined" ? window : globalThis);
