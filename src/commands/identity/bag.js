import { SlashCommandBuilder, InteractionContextType, MessageFlags } from 'discord.js';
import { config } from '../../config.js';
import { UserError } from '../../errors.js';
import { getActive, requireActive } from '../../services/identity.js';
import { listItems, removeItem, giveItem, useItem } from '../../services/inventory.js';
import { bagEmbed, okEmbed } from '../../utils/embeds.js';
import { makeAutocomplete } from '../../utils/autocomplete.js';
import { money } from '../../utils/embeds.js';

export const cooldown = 1500;

const itemOption = (o) =>
  o.setName('غرض').setDescription('اسم الغرض').setRequired(true).setMaxLength(32).setAutocomplete(true);
const qtyOption = (o) =>
  o.setName('كمية').setDescription('الكمية').setRequired(true).setMinValue(1).setMaxValue(config.maxItemQty);

export const data = new SlashCommandBuilder()
  .setName('حقيبة')
  .setDescription('حقيبة هويتك الفعالة')
  .setContexts(InteractionContextType.Guild)
  .addSubcommand((s) => s.setName('عرض').setDescription('عرض محتوى حقيبتك'))
  .addSubcommand((s) => s.setName('استخدام').setDescription('استخدام غرض من حقيبتك').addStringOption(itemOption))
  .addSubcommand((s) =>
    s
      .setName('اعطاء')
      .setDescription('إعطاء غرض للاعب ثاني (لهويته الفعالة)')
      .addUserOption((o) => o.setName('عضو').setDescription('اللاعب').setRequired(true))
      .addStringOption(itemOption)
      .addIntegerOption(qtyOption),
  )
  .addSubcommand((s) =>
    s.setName('رمي').setDescription('رمي غرض من حقيبتك').addStringOption(itemOption).addIntegerOption(qtyOption),
  );

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  const me = requireActive(interaction.guildId, interaction.user.id);
  const eph = { flags: MessageFlags.Ephemeral };

  if (sub === 'عرض') return interaction.reply({ embeds: [bagEmbed(me, listItems(me.id))], ...eph });

  const item = interaction.options.getString('غرض', true);

  if (sub === 'استخدام') {
    const { item: def } = useItem(me.id, item);
    const parts = [`استخدمت **${def.emoji ? `${def.emoji} ` : ''}${def.name}**.`];
    if (def.effect_type === 'cash') parts.push(`💵 حصلت على ${money(def.effect_value)} نقد.`);
    if (def.effect_type === 'bank') parts.push(`🏦 نزل ${money(def.effect_value)} في حسابك البنكي.`);
    if (def.effect_message) parts.push(def.effect_message);
    return interaction.reply({ embeds: [okEmbed(parts.join('\n'))], ...eph });
  }

  const qty = interaction.options.getInteger('كمية', true);

  if (sub === 'رمي') {
    const name = removeItem(me.id, item, qty, 'throw');
    return interaction.reply({ content: `🗑️ رميت **${name} ×${qty}**.`, ...eph });
  }

  // اعطاء
  const target = interaction.options.getUser('عضو', true);
  if (target.bot) throw new UserError('ما تقدر تعطي بوت.');
  const their = getActive(interaction.guildId, target.id);
  if (!their) throw new UserError('اللاعب مو مسجل دخول بأي هوية.');
  const name = giveItem(me.id, their.id, item, qty);
  await interaction.reply(
    `🤝 **${me.first_name} ${me.surname}** أعطى **${their.first_name} ${their.surname}** (<@${target.id}>) الغرض **${name} ×${qty}**`,
  );
}

export const autocomplete = makeAutocomplete((interaction) => {
  const active = getActive(interaction.guildId, interaction.user.id);
  if (!active) return [];
  return listItems(active.id).map((i) => ({ name: `${i.emoji ? `${i.emoji} ` : ''}${i.item} (×${i.quantity})`, value: i.item }));
});
