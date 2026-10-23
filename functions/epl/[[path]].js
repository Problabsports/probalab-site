import { serveHidden } from "../_hidden/serve.js";
export const onRequestGet = (ctx) => serveHidden(ctx, "epl");
