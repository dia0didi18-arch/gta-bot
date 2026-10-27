import { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, EmbedBuilder, MessageFlags } from 'discord.js';
import { db } from '../../db.js';

export const data = new SlashCommandBuilder()
  .setName('ادارة-سجل')
  .setDescription('آخر الإجراءات الإدارية المسجلة في السيرفر')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .setContexts(InteractionContextType.Guild)
  .addIntegerOption((o) => o.setName('عدد').setDescription('كم سطر (1-20)').setMinValue(1).setMaxValue(20));

export async function execute(interaction) {
  const n = interaction.options.getInteger('عدد') ?? 10;
  const rows = db.prepare('SELECT * FROM audit_log WHERE guild_id = ? ORDER BY id DESC LIMIT ?').all(interaction.guildId, n);
  let text = rows
    .map((r) => `<t:${r.created_at}:R> <@${r.actor_id}> — **${r.action}**${r.details ? `\n  ↳ ${r.details.slice(0, 160)}` : ''}`)
    .join('\n');
  if (!text) text = 'ما فيه إجراءات مسجلة بعد.';
  if (text.length > 4000) text = `${text.slice(0, 3990)}…`;
  const embed = new EmbedBuilder().setColor(0xdd6b20).setTitle('📜 سجل الإدارة').setDescription(text);
  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}
