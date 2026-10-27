import { EmbedBuilder } from 'discord.js';
import { db } from '../db.js';
import { UserError } from '../errors.js';
import { config } from '../config.js';

/** يتأكد إن المشرف والبوت يقدرون يتعاملون مع العضو (الرتب). */
export function assertCanModerate(interaction, target) {
  const { guild, user } = interaction;
  if (target.id === user.id) throw new UserError('ما تقدر تطبق هذا على نفسك.');
  if (target.id === guild.ownerId) throw new UserError('ما تقدر تطبق هذا على مالك السيرفر.');
  if (target.id === interaction.client.user.id) throw new UserError('ما تقدر تطبق هذا على البوت.');

  const me = guild.members.me;
  if (target.roles.highest.position >= me.roles.highest.position) {
    throw new UserError('رتبة العضو أعلى من أو تساوي رتبة البوت.');
  }
  if (user.id !== guild.ownerId && target.roles.highest.position >= interaction.member.roles.highest.position) {
    throw new UserError('رتبة العضو أعلى من أو تساوي رتبتك.');
  }
}

/** يسجل الإجراء الإداري في قاعدة البيانات (سجل التدقيق) ويرسله لروم اللوق لو محدد في .env. */
export async function sendLog(interaction, title, fields = []) {
  try {
    db.prepare('INSERT INTO audit_log (guild_id, actor_id, action, details, created_at) VALUES (?, ?, ?, ?, ?)').run(
      interaction.guildId,
      interaction.user.id,
      title,
      fields.map((f) => `${f.name}: ${f.value}`).join(' | ').slice(0, 900),
      Math.floor(Date.now() / 1000),
    );
  } catch (err) {
    console.error('تعذر حفظ سجل التدقيق:', err.message);
  }

  if (!config.logChannelId) return;
  try {
    const channel = await interaction.client.channels.fetch(config.logChannelId);
    const embed = new EmbedBuilder()
      .setColor(0xdd6b20)
      .setTitle(title)
      .addFields({ name: 'المسؤول', value: `<@${interaction.user.id}>`, inline: true }, ...fields)
      .setTimestamp();
    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error('تعذر إرسال اللوق:', err.message);
  }
}
