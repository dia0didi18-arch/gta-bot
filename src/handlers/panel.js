import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
} from 'discord.js';
import { config, slotLabel } from '../config.js';
import { UserError } from '../errors.js';
import {
  createIdentity,
  getIdentityBySlot,
  listIdentities,
  getActive,
  requireActive,
  login,
  logout,
} from '../services/identity.js';
import { getBalances } from '../services/bank.js';
import { listItems, listVault } from '../services/inventory.js';
import { claimSalary } from '../services/economy.js';
import { identityEmbed, okEmbed, errEmbed, bagEmbed, vaultEmbed, bankEmbed, money } from '../utils/embeds.js';

const EPH = MessageFlags.Ephemeral;

/** أزرار اللوحة الرئيسية. */
export function panelComponents() {
  const btn = (id, label, emoji, style) =>
    new ButtonBuilder().setCustomId(`idp:btn:${id}`).setLabel(label).setEmoji(emoji).setStyle(style);
  return [
    new ActionRowBuilder().addComponents(
      btn('create', 'إنشاء هوية', '🪪', ButtonStyle.Success),
      btn('login', 'تسجيل دخول', '🟢', ButtonStyle.Primary),
      btn('logout', 'تسجيل خروج', '🔴', ButtonStyle.Danger),
      btn('show', 'عرض الهوية', '🧑', ButtonStyle.Secondary),
    ),
    new ActionRowBuilder().addComponents(
      btn('bag', 'الحقيبة', '🎒', ButtonStyle.Secondary),
      btn('bank', 'البنك', '🏦', ButtonStyle.Secondary),
      btn('vault', 'الخزنة', '🔐', ButtonStyle.Secondary),
      btn('salary', 'الراتب', '💵', ButtonStyle.Secondary),
    ),
  ];
}

/** قائمة اللوحات القديمة (قبل الأزرار) — تبقى شغالة. */
function legacyMenu() {
  return [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('idp:action')
        .setPlaceholder('اختر الإجراء')
        .addOptions(
          { label: 'إنشاء هوية', description: 'لإنشاء الشخصية', value: 'create', emoji: '🪪' },
          { label: 'تسجيل دخول', description: 'لتسجيل الدخول بهوية', value: 'login', emoji: '🟢' },
          { label: 'تسجيل خروج', description: 'لتسجيل الخروج من الهوية الحالية', value: 'logout', emoji: '🔴' },
          { label: 'عرض الهوية', description: 'لعرض هويتك الفعالة', value: 'show', emoji: '🧑' },
        ),
    ),
  ];
}

export async function handlePanel(interaction) {
  const id = interaction.customId;
  if (interaction.isButton() && id.startsWith('idp:btn:')) {
    return runAction(interaction, id.split(':')[2]);
  }
  if (interaction.isStringSelectMenu()) {
    if (id === 'idp:action') {
      try {
        return await runAction(interaction, interaction.values[0]);
      } finally {
        interaction.message?.edit({ components: legacyMenu() }).catch(() => {});
      }
    }
    if (id === 'idp:create') return onCreatePick(interaction);
    if (id === 'idp:login') return onLoginPick(interaction);
  } else if (interaction.isModalSubmit() && id.startsWith('idp:modal:')) {
    return onModal(interaction);
  }
}

async function runAction(interaction, choice) {
  const { guildId, user } = interaction;
  const reply = (payload) => interaction.reply({ ...payload, flags: EPH });

  if (choice === 'create') {
    const menu = new StringSelectMenuBuilder()
      .setCustomId('idp:create')
      .setPlaceholder('اختر الهوية التي تريد إنشاءها')
      .addOptions(
        config.identity.slots.map((s) => {
          const existing = getIdentityBySlot(guildId, user.id, s.slot);
          return {
            label: s.label,
            description: existing ? `موجودة: ${existing.first_name} ${existing.surname}` : 'متاحة للإنشاء',
            value: String(s.slot),
            emoji: existing ? '✅' : '🆕',
          };
        }),
      );
    return reply({ content: '**اختر الهوية التي تريد إنشاءها:**', components: [new ActionRowBuilder().addComponents(menu)] });
  }

  if (choice === 'login') {
    const list = listIdentities(guildId, user.id);
    if (!list.length) throw new UserError('ما عندك أي هوية، أنشئ هوية أولاً.');
    const active = getActive(guildId, user.id);
    const menu = new StringSelectMenuBuilder()
      .setCustomId('idp:login')
      .setPlaceholder('اختر الهوية للدخول بها')
      .addOptions(
        list.map((i) => ({
          label: `${i.first_name} ${i.surname}`,
          description: slotLabel(i.slot) + (active?.id === i.id ? ' (فعالة حالياً)' : ''),
          value: String(i.id),
          emoji: active?.id === i.id ? '🟢' : '🪪',
        })),
      );
    return reply({ content: '**اختر الهوية للدخول بها:**', components: [new ActionRowBuilder().addComponents(menu)] });
  }

  if (choice === 'logout') {
    const out = logout(guildId, user.id);
    return reply({ embeds: [okEmbed(`تم تسجيل الخروج من **${out.first_name} ${out.surname}**.`)] });
  }

  // بقية الإجراءات تحتاج هوية فعالة
  const me = requireActive(guildId, user.id);
  if (choice === 'show') {
    return reply({ embeds: [identityEmbed(me, getBalances(me.id), listItems(me.id), user)] });
  }
  if (choice === 'bag') return reply({ embeds: [bagEmbed(me, listItems(me.id))] });
  if (choice === 'vault') return reply({ embeds: [vaultEmbed(me, listVault(me.id))] });
  if (choice === 'bank') return reply({ embeds: [bankEmbed(me, getBalances(me.id))] });
  if (choice === 'salary') {
    const { job, amount } = claimSalary(me.id);
    return reply({
      embeds: [bankEmbed(me, getBalances(me.id), '💵 تم استلام الراتب', `راتب **${job.label}**: ${money(amount)} نزل في حسابك البنكي.`)],
    });
  }
}

