import { SlashCommandBuilder, InteractionContextType, MessageFlags } from 'discord.js';
import { requireActive } from '../../services/identity.js';
import { getBalances } from '../../services/bank.js';
import { listItems } from '../../services/inventory.js';
import { identityEmbed } from '../../utils/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('هويتي')
  .setDescription('عرض هويتك الفعالة حالياً')
  .setContexts(InteractionContextType.Guild);

export async function execute(interaction) {
  const identity = requireActive(interaction.guildId, interaction.user.id);
  const embed = identityEmbed(identity, getBalances(identity.id), listItems(identity.id), interaction.user);
  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}
