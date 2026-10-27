import { SlashCommandBuilder, InteractionContextType, EmbedBuilder, MessageFlags } from 'discord.js';
import { db } from '../../db.js';

export const cooldown = 5000;

export const data = new SlashCommandBuilder()
  .setName('حالة')
  .setDescription('حالة البوت وإحصائيات السيرفر')
  .setContexts(InteractionContextType.Guild);

const fmtUptime = (s) => {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${d ? `${d} يوم ` : ''}${h} ساعة ${m} دقيقة`;
};

export async function execute(interaction) {
  const g = interaction.guildId;
  const one = (sql, ...p) => db.prepare(sql).get(...p).n;
  const identities = one('SELECT COUNT(*) AS n FROM identities WHERE guild_id = ?', g);
  const online = one('SELECT COUNT(*) AS n FROM sessions WHERE guild_id = ?', g);
  const items = one('SELECT COUNT(*) AS n FROM items WHERE guild_id = ?', g);

  const embed = new EmbedBuilder()
    .setColor(0x2f855a)
    .setTitle('📊 حالة البوت')
    .addFields(
      { name: '🏓 التأخير', value: `${Math.round(interaction.client.ws.ping)}ms`, inline: true },
      { name: '⏱️ مدة التشغيل', value: fmtUptime(process.uptime()), inline: true },
      { name: '🌐 السيرفرات', value: String(interaction.client.guilds.cache.size), inline: true },
      { name: '🪪 الهويات', value: String(identities), inline: true },
      { name: '🟢 مسجلين دخول', value: String(online), inline: true },
      { name: '📦 الأغراض', value: String(items), inline: true },
    );
  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}
