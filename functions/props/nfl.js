// /props/nfl: NFL player props, data only (bookie prices + player form). See functions/_shared/sport-props.js.
import { asHead } from "../_shared/site.js";
import { sportPropsPage } from "../_shared/sport-props-page.js";

export const onRequestGet = (ctx) => sportPropsPage(ctx, "nfl");
export const onRequestHead = (ctx) => asHead(onRequestGet, ctx);