async function onCreatePick(interaction) {
  const slot = Number(interaction.values[0]);
  const existing = getIdentityBySlot(interaction.guildId, interaction.user.id, slot);
  if (existing) {
    return interaction.update({
      content: `❌ عندك ${slotLabel(slot)} مسجلة مسبقاً باسم **${existing.first_name} ${existing.surname}**.`,
      components: [],
    });
  }

  const ph = config.placeholders;
  const field = (customId, label, placeholder, max) =>
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId(customId)
        .setLabel(label)
        .setPlaceholder(placeholder)
        .setStyle(TextInputStyle.Short)
        .setMinLength(2)
        .setMaxLength(max)
        .setRequired(true),
    );

  const modal = new ModalBuilder()
    .setCustomId(`idp:modal:${slot}`)
    .setTitle(`إنشاء ${slotLabel(slot)}`)
    .addComponents(
      field('first_name', 'الاسم الأول', ph.firstName, 20),
      field('surname', 'اسم العائلة', ph.surname, 20),
      field('gender', 'الجنس', ph.gender, 10),
      field('nationality', 'الجنسية', ph.nationality, 20),
    );
  await interaction.showModal(modal);
}

const NAME_RE = /^[\p{L} ]{2,20}$/u;

function parseGender(raw) {
  const g = raw.trim().toLowerCase();
  if (['ذكر', 'male', 'm'].includes(g)) return 'ذكر';
  if (['انثى', 'أنثى', 'female', 'f'].includes(g)) return 'أنثى';
  throw new UserError('الجنس لازم يكون: ذكر أو أنثى.');
}

async function onModal(interaction) {
  const slot = Number(interaction.customId.split(':')[2]);
  const read = (k) => interaction.fields.getTextInputValue(k).trim().replace(/\s+/g, ' ');

  const firstName = read('first_name');
  const surname = read('surname');
  const nationality = read('nationality');
  const gender = parseGender(read('gender'));
  for (const [label, v] of [['الاسم الأول', firstName], ['اسم العائلة', surname], ['الجنسية', nationality]]) {
    if (!NAME_RE.test(v)) throw new UserError(`${label} غير صالح (حروف فقط، من 2 إلى 20).`);
  }

  const identity = createIdentity({
    guildId: interaction.guildId,
    userId: interaction.user.id,
    slot,
    firstName,
    surname,
    gender,
    nationality,
  });
  const active = getActive(interaction.guildId, interaction.user.id);
  const note =
    active?.id === identity.id ? 'تم تسجيل دخولك بها تلقائياً.' : 'للدخول بها اضغط «تسجيل دخول» من اللوحة.';

  await interaction.reply({
    content: `✅ تم إنشاء **${slotLabel(slot)}** — ${note}`,
    embeds: [identityEmbed(identity, getBalances(identity.id), [], interaction.user)],
    flags: EPH,
  });
}

async function onLoginPick(interaction) {
  const identity = login(interaction.guildId, interaction.user.id, Number(interaction.values[0]));
  await interaction.update({
    content: '',
    embeds: [okEmbed(`تم تسجيل الدخول بـ **${identity.first_name} ${identity.surname}** (${slotLabel(identity.slot)}).`)],
    components: [],
  });
}

/** يرد على المستخدم برسالة خطأ بغض النظر عن حالة التفاعل. */
export async function replyError(interaction, err) {
  const isUser = err instanceof UserError;
  if (!isUser) console.error(err);
  const text = isUser ? err.message : 'صار خطأ غير متوقع، حاول مرة ثانية.';
  const payload = { embeds: [errEmbed(text)], flags: EPH };
  try {
    if (interaction.replied || interaction.deferred) await interaction.followUp(payload);
    else await interaction.reply(payload);
  } catch {
    /* التفاعل انتهى */
  }
}
