// The NFL props sample board is members-only: block direct public reads of the raw JSON.
import { sportFixtureGuard } from "../../_shared/sport-props-page.js";

export const onRequestGet = (ctx) => sportFixtureGuard(ctx, "nfl");
export const onRequestHead = async (ctx) => { const r = await onRequestGet(ctx); return new Response(null, { status: r.status, headers: r.headers }); };
