import { SlashCommandBuilder, InteractionContextType, MessageFlags } from 'discord.js';
import { requireActive } from '../../services/identity.js';
import { getBalances } from '../../services/bank.js';
import { claimSalary } from '../../services/economy.js';
import { bankEmbed, money } from '../../utils/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('راتب')
  .setDescription('استلام راتب وظيفة هويتك الفعالة (ينزل في البنك)')
  .setContexts(InteractionContextType.Guild);

export async function execute(interaction) {
  const me = requireActive(interaction.guildId, interaction.user.id);
  const { job, amount } = claimSalary(me.id);
  await interaction.reply({
    embeds: [bankEmbed(me, getBalances(me.id), '💵 تم استلام الراتب', `راتب **${job.label}**: ${money(amount)} نزل في حسابك البنكي.`)],
    flags: MessageFlags.Ephemeral,
  });
}
