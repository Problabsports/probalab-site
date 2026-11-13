// POST /api/discord/interactions — Discord Interactions endpoint for ProbaLab Chat.
// Verifies the Ed25519 signature, answers PING immediately, and defers /ask and
// "Ask ProbaLab" while a follow-up is written through the interaction webhook.
// Never logs tokens, API keys, signatures, or interaction tokens.
import {
  INTERACTION, RESPONSE, discordAskConfig, verifyDiscordSignature, jsonResponse,
  planInteraction, runFollowUp,
} from "../../_shared/discord-ask.js";

export async function onRequestPost(ctx) {
  const env = ctx.env || {};
  const request = ctx.request;
  const raw = await request.text();
  const sig = request.headers.get("x-signature-ed25519");
  const ts = request.headers.get("x-signature-timestamp");
  const pub = discordAskConfig(env).publicKey;
  if (!(await verifyDiscordSignature(pub, sig, ts, raw))) {
    return new Response("invalid request signature", { status: 401 });
  }
  let body = {};
  try { body = JSON.parse(raw); } catch {
    return new Response("invalid request signature", { status: 401 });
  }
  if (body.type === INTERACTION.PING) {
    return jsonResponse({ type: RESPONSE.PONG });
  }
  try {
    const planned = await planInteraction(env, body, request, {
      cache: typeof caches !== "undefined" ? caches.default : null,
    });
    if (planned.job && typeof ctx.waitUntil === "function") {
      ctx.waitUntil(runFollowUp(env, request, planned.job));
    }
    return jsonResponse(planned.response);
  } catch (err) {
    console.log("discord ask interaction failed", err && err.message);
    return jsonResponse({
      type: RESPONSE.CHANNEL_MESSAGE,
      data: { content: "Something went wrong. Please try again, or ask @teamjwc.", flags: 64 },
    });
  }
}

export async function onRequestGet() {
  return jsonResponse({ ok: false, error: "Use POST" }, 405);
}
