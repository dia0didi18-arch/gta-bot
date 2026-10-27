import { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('بطيء')
  .setDescription('تفعيل الوضع البطيء في الروم (0 = إيقاف)')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .setContexts(InteractionContextType.Guild)
  .addIntegerOption((o) =>
    o.setName('ثواني').setDescription('المدة بالثواني (0-21600)').setRequired(true).setMinValue(0).setMaxValue(21600),
  );

export async function execute(interaction) {
  const seconds = interaction.options.getInteger('ثواني', true);
  await interaction.channel.setRateLimitPerUser(seconds);
  await interaction.reply(seconds ? `🐢 الوضع البطيء: ${seconds} ثانية.` : '✅ تم إيقاف الوضع البطيء.');
}
