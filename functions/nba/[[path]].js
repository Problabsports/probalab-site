// /nba (hub) and /nba/<away>-vs-<home>-prediction-<date>-<id> (game page), rendered on the server for search engines.
import { handleSport } from "../_shared/site.js";
export const onRequestGet = (ctx) => handleSport(ctx, "nba");
