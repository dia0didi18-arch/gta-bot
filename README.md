# FiveM Roleplay Discord Bot (discord.js v14 + SQLite)

## Requirements
- Node.js 20+
- A bot from the Discord Developer Portal (no privileged intents needed)
- Invite scopes: `bot` + `applications.commands`; permissions: View Channel, Send Messages, Embed Links

## Run locally
```bash
npm install
cp .env.example .env     # fill DISCORD_TOKEN (+ optional values)
npm start
```

## Deploy on Render
1. Create a **Background Worker** (not a Web Service: the bot opens no HTTP port).
2. Build command: `npm install` — Start command: `npm start`.
3. Environment: `DISCORD_TOKEN` (+ optional `GUILD_ID`, image URLs). Set `NODE_VERSION=20` or newer if needed.
4. **Persistence:** Render's filesystem is wiped on every deploy/restart. Attach a Persistent Disk
   (e.g. mount path `/var/data`) and set `DB_PATH=/var/data/data.sqlite`, otherwise all characters,
   items and balances are lost.

## Setup in Discord (needs "Manage Server")
- `/panel type:الكل` posts the 3 panels: Characters, Inventory, Bank
- `/admin-item`, `/admin-money` grant items / cash to a player's active character
- `/rules type:...` shows inventory or bank rules (private)

All player replies are ephemeral (only the player sees them).

## Files
- `index.js`    : commands, panels, buttons, select menus, modals, embeds
- `database.js` : SQLite layer; every table is keyed by `character_id`
- `config.js`   : labels, limits, item catalog, rules text, optional image URLs from env
