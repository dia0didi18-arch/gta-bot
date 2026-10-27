import { Client, Events, GatewayIntentBits, ActivityType } from 'discord.js';
import { config } from './config.js';
import { db } from './db.js';
import { loadCommands } from './loader.js';
import { handleInteraction } from './events/interactionCreate.js';
import { startBackups } from './backup.js';

if (!config.token) {
  console.error('❌ DISCORD_TOKEN غير موجود. انسخ .env.example إلى .env وعبّه.');
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = await loadCommands();

client.once(Events.ClientReady, (c) => {
  console.log(`✅ البوت شغال: ${c.user.tag} — ${client.commands.size} أمر`);
  c.user.setActivity('نظام الهويات', { type: ActivityType.Watching });
  startBackups();
});
client.on(Events.InteractionCreate, handleInteraction);
client.on(Events.Error, (e) => console.error(e));
process.on('unhandledRejection', (e) => console.error('unhandledRejection:', e));

// إغلاق نظيف (Render يرسل SIGTERM عند إعادة النشر) عشان ما تتلف القاعدة
let closing = false;
function shutdown(signal) {
  if (closing) return;
  closing = true;
  console.log(`⏹️ ${signal}: إغلاق البوت...`);
  client.destroy();
  try {
    db.close();
  } catch {
    /* ignore */
  }
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

await client.login(config.token);
