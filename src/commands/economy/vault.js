import { SlashCommandBuilder, InteractionContextType, MessageFlags } from 'discord.js';
import { config } from '../../config.js';
import { getActive, requireActive } from '../../services/identity.js';
import { listItems, listVault, vaultDeposit, vaultWithdraw } from '../../services/inventory.js';
import { vaultEmbed } from '../../utils/embeds.js';
import { makeAutocomplete } from '../../utils/autocomplete.js';

export const cooldown = 1500;

const itemOption = (o) =>
  o.setName('غرض').setDescription('اسم الغرض').setRequired(true).setMaxLength(32).setAutocomplete(true);
const qtyOption = (o) =>
  o.setName('كمية').setDescription('الكمية').setRequired(true).setMinValue(1).setMaxValue(config.maxItemQty);

export const data = new SlashCommandBuilder()
  .setName('خزنة')
  .setDescription('خزنة هويتك الفعالة (تخزين أغراض بعيداً عن الحقيبة)')
  .setContexts(InteractionContextType.Guild)
  .addSubcommand((s) => s.setName('عرض').setDescription('عرض محتوى خزنتك'))
  .addSubcommand((s) => s.setName('ايداع').setDescription('نقل غرض من الحقيبة إلى الخزنة').addStringOption(itemOption).addIntegerOption(qtyOption))
  .addSubcommand((s) => s.setName('سحب').setDescription('نقل غرض من الخزنة إلى الحقيبة').addStringOption(itemOption).addIntegerOption(qtyOption));

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  const me = requireActive(interaction.guildId, interaction.user.id);
  const eph = { flags: MessageFlags.Ephemeral };

  if (sub === 'عرض') return interaction.reply({ embeds: [vaultEmbed(me, listVault(me.id))], ...eph });

  const item = interaction.options.getString('غرض', true);
  const qty = interaction.options.getInteger('كمية', true);
  if (sub === 'ايداع') {
    const name = vaultDeposit(me.id, item, qty);
    return interaction.reply({ content: `🔐 وضعت **${name} ×${qty}** في الخزنة.`, ...eph });
  }
  const name = vaultWithdraw(me.id, item, qty);
  await interaction.reply({ content: `🎒 سحبت **${name} ×${qty}** من الخزنة إلى حقيبتك.`, ...eph });
}

export const autocomplete = makeAutocomplete((interaction) => {
  const active = getActive(interaction.guildId, interaction.user.id);
  if (!active) return [];
  const list = interaction.options.getSubcommand() === 'ايداع' ? listItems(active.id) : listVault(active.id);
  return list.map((i) => ({ name: `${i.emoji ? `${i.emoji} ` : ''}${i.item} (×${i.quantity})`, value: i.item }));
});
