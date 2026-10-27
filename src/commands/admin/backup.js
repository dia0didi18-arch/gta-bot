import fs from 'node:fs';
import { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, AttachmentBuilder, MessageFlags } from 'discord.js';
import { config } from '../../config.js';
import { UserError } from '../../errors.js';
import { runBackup } from '../../backup.js';

export const cooldown = 30_000;

export const data = new SlashCommandBuilder()
  .setName('نسخ-احتياطي')
  .setDescription('نسخة احتياطية من قاعدة البيانات (لصاحب البوت فقط)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .setContexts(InteractionContextType.Guild);

export async function execute(interaction) {
  // القاعدة فيها بيانات كل السيرفرات، فالأمر مقصور على OWNER_ID
  if (!config.ownerId) throw new UserError('حدد OWNER_ID (ايدي حسابك) في إعدادات البوت عشان تستخدم هذا الأمر.');
  if (interaction.user.id !== config.ownerId) throw new UserError('هذا الأمر لصاحب البوت فقط.');

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const file = await runBackup();
  const size = fs.statSync(file).size;
  if (size > 8 * 1024 * 1024) {
    return interaction.editReply(`✅ تم حفظ النسخة على السيرفر: \`${file}\` (حجمها ${(size / 1048576).toFixed(1)}MB أكبر من حد الإرسال).`);
  }
  await interaction.editReply({
    content: '✅ تم أخذ نسخة احتياطية. احتفظ فيها بمكان آمن — فيها بيانات اللاعبين.',
    files: [new AttachmentBuilder(file, { name: 'bot-backup.db' })],
  });
}
