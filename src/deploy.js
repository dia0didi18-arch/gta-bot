import { REST, Routes } from 'discord.js';
import { config } from './config.js';
import { loadCommands } from './loader.js';

if (!config.token || !config.clientId) {
  console.error('❌ لازم DISCORD_TOKEN و CLIENT_ID في ملف .env');
  process.exit(1);
}

const commands = [...(await loadCommands()).values()].map((c) => c.data.toJSON());
const rest = new REST({ version: '10' }).setToken(config.token);

const route = config.guildId
  ? Routes.applicationGuildCommands(config.clientId, config.guildId)
  : Routes.applicationCommands(config.clientId);

await rest.put(route, { body: commands });
console.log(
  `✅ تم تسجيل ${commands.length} أمر ${config.guildId ? `في السيرفر ${config.guildId}` : 'بشكل عام (قد يتأخر ظهورها)'}`,
);
