import { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType } from 'discord.js';
import { sendLog } from '../../utils/mod.js';

export const data = new SlashCommandBuilder()
  .setName('قفل')
  .setDescription('قفل الروم الحالي (منع الكتابة)')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .setContexts(InteractionContextType.Guild);

export async function execute(interaction) {
  await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false });
  await interaction.reply('🔒 تم قفل الروم.');
  await sendLog(interaction, '🔒 قفل روم', [{ name: 'الروم', value: `<#${interaction.channelId}>` }]);
}
