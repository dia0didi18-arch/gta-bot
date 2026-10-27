import { EmbedBuilder } from 'discord.js';
import { config, slotLabel, jobLabel, jobByKey } from '../config.js';

export const money = (n) => `${Number(n).toLocaleString('en-US')} ${config.currency}`;
const clip = (text, max = 1000) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);
export const itemLine = (i) => `${i.emoji ? `${i.emoji} ` : '• '}**${i.item ?? i.name}** ×${i.quantity}`;

export function identityEmbed(identity, balances, items, user) {
  const bag = items.length
    ? items
        .slice(0, 10)
        .map((i) => `${i.emoji ? `${i.emoji} ` : '• '}${i.item} ×${i.quantity}`)
        .join('\n') + (items.length > 10 ? `\n… و${items.length - 10} أغراض أخرى` : '')
    : 'فارغة';

  const job = jobByKey(identity.job);
  const embed = new EmbedBuilder()
    .setColor(0x2b6cb0)
    .setTitle(`🪪 ${identity.first_name} ${identity.surname}`)
    .setDescription(slotLabel(identity.slot))
    .addFields(
      { name: 'الجنس', value: identity.gender, inline: true },
      { name: 'الجنسية', value: identity.nationality, inline: true },
      { name: '💼 الوظيفة', value: job ? `${job.label}${job.salary ? ` (${money(job.salary)})` : ''}` : jobLabel(identity.job), inline: true },
      { name: '💵 النقد', value: money(balances.cash), inline: true },
      { name: '🏦 رصيد البنك', value: money(balances.balance), inline: true },
      { name: 'رقم الحساب (IBAN)', value: `\`${balances.iban}\``, inline: true },
      { name: '🎒 الحقيبة', value: clip(bag) },
    )
    .setTimestamp(identity.created_at * 1000)
    .setFooter({ text: 'تاريخ إنشاء الهوية' });
  if (user) embed.setThumbnail(user.displayAvatarURL());
  return embed;
}

export function bagEmbed(identity, items) {
  return new EmbedBuilder()
    .setColor(0x975a16)
    .setTitle(`🎒 حقيبة ${identity.first_name} ${identity.surname}`)
    .setDescription(items.length ? clip(items.map(itemLine).join('\n'), 4000) : 'الحقيبة فارغة.')
    .setFooter({ text: `${items.length}/${config.maxItemTypes} نوع` });
}

export function vaultEmbed(identity, items) {
  return new EmbedBuilder()
    .setColor(0x553c9a)
    .setTitle(`🔐 خزنة ${identity.first_name} ${identity.surname}`)
    .setDescription(items.length ? clip(items.map(itemLine).join('\n'), 4000) : 'الخزنة فارغة.')
    .setFooter({ text: `${items.length}/${config.vaultMaxTypes} نوع` });
}

export function bankEmbed(identity, b, title = '🏦 حسابك البنكي', extra = null) {
  return new EmbedBuilder()
    .setColor(0x2f855a)
    .setTitle(title)
    .setDescription(extra ?? null)
    .addFields(
      { name: '💵 النقد', value: money(b.cash), inline: true },
      { name: '🏦 البنك', value: money(b.balance), inline: true },
      { name: 'رقم الحساب', value: `\`${b.iban}\``, inline: true },
    )
    .setFooter({ text: `${identity.first_name} ${identity.surname}` });
}

const BANK_LABELS = {
  deposit: '📥 إيداع',
  withdraw: '📤 سحب',
  transfer_out: '💸 تحويل صادر',
  transfer_in: '💰 تحويل وارد',
  fee: '🧾 رسوم',
  salary: '💵 راتب',
  item_effect: '🎁 أثر غرض',
  admin_add: '🛠️ إضافة إدارية (بنك)',
  admin_remove: '🛠️ خصم إداري (بنك)',
  admin_cash_add: '🛠️ إضافة إدارية (نقد)',
  admin_cash_remove: '🛠️ خصم إداري (نقد)',
};

export function statementEmbed(identity, rows) {
  const lines = rows.map(
    (r) =>
      `<t:${r.created_at}:d> ${BANK_LABELS[r.type] ?? r.type} — **${money(r.amount)}**${r.note ? ` · ${clip(r.note, 40)}` : ''}`,
  );
  return new EmbedBuilder()
    .setColor(0x2f855a)
    .setTitle(`🧾 كشف حساب ${identity.first_name} ${identity.surname}`)
    .setDescription(lines.length ? clip(lines.join('\n'), 4000) : 'ما فيه حركات بعد.')
    .setFooter({ text: `آخر ${rows.length} حركة` });
}

export function shopEmbed(items) {
  const lines = items.map(
    (i) =>
      `${i.emoji ? `${i.emoji} ` : '• '}**${i.name}** — ${money(i.price)} (بيع: ${money(Math.floor(i.price * config.sellRatio))})${
        i.description ? `\n  ↳ ${i.description}` : ''
      }`,
  );
  return new EmbedBuilder()
    .setColor(0xdd6b20)
    .setTitle('🛒 المتجر')
    .setDescription(lines.length ? clip(lines.join('\n'), 4000) : 'المتجر فاضي حالياً.')
    .setFooter({ text: 'اشتري بـ /متجر شراء — يُدفع من النقد' });
}

export function leaderboardEmbed(rows) {
  const medals = ['🥇', '🥈', '🥉'];
  const lines = rows.map(
    (r, i) => `${medals[i] ?? `**${i + 1}.**`} ${r.first_name} ${r.surname} — ${money(r.total)}`,
  );
  return new EmbedBuilder()
    .setColor(0xd69e2e)
    .setTitle('🏆 أغنى الشخصيات')
    .setDescription(lines.length ? lines.join('\n') : 'ما فيه شخصيات بعد.')
    .setFooter({ text: 'المجموع = النقد + رصيد البنك' });
}

export const okEmbed = (text) => new EmbedBuilder().setColor(0x2f855a).setDescription(`✅ ${text}`);
export const errEmbed = (text) => new EmbedBuilder().setColor(0xc53030).setDescription(`❌ ${text}`);
