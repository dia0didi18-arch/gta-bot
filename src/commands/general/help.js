import { SlashCommandBuilder, InteractionContextType, EmbedBuilder, MessageFlags } from 'discord.js';

const CATEGORIES = {
  identity: '🪪 الهوية والحساب',
  economy: '💼 الاقتصاد',
  general: 'ℹ️ عام',
};

export const data = new SlashCommandBuilder()
  .setName('مساعدة')
  .setDescription('قائمة أوامر البوت')
  .setContexts(InteractionContextType.Guild);

export async function execute(interaction) {
  const all = [...interaction.client.commands.values()].map((c) => ({ cmd: c, json: c.data.toJSON() }));
  const embed = new EmbedBuilder().setColor(0x2b6cb0).setTitle('📖 أوامر البوت');

  for (const [cat, title] of Object.entries(CATEGORIES)) {
    const lines = all
      .filter(({ cmd, json }) => cmd.category === cat && !json.default_member_permissions)
      .map(({ json }) => {
        const subs = (json.options ?? []).filter((o) => o.type === 1).map((o) => o.name);
        return `**/${json.name}** — ${json.description}${subs.length ? `\n  ↳ ${subs.join(' · ')}` : ''}`;
      });
    if (lines.length) embed.addFields({ name: title, value: lines.join('\n').slice(0, 1024) });
  }

  const isAdmin = interaction.memberPermissions?.has('Administrator') || interaction.memberPermissions?.has('ModerateMembers');
  if (isAdmin) {
    const names = all.filter(({ json }) => json.default_member_permissions).map(({ json }) => `/${json.name}`);
    embed.addFields({ name: '🛠️ أوامر الإدارة (تظهر لك فقط)', value: names.join(' · ').slice(0, 1024) });
  }
  embed.setFooter({ text: 'ابدأ من لوحة الهوية: إنشاء هوية ثم تسجيل دخول' });
  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}
