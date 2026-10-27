import { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, MessageFlags } from 'discord.js';
import { addTargetOptions, resolveTargetIdentity } from '../../utils/target.js';
import { deleteIdentity } from '../../services/identity.js';
import { setJob } from '../../services/economy.js';
import { getBalances } from '../../services/bank.js';
import { listItems } from '../../services/inventory.js';
import { identityEmbed } from '../../utils/embeds.js';
import { sendLog } from '../../utils/mod.js';
import { jobChoices, jobLabel } from '../../config.js';

export const data = new SlashCommandBuilder()
  .setName('ادارة-هوية')
  .setDescription('إدارة هويات اللاعبين')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .setContexts(InteractionContextType.Guild)
  .addSubcommand((s) => addTargetOptions(s.setName('عرض').setDescription('عرض هوية لاعب')))
  .addSubcommand((s) =>
    addTargetOptions(s.setName('وظيفة').setDescription('تعيين وظيفة لهوية لاعب (تحدد الراتب)')).addStringOption((o) =>
      o.setName('المهنة').setDescription('الوظيفة').setRequired(true).addChoices(...jobChoices()),
    ),
  )
  .addSubcommand((s) => addTargetOptions(s.setName('حذف').setDescription('حذف هوية لاعب (مع حقيبتها وخزنتها وحسابها البنكي)')));

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  const { user, identity } = resolveTargetIdentity(interaction);

  if (sub === 'عرض') {
    const embed = identityEmbed(identity, getBalances(identity.id), listItems(identity.id), user);
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  if (sub === 'وظيفة') {
    const key = interaction.options.getString('المهنة', true);
    setJob(identity.id, key);
    await interaction.reply(`💼 تم تعيين **${identity.first_name} ${identity.surname}** (<@${user.id}>) بوظيفة **${jobLabel(key)}**.`);
    return sendLog(interaction, '💼 تعيين وظيفة', [
      { name: 'اللاعب', value: `<@${user.id}> / ${identity.first_name} ${identity.surname}` },
      { name: 'الوظيفة', value: jobLabel(key), inline: true },
    ]);
  }

  deleteIdentity(identity.id);
  await interaction.reply({
    content: `🗑️ تم حذف هوية **${identity.first_name} ${identity.surname}** الخاصة بـ <@${user.id}> مع حقيبتها وحسابها البنكي.`,
  });
  await sendLog(interaction, '🗑️ حذف هوية', [
    { name: 'اللاعب', value: `<@${user.id}>`, inline: true },
    { name: 'الهوية', value: `${identity.first_name} ${identity.surname}`, inline: true },
  ]);
}
