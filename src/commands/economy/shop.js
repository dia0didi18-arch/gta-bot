import { SlashCommandBuilder, InteractionContextType, MessageFlags } from 'discord.js';
import { config } from '../../config.js';
import { requireActive } from '../../services/identity.js';
import { listShop } from '../../services/items.js';
import { listItems } from '../../services/inventory.js';
import { buyItem, sellItem, sellPrice } from '../../services/economy.js';
import { shopEmbed, okEmbed, money } from '../../utils/embeds.js';
import { makeAutocomplete } from '../../utils/autocomplete.js';

export const cooldown = 1500;

const itemOption = (o) =>
  o.setName('غرض').setDescription('اسم الغرض').setRequired(true).setMaxLength(32).setAutocomplete(true);
const qtyOption = (o) =>
  o.setName('كمية').setDescription('الكمية').setRequired(true).setMinValue(1).setMaxValue(config.maxItemQty);

export const data = new SlashCommandBuilder()
  .setName('متجر')
  .setDescription('شراء وبيع الأغراض')
  .setContexts(InteractionContextType.Guild)
  .addSubcommand((s) => s.setName('عرض').setDescription('عرض أغراض المتجر وأسعارها'))
  .addSubcommand((s) => s.setName('شراء').setDescription('شراء غرض (يُدفع من النقد)').addStringOption(itemOption).addIntegerOption(qtyOption))
  .addSubcommand((s) => s.setName('بيع').setDescription('بيع غرض من حقيبتك للمتجر').addStringOption(itemOption).addIntegerOption(qtyOption));

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  const eph = { flags: MessageFlags.Ephemeral };

  if (sub === 'عرض') return interaction.reply({ embeds: [shopEmbed(listShop(interaction.guildId))], ...eph });

  const me = requireActive(interaction.guildId, interaction.user.id);
  const item = interaction.options.getString('غرض', true);
  const qty = interaction.options.getInteger('كمية', true);

  if (sub === 'شراء') {
    const r = buyItem(me.id, item, qty);
    return interaction.reply({ embeds: [okEmbed(`اشتريت **${r.item.name} ×${r.qty}** بسعر ${money(r.total)}.`)], ...eph });
  }
  const r = sellItem(me.id, item, qty);
  await interaction.reply({ embeds: [okEmbed(`بعت **${r.item.name} ×${r.qty}** وحصلت على ${money(r.total)} نقد.`)], ...eph });
}

export const autocomplete = makeAutocomplete((interaction) => {
  const sub = interaction.options.getSubcommand();
  if (sub === 'شراء') {
    return listShop(interaction.guildId).map((i) => ({
      name: `${i.emoji ? `${i.emoji} ` : ''}${i.name} — ${money(i.price)}`,
      value: i.name,
    }));
  }
  const active = requireActiveSafe(interaction);
  if (!active) return [];
  return listItems(active.id)
    .filter((i) => i.price > 0)
    .map((i) => ({ name: `${i.emoji ? `${i.emoji} ` : ''}${i.item} (×${i.quantity}) — ${money(sellPrice(i))}`, value: i.item }));
});

function requireActiveSafe(interaction) {
  try {
    return requireActive(interaction.guildId, interaction.user.id);
  } catch {
    return null;
  }
}
