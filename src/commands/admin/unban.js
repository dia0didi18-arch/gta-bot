import { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType } from 'discord.js';
import { UserError } from '../../errors.js';
import { sendLog } from '../../utils/mod.js';

export const data = new SlashCommandBuilder()
  .setName('فك-حظر')
  .setDescription('فك الحظر عن عضو')
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
  .setContexts(InteractionContextType.Guild)
  .addStringOption((o) => o.setName('ايدي').setDescription('ايدي العضو المحظور').setRequired(true))
  .addStringOption((o) => o.setName('سبب').setDescription('السبب').setMaxLength(400));

export async function execute(interaction) {
  const id = interaction.options.getString('ايدي', true).trim();
  const reason = interaction.options.getString('سبب') ?? 'بدون سبب';
  if (!/^\d{15,22}$/.test(id)) throw new UserError('الايدي غير صحيح.');

  const ban = await interaction.guild.bans.fetch(id).catch(() => null);
  if (!ban) throw new UserError('هذا العضو مو محظور.');

  await interaction.guild.members.unban(id, `${interaction.user.tag}: ${reason}`);
  await interaction.reply(`✅ تم فك الحظر عن **${ban.user.tag}**`);
  await sendLog(interaction, '✅ فك حظر', [{ name: 'العضو', value: `${ban.user.tag} (${id})` }]);
}
