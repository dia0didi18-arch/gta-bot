import { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, EmbedBuilder, MessageFlags } from 'discord.js';
import { config } from '../../config.js';
import { defineItem, removeDefinition, listCatalog } from '../../services/items.js';
import { makeAutocomplete } from '../../utils/autocomplete.js';
import { sendLog } from '../../utils/mod.js';
import { money } from '../../utils/embeds.js';

const nameOpt = (o) => o.setName('اسم').setDescription('اسم الغرض').setRequired(true).setMaxLength(32).setAutocomplete(true);

export const data = new SlashCommandBuilder()
  .setName('ادارة-غرض')
  .setDescription('إدارة قائمة الأغراض (المتجر والاستخدام)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .setContexts(InteractionContextType.Guild)
  .addSubcommand((s) =>
    s
      .setName('ضبط')
      .setDescription('إنشاء غرض جديد أو تعديل غرض موجود (الحقول الفاضية تبقى كما هي)')
      .addStringOption(nameOpt)
      .addStringOption((o) => o.setName('ايموجي').setDescription('ايموجي الغرض').setMaxLength(40))
      .addStringOption((o) => o.setName('وصف').setDescription('وصف قصير').setMaxLength(100))
      .addIntegerOption((o) =>
        o.setName('سعر').setDescription('سعر الشراء في المتجر (0 = غير معروض)').setMinValue(0).setMaxValue(config.maxAmount),
      )
      .addBooleanOption((o) => o.setName('قابل_للاستخدام').setDescription('يقدر اللاعب يستخدمه بـ /حقيبة استخدام'))
      .addBooleanOption((o) => o.setName('يستهلك').setDescription('ينحذف واحد منه عند الاستخدام (الافتراضي: نعم)'))
      .addStringOption((o) =>
        o
          .setName('الاثر')
          .setDescription('أثر الاستخدام')
          .addChoices(
            { name: 'بدون أثر (رسالة فقط)', value: 'none' },
            { name: 'يعطي نقد', value: 'cash' },
            { name: 'يعطي رصيد بنك', value: 'bank' },
          ),
      )
      .addIntegerOption((o) => o.setName('قيمة_الاثر').setDescription('مبلغ الأثر').setMinValue(0).setMaxValue(config.maxAmount))
      .addStringOption((o) => o.setName('رسالة_الاستخدام').setDescription('رسالة تظهر عند الاستخدام').setMaxLength(150)),
  )
  .addSubcommand((s) => s.setName('حذف').setDescription('حذف غرض من القائمة (ويُحذف من كل الحقائب والخزائن)').addStringOption(nameOpt))
  .addSubcommand((s) => s.setName('قائمة').setDescription('عرض كل الأغراض المعرّفة'));

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  const g = interaction.guildId;

  if (sub === 'قائمة') {
    const items = listCatalog(g);
    const lines = items.map(
      (i) =>
        `${i.emoji ? `${i.emoji} ` : '• '}**${i.name}** — ${i.price ? money(i.price) : 'غير معروض'}${i.usable ? ' · قابل للاستخدام' : ''}${
          i.effect_type !== 'none' ? ` · أثر: ${i.effect_type === 'cash' ? 'نقد' : 'بنك'} ${money(i.effect_value)}` : ''
        }`,
    );
    let text = lines.join('\n') || 'ما فيه أغراض معرّفة. أنشئ أول غرض بـ /ادارة-غرض ضبط';
    if (text.length > 4000) text = `${text.slice(0, 3990)}…`;
    const embed = new EmbedBuilder().setColor(0x2b6cb0).setTitle(`📦 الأغراض (${items.length})`).setDescription(text);
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  const name = interaction.options.getString('اسم', true);

  if (sub === 'حذف') {
    const def = removeDefinition(g, name);
    await interaction.reply(`🗑️ تم حذف الغرض **${def.name}** من القائمة ومن كل الحقائب والخزائن.`);
    return sendLog(interaction, '🗑️ حذف غرض', [{ name: 'الغرض', value: def.name }]);
  }

  const o = interaction.options;
  const { item, created } = defineItem(g, name, {
    emoji: o.getString('ايموجي'),
    description: o.getString('وصف'),
    price: o.getInteger('سعر'),
    usable: o.getBoolean('قابل_للاستخدام'),
    consumable: o.getBoolean('يستهلك'),
    effect_type: o.getString('الاثر'),
    effect_value: o.getInteger('قيمة_الاثر'),
    effect_message: o.getString('رسالة_الاستخدام'),
  });
  await interaction.reply({
    content:
      `${created ? '🆕 تم إنشاء' : '✏️ تم تعديل'} الغرض ${item.emoji ?? ''} **${item.name}** — ` +
      `${item.price ? `السعر ${money(item.price)}` : 'غير معروض في المتجر'}${item.usable ? ' · قابل للاستخدام' : ''}`,
    flags: MessageFlags.Ephemeral,
  });
  await sendLog(interaction, created ? '🆕 إنشاء غرض' : '✏️ تعديل غرض', [{ name: 'الغرض', value: item.name }]);
}

export const autocomplete = makeAutocomplete((interaction) =>
  listCatalog(interaction.guildId).map((i) => ({ name: `${i.emoji ? `${i.emoji} ` : ''}${i.name}`, value: i.name })),
);
