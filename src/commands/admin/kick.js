import { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType } from 'discord.js';
import { UserError } from '../../errors.js';
import { assertCanModerate, sendLog } from '../../utils/mod.js';

export const data = new SlashCommandBuilder()
  .setName('طرد')
  .setDescription('طرد عضو من السيرفر')
  .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
  .setContexts(InteractionContextType.Guild)
  .addUserOption((o) => o.setName('عضو').setDescription('العضو المراد طرده').setRequired(true))
  .addStringOption((o) => o.setName('سبب').setDescription('سبب الطرد').setMaxLength(400));

export async function execute(interaction) {
  const member = interaction.options.getMember('عضو');
  const reason = interaction.options.getString('سبب') ?? 'بدون سبب';
  if (!member) throw new UserError('العضو مو موجود في السيرفر.');
  assertCanModerate(interaction, member);
  if (!member.kickable) throw new UserError('ما أقدر أطرد هذا العضو.');

  await member.kick(`${interaction.user.tag}: ${reason}`);
  await interaction.reply(`👢 تم طرد <@${member.id}> — السبب: ${reason}`);
  await sendLog(interaction, '👢 طرد', [
    { name: 'العضو', value: `${member.user.tag} (${member.id})`, inline: true },
    { name: 'السبب', value: reason },
  ]);
}
