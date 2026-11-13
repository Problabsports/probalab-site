#!/usr/bin/env node
// Register /ask and the "Ask ProbaLab" message command for the ProbaLab Chat app.
// Reads DISCORD_CHAT_APP_ID and DISCORD_CHAT_BOT_TOKEN from the environment.
// If DISCORD_GUILD_ID is set, registers guild commands (preview; they appear at once).
// Otherwise registers global commands (can take up to an hour).
// Do not run this until John has put the bot token in via secret-request and asked for it.
// Never print the token.

const APP_ID = String(process.env.DISCORD_CHAT_APP_ID || "").trim();
const TOKEN = String(process.env.DISCORD_CHAT_BOT_TOKEN || "");
const GUILD_ID = String(process.env.DISCORD_GUILD_ID || "").trim();

if (!/^\d{15,22}$/.test(APP_ID)) {
  console.error("Set DISCORD_CHAT_APP_ID to the ProbaLab Chat application id.");
  process.exit(1);
}
if (!TOKEN) {
  console.error("Set DISCORD_CHAT_BOT_TOKEN (do not paste it into chat).");
  process.exit(1);
}

const commands = [
  {
    name: "ask",
    type: 1,
    description: "Ask ProbaLab about lights, records, or today's predictions",
    options: [
      {
        name: "question",
        description: "What do you want to know?",
        type: 3,
        required: true,
      },
    ],
  },
  {
    name: "Ask ProbaLab",
    type: 3,
  },
];

const path = GUILD_ID
  ? `/applications/${APP_ID}/guilds/${GUILD_ID}/commands`
  : `/applications/${APP_ID}/commands`;

const res = await fetch(`https://discord.com/api/v10${path}`, {
  method: "PUT",
  headers: {
    authorization: `Bot ${TOKEN}`,
    "content-type": "application/json",
  },
  body: JSON.stringify(commands),
});

if (!res.ok) {
  console.error("Command registration failed:", res.status);
  process.exit(1);
}

const saved = await res.json();
const names = (Array.isArray(saved) ? saved : []).map((c) => c.name).join(", ");
console.log(
  GUILD_ID
    ? `Registered guild commands (${names || "/ask, Ask ProbaLab"}) for preview.`
    : `Registered global commands (${names || "/ask, Ask ProbaLab"}). They can take up to an hour to appear.`,
);
