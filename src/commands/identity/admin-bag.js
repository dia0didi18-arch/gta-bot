import { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType } from 'discord.js';
import { addTargetOptions, resolveTargetIdentity } from '../../utils/target.js';
import { addItem, removeItem } from '../../services/inventory.js';
import { listCatalog } from '../../services/items.js';
import { makeAutocomplete } from '../../utils/autocomplete.js';
import { sendLog } from '../../utils/mod.js';
import { config } from '../../config.js';

const withItem = (s) =>
  addTargetOptions(s)
    .addStringOption((o) =>
      o.setName('غرض').setDescription('اسم الغرض').setRequired(true).setMaxLength(32).setAutocomplete(true),
    )
    .addIntegerOption((o) =>
      o.setName('كمية').setDescription('الكمية').setRequired(true).setMinValue(1).setMaxValue(config.maxItemQty),
    );

export const data = new SlashCommandBuilder()
  .setName('ادارة-حقيبة')
  .setDescription('إدارة حقيبة هوية لاعب')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .setContexts(InteractionContextType.Guild)
  .addSubcommand((s) => withItem(s.setName('اضافة').setDescription('إضافة غرض لحقيبة هوية')))
  .addSubcommand((s) => withItem(s.setName('ازالة').setDescription('إزالة غرض من حقيبة هوية')));

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  const { user, identity } = resolveTargetIdentity(interaction);
  const rawItem = interaction.options.getString('غرض', true);
  const qty = interaction.options.getInteger('كمية', true);

  const name =
    sub === 'اضافة'
      ? addItem(identity.id, rawItem, qty, 'admin_add', interaction.user.id)
      : removeItem(identity.id, rawItem, qty, 'admin_remove', interaction.user.id);
  const verb = sub === 'اضافة' ? 'إضافة' : 'إزالة';
  await interaction.reply(`🎒 تمت ${verb} **${name} ×${qty}** — حقيبة ${identity.first_name} ${identity.surname} (<@${user.id}>)`);
  await sendLog(interaction, `🎒 ${verb} غرض`, [
    { name: 'اللاعب', value: `<@${user.id}> / ${identity.first_name} ${identity.surname}` },
    { name: 'الغرض', value: `${name} ×${qty}` },
  ]);
}

export const autocomplete = makeAutocomplete((interaction) =>
  listCatalog(interaction.guildId).map((i) => ({ name: `${i.emoji ? `${i.emoji} ` : ''}${i.name}`, value: i.name })),
);
