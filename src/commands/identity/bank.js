import { SlashCommandBuilder, InteractionContextType, MessageFlags } from 'discord.js';
import { config } from '../../config.js';
import { UserError } from '../../errors.js';
import { requireActive } from '../../services/identity.js';
import { getBalances, getStatement, deposit, withdraw, transfer } from '../../services/bank.js';
import { money, bankEmbed, statementEmbed } from '../../utils/embeds.js';

export const cooldown = 2000;

const amountOption = (o) =>
  o.setName('مبلغ').setDescription('المبلغ').setRequired(true).setMinValue(1).setMaxValue(config.maxAmount);

export const data = new SlashCommandBuilder()
  .setName('بنك')
  .setDescription('الحساب البنكي لهويتك الفعالة')
  .setContexts(InteractionContextType.Guild)
  .addSubcommand((s) => s.setName('رصيد').setDescription('عرض رصيدك'))
  .addSubcommand((s) => s.setName('كشف').setDescription('آخر حركات حسابك البنكي'))
  .addSubcommand((s) => s.setName('ايداع').setDescription('إيداع نقد في حسابك').addIntegerOption(amountOption))
  .addSubcommand((s) => s.setName('سحب').setDescription('سحب من حسابك إلى النقد').addIntegerOption(amountOption))
  .addSubcommand((s) =>
    s
      .setName('تحويل')
      .setDescription('تحويل لحساب بنكي ثاني عن طريق رقم الحساب')
      .addStringOption((o) =>
        o.setName('رقم_الحساب').setDescription(`رقم الحساب (IBAN) مثل ${config.ibanPrefix}0123456789`).setRequired(true).setMaxLength(16),
      )
      .addIntegerOption(amountOption),
  );

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  const me = requireActive(interaction.guildId, interaction.user.id);
  const eph = { flags: MessageFlags.Ephemeral };

  if (sub === 'رصيد') return interaction.reply({ embeds: [bankEmbed(me, getBalances(me.id))], ...eph });
  if (sub === 'كشف') return interaction.reply({ embeds: [statementEmbed(me, getStatement(me.id, 10))], ...eph });

  const amount = interaction.options.getInteger('مبلغ', true);

  if (sub === 'ايداع') {
    return interaction.reply({
      embeds: [bankEmbed(me, deposit(me.id, amount), '✅ تم الإيداع', `أودعت ${money(amount)}`)],
      ...eph,
    });
  }
  if (sub === 'سحب') {
    return interaction.reply({
      embeds: [bankEmbed(me, withdraw(me.id, amount), '✅ تم السحب', `سحبت ${money(amount)}`)],
      ...eph,
    });
  }

  // تحويل
  const iban = interaction.options.getString('رقم_الحساب', true);
  if (!/^[A-Z]{2}\d{10}$/i.test(iban.trim())) {
    throw new UserError(`صيغة رقم الحساب غير صحيحة (مثال: ${config.ibanPrefix}0123456789).`);
  }
  const { balances, target, fee } = transfer(me.id, iban, amount);
  const extra = `حولت ${money(amount)} إلى **${target.first_name} ${target.surname}**${fee ? `\nالرسوم: ${money(fee)}` : ''}`;
  await interaction.reply({ embeds: [bankEmbed(me, balances, '✅ تم التحويل', extra)], ...eph });
}
