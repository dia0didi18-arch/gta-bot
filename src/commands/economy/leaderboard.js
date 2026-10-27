import { SlashCommandBuilder, InteractionContextType } from 'discord.js';
import { leaderboard } from '../../services/economy.js';
import { leaderboardEmbed } from '../../utils/embeds.js';

export const cooldown = 5000;

export const data = new SlashCommandBuilder()
  .setName('الاغنى')
  .setDescription('قائمة أغنى 10 شخصيات في السيرفر')
  .setContexts(InteractionContextType.Guild);

export async function execute(interaction) {
  await interaction.reply({ embeds: [leaderboardEmbed(leaderboard(interaction.guildId, 10))] });
}
