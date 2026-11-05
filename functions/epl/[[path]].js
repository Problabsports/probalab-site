import { serveHidden } from "../_hidden/serve.js";
import { html, notFound } from "../_shared/site.js";
import { renderTeamIndex, renderTeamPage, resolveTeamSlug, eplDataFromFiles } from "../_shared/teams.js";

const asset = (ctx, p, d) => ctx.env.ASSETS.fetch(new URL(p, ctx.request.url)).then((r) => (r.ok ? r.json() : d)).catch(() => d);

export async function onRequestGet(ctx) {
  const parts = [].concat(ctx.params.path ?? []).filter(Boolean);
  if (parts[0] === "team") {
    const [raw, grades, season] = await Promise.all([
      asset(ctx, "/data/epl-picks.json", []),
      asset(ctx, "/data/epl-grades.json", {}),
      asset(ctx, "/data/epl-season.json", { games: [] }),
    ]);
    const data = eplDataFromFiles(raw, grades, season);
    if (parts.length === 1) return html(renderTeamIndex("epl", data));
    if (parts.length === 2) {
      const hit = resolveTeamSlug("epl", data, parts[1]);
      if (!hit) return notFound();
      if (hit.redirect) return Response.redirect(new URL(hit.redirect, ctx.request.url).toString(), 301);
      return html(renderTeamPage("epl", data, hit.team));
    }
    return notFound();
  }
  return serveHidden(ctx, "epl");
}
export const onRequestHead = async (ctx) => { const r = await onRequestGet(ctx); return new Response(null, { status: r.status, headers: r.headers }); };
