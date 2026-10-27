import { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType } from 'discord.js';
import { db } from '../../db.js';
import { UserError } from '../../errors.js';
import { assertCanModerate, sendLog } from '../../utils/mod.js';
import { config } from '../../config.js';

export const data = new SlashCommandBuilder()
  .setName('تحذير')
  .setDescription('إعطاء تحذير لعضو')
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .setContexts(InteractionContextType.Guild)
  .addUserOption((o) => o.setName('عضو').setDescription('العضو').setRequired(true))
  .addStringOption((o) => o.setName('سبب').setDescription('سبب التحذير').setRequired(true).setMaxLength(400));

export async function execute(interaction) {
  const member = interaction.options.getMember('عضو');
  const reason = interaction.options.getString('سبب', true);
  if (!member) throw new UserError('العضو مو موجود في السيرفر.');
  assertCanModerate(interaction, member);

  db.prepare(
    'INSERT INTO warnings (guild_id, user_id, moderator_id, reason, created_at) VALUES (?, ?, ?, ?, ?)',
  ).run(interaction.guildId, member.id, interaction.user.id, reason, Math.floor(Date.now() / 1000));
  const { n } = db
    .prepare('SELECT COUNT(*) AS n FROM warnings WHERE guild_id = ? AND user_id = ?')
    .get(interaction.guildId, member.id);

  // تصعيد تلقائي: كتم لما يوصل العضو لعدد تحذيرات معين
  const step = config.warnEscalation.find((e) => e.count === n);
  let escalation = '';
  if (step && member.moderatable) {
    try {
      await member.timeout(step.minutes * 60_000, `وصل ${n} تحذيرات`);
      escalation = `\n🔇 تم كتمه تلقائياً ${step.minutes} دقيقة (وصل ${n} تحذيرات).`;
    } catch {
      /* ما قدر البوت يكتمه */
    }
  }

  await member.send(`⚠️ وصلك تحذير في **${interaction.guild.name}**\nالسبب: ${reason}`).catch(() => {});
  await interaction.reply(`⚠️ تم تحذير <@${member.id}> (مجموع تحذيراته: ${n}) — السبب: ${reason}${escalation}`);
  await sendLog(interaction, '⚠️ تحذير', [
    { name: 'العضو', value: `${member.user.tag} (${member.id})`, inline: true },
    { name: 'السبب', value: reason },
  ]);
}
