# LiGoN CiTY - FiveM RP Discord Bot (discord.js v14)

## Requirements
- Node.js 20+
- A bot from the Discord Developer Portal (no privileged intents needed)
- Invite scopes: `bot` + `applications.commands`; permissions: View Channel, Send Messages, Embed Links

## Install & run
```bash
npm install
cp .env.example .env     # fill DISCORD_TOKEN (+ GUILD_ID, optional image URLs)
npm start
```

## Setup in Discord (needs "Manage Server")
- `/panel type:الكل`  posts the 3 panels: Characters, Inventory, GULF DREAM Bank
- `/admin-item`, `/admin-money`  grant items / cash to a player's active character
- `/rules type:...`  shows inventory or bank rules (private)

All player replies are ephemeral (only the player sees them).

## Files
- `index.js`    : commands, panels, buttons, select menus, modals, embeds
- `database.js` : SQLite layer; every table is keyed by `character_id` (fully independent characters)
- `config.js`   : branding, limits, item catalog, rules text
- `data.sqlite` : created automatically on first run
