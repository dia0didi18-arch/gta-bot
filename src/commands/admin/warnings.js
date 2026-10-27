import { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, EmbedBuilder, MessageFlags } from 'discord.js';
import { db } from '../../db.js';

export const data = new SlashCommandBuilder()
  .setName('تحذيرات')
  .setDescription('عرض تحذيرات عضو')
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .setContexts(InteractionContextType.Guild)
  .addUserOption((o) => o.setName('عضو').setDescription('العضو').setRequired(true));

export async function execute(interaction) {
  const user = interaction.options.getUser('عضو', true);
  const rows = db
    .prepare('SELECT * FROM warnings WHERE guild_id = ? AND user_id = ? ORDER BY id DESC LIMIT 10')
    .all(interaction.guildId, user.id);

  if (!rows.length) {
    return interaction.reply({ content: 'هذا العضو ما عنده تحذيرات.', flags: MessageFlags.Ephemeral });
  }
  const embed = new EmbedBuilder()
    .setColor(0xd69e2e)
    .setTitle(`⚠️ تحذيرات ${user.tag}`)
    .setDescription(
      rows.map((w) => `**#${w.id}** — <t:${w.created_at}:d> — ${w.reason} (بواسطة <@${w.moderator_id}>)`).join('\n'),
    )
    .setFooter({ text: 'آخر 10 تحذيرات' });
  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}
