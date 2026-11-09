import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

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
assert.equal(empty.discordHeroCta(), "");
assert.equal(empty.discordFooterCta(), "");

const ok = await loadWithUrl("https://discord.gg/abc123");
assert.equal(ok.discordInviteConfigured(), true);
assert.match(ok.discordNavLink(), /Join free Discord/);
assert.match(ok.discordNavLink(), /target="_blank"/);
assert.match(ok.discordHeroCta(), /Join our free Discord/);
assert.match(ok.discordHeroCta(), /members channels/);
assert.match(ok.discordFooterCta(), /Join our free Discord/);

const webhook = await loadWithUrl("https://discord.com/api/webhooks/1/x");
assert.equal(webhook.discordInviteConfigured(), false);
assert.equal(webhook.discordNavLink(), "");

console.log("discord-cta.test.mjs ok");
