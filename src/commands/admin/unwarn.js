import { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType } from 'discord.js';
import { db } from '../../db.js';
import { UserError } from '../../errors.js';
import { sendLog } from '../../utils/mod.js';

export const data = new SlashCommandBuilder()
  .setName('حذف-تحذير')
  .setDescription('حذف تحذير برقمه (الرقم يظهر في /تحذيرات)')
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .setContexts(InteractionContextType.Guild)
  .addIntegerOption((o) => o.setName('رقم').setDescription('رقم التحذير').setRequired(true).setMinValue(1));

export async function execute(interaction) {
  const id = interaction.options.getInteger('رقم', true);
  const w = db.prepare('SELECT * FROM warnings WHERE id = ? AND guild_id = ?').get(id, interaction.guildId);
  if (!w) throw new UserError('ما لقيت تحذير بهذا الرقم في هذا السيرفر.');
  db.prepare('DELETE FROM warnings WHERE id = ?').run(id);
  await interaction.reply(`🧽 تم حذف التحذير **#${id}** عن <@${w.user_id}>.`);
  await sendLog(interaction, '🧽 حذف تحذير', [
    { name: 'العضو', value: `<@${w.user_id}>`, inline: true },
    { name: 'السبب الأصلي', value: w.reason.slice(0, 200) },
  ]);
}
