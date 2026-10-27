import { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, MessageFlags } from 'discord.js';
import { sendLog } from '../../utils/mod.js';

export const data = new SlashCommandBuilder()
  .setName('مسح')
  .setDescription('مسح عدد من الرسائل في الروم')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .setContexts(InteractionContextType.Guild)
  .addIntegerOption((o) =>
    o.setName('عدد').setDescription('عدد الرسائل (1-100)').setRequired(true).setMinValue(1).setMaxValue(100),
  );

export async function execute(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const count = interaction.options.getInteger('عدد', true);
  // الرسائل الأقدم من 14 يوم ما تنحذف (قيد ديسكورد)
  const deleted = await interaction.channel.bulkDelete(count, true);
  await interaction.editReply(`🧹 تم مسح ${deleted.size} رسالة.`);
  await sendLog(interaction, '🧹 مسح رسائل', [
    { name: 'الروم', value: `<#${interaction.channelId}>`, inline: true },
    { name: 'العدد', value: String(deleted.size), inline: true },
  ]);
}
