# GTA V FiveM RP Discord Bot (discord.js v14)

## Requirements
- Node.js 20 or newer
- A bot created in the Discord Developer Portal (Bot token). No privileged intents are required.
- Invite the bot with the scopes `bot` + `applications.commands` and permissions: View Channel, Send Messages, Embed Links.

## Install & run
```bash
npm install
cp .env.example .env      # then edit .env and put your DISCORD_TOKEN (and GUILD_ID)
npm start
```

## First-time setup in Discord
1. Run `/panel type:الكل` in the channel(s) where you want the control panels (admins only: needs "Manage Server").
2. Players press the buttons on the panels. Everything is private (ephemeral) to the player.
3. Admins can grant items / money: `/admin-item` and `/admin-money`.

## Files
- `index.js`    : bot, commands, buttons, select menus, modals, embeds
- `database.js` : SQLite layer (characters, inventory, vault, bank) - every table is keyed by `character_id`
- `config.js`   : currency, limits, item catalog, rules text (edit freely)
- `data.sqlite` : created automatically on first run
