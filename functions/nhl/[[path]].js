import { serveHidden } from "../_hidden/serve.js";
import { html, shell, notFound } from "../_shared/site.js";
import { getInjuries, renderTeamIndex, renderTeamPage, resolveTeamSlug, nhlDataFromFiles } from "../_shared/teams.js";

const asset = (ctx, p, d) => ctx.env.ASSETS.fetch(new URL(p, ctx.request.url)).then((r) => (r.ok ? r.json() : d)).catch(() => d);

export async function onRequestGet(ctx) {
  const parts = [].concat(ctx.params.path ?? []).filter(Boolean);
  if (parts[0] === "team") {
    const [raw, pretip, season, grades] = await Promise.all([
      asset(ctx, "/data/nhl-picks.json", []),
      asset(ctx, "/data/nhl-pretip.json", {}),
      asset(ctx, "/data/nhl-season.json", { games: [] }),
      asset(ctx, "/data/nhl-grades.json", {}),
    ]);
    const data = nhlDataFromFiles(raw, pretip, season, grades);
    if (parts.length === 1) return html(renderTeamIndex("nhl", data));
    if (parts.length === 2) {
      const hit = resolveTeamSlug("nhl", data, parts[1]);
      if (!hit) return notFound();
      if (hit.redirect) return Response.redirect(new URL(hit.redirect, ctx.request.url).toString(), 301);
      data.injuries = await getInjuries(ctx, "nhl");
      return html(renderTeamPage("nhl", data, hit.team));
    }
    return notFound();
  }
  return serveHidden(ctx, "nhl");
}
export const onRequestHead = async (ctx) => { const r = await onRequestGet(ctx); return new Response(null, { status: r.status, headers: r.headers }); };
