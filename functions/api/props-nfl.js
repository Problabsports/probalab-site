// GET /api/props-nfl: the full NFL props board (rendered rows) for signed-in members. Everyone else gets 401.
import { sportPropsApi } from "../_shared/sport-props-page.js";

export const onRequestGet = (ctx) => sportPropsApi(ctx, "nfl");
