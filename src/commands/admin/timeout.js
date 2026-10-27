import { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType } from 'discord.js';
import { UserError } from '../../errors.js';
import { assertCanModerate, sendLog } from '../../utils/mod.js';

export const data = new SlashCommandBuilder()
  .setName('كتم')
  .setDescription('كتم عضو مؤقتاً (تايم اوت)')
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .setContexts(InteractionContextType.Guild)
  .addUserOption((o) => o.setName('عضو').setDescription('العضو').setRequired(true))
  .addIntegerOption((o) =>
    o.setName('دقائق').setDescription('المدة بالدقائق (حتى 28 يوم)').setRequired(true).setMinValue(1).setMaxValue(40320),
  )
  .addStringOption((o) => o.setName('سبب').setDescription('السبب').setMaxLength(400));

export async function execute(interaction) {
  const member = interaction.options.getMember('عضو');
  const minutes = interaction.options.getInteger('دقائق', true);
  const reason = interaction.options.getString('سبب') ?? 'بدون سبب';
  if (!member) throw new UserError('العضو مو موجود في السيرفر.');
  assertCanModerate(interaction, member);
  if (!member.moderatable) throw new UserError('ما أقدر أكتم هذا العضو.');

  await member.timeout(minutes * 60_000, `${interaction.user.tag}: ${reason}`);
  await interaction.reply(`🔇 تم كتم <@${member.id}> لمدة ${minutes} دقيقة — السبب: ${reason}`);
  await sendLog(interaction, '🔇 كتم', [
    { name: 'العضو', value: `${member.user.tag} (${member.id})`, inline: true },
    { name: 'المدة', value: `${minutes} دقيقة`, inline: true },
    { name: 'السبب', value: reason },
  ]);
}
