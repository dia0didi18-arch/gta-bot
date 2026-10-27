import { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, EmbedBuilder, MessageFlags } from 'discord.js';
import { panelComponents } from '../../handlers/panel.js';

export const data = new SlashCommandBuilder()
  .setName('لوحة-الهوية')
  .setDescription('إرسال لوحة إدارة الشخصيات في هذا الروم')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .setContexts(InteractionContextType.Guild);

export async function execute(interaction) {
  const embed = new EmbedBuilder()
    .setColor(0x2b6cb0)
    .setTitle('⚙️ إدارة الشخصيات')
    .setDescription(
      [
        'من خلال الأزرار تقدر تتحكم بشخصيتك: إنشاء هوية، تسجيل دخول وخروج، وعرض هويتك.',
        'وتقدر تشوف حقيبتك وبنكك وخزنتك، وتستلم راتبك بضغطة زر.',
        '',
        '🪪 تقدر تنشئ **هويتين** (الأولى والثانية).',
        '🎒🏦🔐 كل هوية لها **حقيبة وحساب بنكي وخزنة** مستقلين، وما يتداخلون مع بعض.',
      ].join('\n'),
    );
  await interaction.channel.send({ embeds: [embed], components: panelComponents() });
  await interaction.reply({ content: '✅ تم إرسال اللوحة.', flags: MessageFlags.Ephemeral });
}
