import { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, MessageFlags } from 'discord.js';
import { addTargetOptions, resolveTargetIdentity } from '../../utils/target.js';
import { adminAdjustBank, adminAdjustCash, getStatement } from '../../services/bank.js';
import { money, statementEmbed } from '../../utils/embeds.js';
import { sendLog } from '../../utils/mod.js';
import { config } from '../../config.js';

const withAmount = (s) =>
  addTargetOptions(s).addIntegerOption((o) =>
    o.setName('مبلغ').setDescription('المبلغ').setRequired(true).setMinValue(1).setMaxValue(config.maxAmount),
  );

export const data = new SlashCommandBuilder()
  .setName('ادارة-بنك')
  .setDescription('إدارة الحساب البنكي والنقد لهوية لاعب')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .setContexts(InteractionContextType.Guild)
  .addSubcommand((s) => withAmount(s.setName('اضافة').setDescription('إضافة مبلغ لحساب هوية')))
  .addSubcommand((s) => withAmount(s.setName('خصم').setDescription('خصم مبلغ من حساب هوية')))
  .addSubcommand((s) => withAmount(s.setName('اضافة-نقد').setDescription('إضافة نقد لهوية')))
  .addSubcommand((s) => withAmount(s.setName('خصم-نقد').setDescription('خصم نقد من هوية')))
  .addSubcommand((s) => addTargetOptions(s.setName('كشف').setDescription('كشف حساب هوية (آخر 15 حركة)')));

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  const { user, identity } = resolveTargetIdentity(interaction);

  if (sub === 'كشف') {
    return interaction.reply({
      embeds: [statementEmbed(identity, getStatement(identity.id, 15))],
      flags: MessageFlags.Ephemeral,
    });
  }

  const amount = interaction.options.getInteger('مبلغ', true);
  const isCash = sub.endsWith('-نقد');
  const add = sub.startsWith('اضافة');
  const delta = add ? amount : -amount;
  const balances = isCash ? adminAdjustCash(identity.id, delta) : adminAdjustBank(identity.id, delta);
  const verb = add ? 'إضافة' : 'خصم';
  const what = isCash ? 'نقد' : 'رصيد';

  await interaction.reply(
    `🏦 تم ${verb} **${money(amount)}** (${what}) — ${identity.first_name} ${identity.surname} (<@${user.id}>)\n` +
      `النقد: ${money(balances.cash)} · البنك: ${money(balances.balance)}`,
  );
  await sendLog(interaction, `🏦 ${verb} ${what}`, [
    { name: 'اللاعب', value: `<@${user.id}> / ${identity.first_name} ${identity.surname}` },
    { name: 'المبلغ', value: money(amount), inline: true },
  ]);
}
