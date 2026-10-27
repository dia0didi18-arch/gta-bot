import { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType } from 'discord.js';
import { UserError } from '../../errors.js';
import { sendLog } from '../../utils/mod.js';

export const data = new SlashCommandBuilder()
  .setName('فك-كتم')
  .setDescription('فك الكتم عن عضو')
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .setContexts(InteractionContextType.Guild)
  .addUserOption((o) => o.setName('عضو').setDescription('العضو').setRequired(true));

export async function execute(interaction) {
  const member = interaction.options.getMember('عضو');
  if (!member) throw new UserError('العضو مو موجود في السيرفر.');
  if (!member.isCommunicationDisabled()) throw new UserError('هذا العضو مو مكتوم.');
  if (!member.moderatable) throw new UserError('ما أقدر أتعامل مع هذا العضو.');

  await member.timeout(null, `${interaction.user.tag}: فك كتم`);
  await interaction.reply(`🔊 تم فك الكتم عن <@${member.id}>`);
  await sendLog(interaction, '🔊 فك كتم', [{ name: 'العضو', value: `${member.user.tag} (${member.id})` }]);
}
