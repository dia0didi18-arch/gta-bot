import { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType } from 'discord.js';
import { sendLog } from '../../utils/mod.js';

export const data = new SlashCommandBuilder()
  .setName('فتح')
  .setDescription('فتح الروم الحالي')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .setContexts(InteractionContextType.Guild);

export async function execute(interaction) {
  await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: null });
  await interaction.reply('🔓 تم فتح الروم.');
  await sendLog(interaction, '🔓 فتح روم', [{ name: 'الروم', value: `<#${interaction.channelId}>` }]);
}
