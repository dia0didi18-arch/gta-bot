import { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType } from 'discord.js';
import { UserError } from '../../errors.js';
import { assertCanModerate, sendLog } from '../../utils/mod.js';

export const data = new SlashCommandBuilder()
  .setName('حظر')
  .setDescription('حظر عضو من السيرفر')
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
  .setContexts(InteractionContextType.Guild)
  .addUserOption((o) => o.setName('عضو').setDescription('العضو المراد حظره').setRequired(true))
  .addStringOption((o) => o.setName('سبب').setDescription('سبب الحظر').setMaxLength(400))
  .addIntegerOption((o) =>
    o.setName('ايام_الرسائل').setDescription('حذف رسائل آخر كم يوم (0-7)').setMinValue(0).setMaxValue(7),
  );

export async function execute(interaction) {
  const user = interaction.options.getUser('عضو', true);
  const reason = interaction.options.getString('سبب') ?? 'بدون سبب';
  const days = interaction.options.getInteger('ايام_الرسائل') ?? 0;
  const member = interaction.options.getMember('عضو');

  if (member) {
    assertCanModerate(interaction, member);
    if (!member.bannable) throw new UserError('ما أقدر أحظر هذا العضو.');
  } else if (user.id === interaction.user.id) {
    throw new UserError('ما تقدر تحظر نفسك.');
  }

  await interaction.guild.members.ban(user, {
    reason: `${interaction.user.tag}: ${reason}`,
    deleteMessageSeconds: days * 86400,
  });
  await interaction.reply(`🔨 تم حظر <@${user.id}> — السبب: ${reason}`);
  await sendLog(interaction, '🔨 حظر', [
    { name: 'العضو', value: `${user.tag} (${user.id})`, inline: true },
    { name: 'السبب', value: reason },
  ]);
}
