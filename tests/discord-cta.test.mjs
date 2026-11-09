import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const src = readFileSync(new URL("../functions/_shared/discord.js", import.meta.url), "utf8");

async function loadWithUrl(url) {
  const dir = mkdtempSync(join(tmpdir(), "pl-discord-"));
  const patched = src.replace(/export const DISCORD_INVITE_URL = "[^"]*";/, `export const DISCORD_INVITE_URL = "${url}";`);
  const file = join(dir, "discord.js");
  writeFileSync(file, patched);
  return import(pathToFileURL(file).href + "?t=" + Date.now());
}

const empty = await loadWithUrl("");
assert.equal(empty.discordInviteConfigured(), false);
assert.equal(empty.discordNavLink(), "");
assert.match(empty.xNavLink(), /probalabsports/);
assert.match(empty.xHeroCta(), /Follow @probalabsports on X/);
assert.match(empty.socialHeroStack(), /x-cta-hero/);
assert.doesNotMatch(empty.socialHeroStack(), /closingline/i);

const ok = await loadWithUrl("https://discord.gg/abc123");
assert.equal(ok.discordInviteConfigured(), true);
assert.match(ok.discordNavLink(), /Join free Discord/);
assert.match(ok.socialHeroStack(), /discord-cta-hero/);
assert.match(ok.socialHeroStack(), /x-cta-hero/);
assert.match(ok.socialFooterStack(), /discord-cta-footer/);
assert.match(ok.socialFooterStack(), /x-cta-footer/);
assert.equal(ok.X_PROFILE_URL, "https://x.com/probalabsports");

const webhook = await loadWithUrl("https://discord.com/api/webhooks/1/x");
assert.equal(webhook.discordInviteConfigured(), false);

console.log("discord-cta.test.mjs ok");
