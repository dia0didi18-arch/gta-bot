// ============================================================
// بوت FiveM Roleplay - discord.js v14
//
// التثبيت والتشغيل:
//   1) npm install
//   2) انسخ .env.example إلى .env وضع DISCORD_TOKEN (و GUILD_ID اختيارياً)
//   3) npm start
//   4) في ديسكورد (بصلاحية Manage Server) نفّذ:  /panel type:الكل
// ============================================================
require('dotenv').config();
const {
  Client, GatewayIntentBits, Events, MessageFlags, PermissionFlagsBits,
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, UserSelectMenuBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle, SlashCommandBuilder,
} = require('discord.js');
const cfg = require('./config');
const db = require('./database');
const { UserError } = db;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// ============================================================
// أدوات مساعدة
// ============================================================
const fmt = (n) => `${Number(n).toLocaleString('en-US')} ${cfg.CURRENCY}`;
const eph = (payload) => ({ ...payload, flags: MessageFlags.Ephemeral });
const row = (...components) => new ActionRowBuilder().addComponents(...components);

const embed = (title, desc, color = cfg.COLORS.primary) =>
  new EmbedBuilder().setTitle(title).setDescription(desc).setColor(color).setTimestamp();
const okEmbed = (title, desc) => embed(`✅ ${title}`, desc, cfg.COLORS.success);
const errEmbed = (desc) => embed('❌ تعذّر تنفيذ العملية', desc, cfg.COLORS.danger);

const btn = (id, label, emoji, style = ButtonStyle.Secondary) =>
  new ButtonBuilder().setCustomId(id).setLabel(label).setEmoji(emoji).setStyle(style);

const itemInfo = (key) => cfg.ITEMS[key] ?? { name: key, emoji: '📦', usable: false };
const itemLabel = (key) => `${itemInfo(key).emoji} ${itemInfo(key).name}`;

/** يرجع الشخصية النشطة أو يرمي خطأ عربياً */
function requireActive(i) {
  const c = db.getActive(i.user.id);
  if (!c) throw new UserError('يجب تسجيل الدخول بشخصية أولاً من لوحة الشخصيات.');
  return c;
}

/** يحوّل النص (يدعم الأرقام العربية ٠-٩) إلى عدد صحيح موجب */
function parsePositiveInt(str, max = Infinity) {
  const s = String(str).trim().replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
  if (!/^\d+$/.test(s)) throw new UserError('الرجاء إدخال رقم صحيح موجب.');
  const n = Number(s);
  if (n <= 0) throw new UserError('القيمة يجب أن تكون أكبر من صفر.');
  if (n > max) throw new UserError(`القيمة تتجاوز الحد الأقصى المسموح (${max.toLocaleString('en-US')}).`);
  return n;
}

/** التحقق من اللاعب المستهدف وإرجاع شخصيته النشطة */
function resolveTarget(i, targetUser) {
  if (!targetUser || targetUser.bot) throw new UserError('لا يمكنك اختيار هذا المستخدم.');
  if (targetUser.id === i.user.id) throw new UserError('لا يمكنك اختيار نفسك.');
  const c = db.getActive(targetUser.id);
  if (!c) throw new UserError('اللاعب المحدد لم يسجّل الدخول بأي شخصية حالياً.');
  return c;
}

const fullName = (c) => `${c.first_name} ${c.last_name}`;

async function notify(i, userId, e) {
  try {
    await i.channel.send({ content: `<@${userId}>`, embeds: [e], allowedMentions: { users: [userId] } });
  } catch { /* تجاهل إذا لم تتوفر صلاحية الإرسال */ }
}

// -------- مكوّنات واجهة قابلة لإعادة الاستخدام
const textInput = (id, label, { placeholder, min = 1, max = 20, style = TextInputStyle.Short } = {}) => {
  const t = new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(style)
    .setMinLength(min).setMaxLength(max).setRequired(true);
  if (placeholder) t.setPlaceholder(placeholder);
  return row(t);
};

const amountModal = (customId, title, label = 'المبلغ') =>
  new ModalBuilder().setCustomId(customId).setTitle(title)
    .addComponents(textInput('amount', label, { placeholder: 'مثال: 500', max: 12 }));

const qtyModal = (customId, title) =>
  new ModalBuilder().setCustomId(customId).setTitle(title)
    .addComponents(textInput('qty', 'الكمية', { placeholder: 'مثال: 1', max: 4 }));

const itemSelect = (customId, placeholder, rows) =>
  row(new StringSelectMenuBuilder().setCustomId(customId).setPlaceholder(placeholder).addOptions(
    rows.slice(0, 25).map((r) => ({
      label: itemInfo(r.item_key).name, value: r.item_key,
      description: `الكمية: ${r.quantity}`, emoji: itemInfo(r.item_key).emoji,
    }))
  ));

const userSelect = (customId, placeholder) =>
  row(new UserSelectMenuBuilder().setCustomId(customId).setPlaceholder(placeholder).setMinValues(1).setMaxValues(1));

// -------- الأزرار
const charButtons = () => row(
  btn('char:create', 'إنشاء شخصية', '➕', ButtonStyle.Success),
  btn('char:login', 'تسجيل الدخول', '🔓', ButtonStyle.Primary),
  btn('char:logout', 'تسجيل الخروج', '🔒', ButtonStyle.Danger),
  btn('char:identity', 'عرض الهوية', '🪪'),
);
const invButtons = () => row(
  btn('inv:show', 'كشف الحقيبة', '🎒', ButtonStyle.Primary),
  btn('inv:give', 'إعطاء عنصر', '🤝'),
  btn('inv:use', 'استخدام غرض', '✨'),
  btn('inv:vault', 'الخزنة', '🔐'),
  btn('inv:rules', 'قوانين الحقيبة', '📜'),
);
const vaultButtons = () => row(
  btn('vault:deposit', 'إيداع في الخزنة', '📥', ButtonStyle.Success),
  btn('vault:withdraw', 'سحب من الخزنة', '📤', ButtonStyle.Primary),
);
const bankButtons = () => row(
  btn('bank:balance', 'عرض الرصيد', '💰', ButtonStyle.Primary),
  btn('bank:transfer', 'تحويل مبلغ', '💸'),
  btn('bank:deposit', 'إيداع مبلغ', '📥', ButtonStyle.Success),
  btn('bank:withdraw', 'سحب مبلغ', '📤'),
  btn('bank:rules', 'قوانين البنك', '📜'),
);

// -------- اللوحات الرئيسية (تُنشر بأمر /panel)
const charPanel = () => ({
  embeds: [embed('👥 نظام إدارة الشخصيات',
    `يمكنك امتلاك حتى **${cfg.MAX_CHARACTERS}** شخصيات، ولكل شخصية هوية وحقيبة وحساب بنكي مستقلة.\n\nاستخدم الأزرار بالأسفل للتحكم بشخصياتك.`)],
  components: [charButtons()],
});
const invPanel = () => ({
  embeds: [embed('🎒 نظام الحقيبة والمخزون',
    'تحكم في حقيبة شخصيتك النشطة: اكشف محتوياتها، أعطِ الأغراض للاعبين، استخدمها أو خزّنها.')],
  components: [invButtons()],
});
const bankPanel = () => ({
  embeds: [embed('🏦 نظام البنك والأموال',
    'أدر أموال شخصيتك النشطة: اعرض رصيدك، حوّل الأموال، أودع واسحب بسهولة.', cfg.COLORS.gold)],
  components: [bankButtons()],
});

// -------- Embeds العرض
const identityEmbed = (c, user) =>
  new EmbedBuilder().setTitle('🪪 بطاقة الهوية').setColor(cfg.COLORS.primary)
    .setThumbnail(user.displayAvatarURL())
    .addFields(
      { name: '👤 الاسم الكامل', value: fullName(c), inline: true },
      { name: '🎂 العمر', value: String(c.age), inline: true },
      { name: '⚧ الجنس', value: c.gender, inline: true },
      { name: '🌍 الجنسية', value: c.nationality, inline: true },
      { name: '🔢 رقم الهوية', value: `#${String(c.id).padStart(5, '0')}`, inline: true },
      { name: '📅 تاريخ الإصدار', value: `<t:${c.created_at}:D>`, inline: true },
    )
    .setFooter({ text: `صاحب الحساب: ${user.username}` });

function storageEmbed(title, table, c) {
  const items = db.getItems(table, c.id);
  const lines = items.length
    ? items.map((r) => `${itemLabel(r.item_key)} × **${r.quantity}**`).join('\n')
    : '*فارغة*';
  return embed(title, lines)
    .addFields({ name: '📦 السعة', value: `${db.totalQty(table, c.id)} / ${db.capacity(table)}`, inline: true })
    .setFooter({ text: `الشخصية: ${fullName(c)}` });
}

const bankEmbed = (c) => {
  const b = db.getBank(c.id);
  return embed('💰 كشف الحساب', `الشخصية: **${fullName(c)}**`, cfg.COLORS.gold).addFields(
    { name: '💵 الكاش', value: fmt(b.cash), inline: true },
    { name: '🏦 الرصيد البنكي', value: fmt(b.balance), inline: true },
    { name: '📊 المجموع', value: fmt(b.cash + b.balance), inline: true },
  );
};

// ============================================================
// معالجات الأزرار  (customId = "base|arg1|arg2")
// ============================================================
const buttons = {
  // ---------- الشخصيات ----------
  'char:create': async (i) => {
    if (db.getCharacters(i.user.id).length >= cfg.MAX_CHARACTERS)
      throw new UserError(`وصلت للحد الأقصى من الشخصيات (${cfg.MAX_CHARACTERS}).`);
    await i.showModal(
      new ModalBuilder().setCustomId('char:create').setTitle('إنشاء شخصية جديدة').addComponents(
        textInput('first', 'الاسم الأول', { min: 2, max: 20 }),
        textInput('last', 'اسم العائلة', { min: 2, max: 20 }),
        textInput('age', 'العمر (18 - 80)', { max: 2 }),
        textInput('gender', 'الجنس (ذكر / أنثى)', { max: 4 }),
        textInput('nation', 'الجنسية', { min: 2, max: 20 }),
      )
    );
  },

  'char:login': async (i) => {
    const chars = db.getCharacters(i.user.id);
    if (!chars.length) throw new UserError('ليس لديك أي شخصية بعد. أنشئ شخصية أولاً.');
    const active = db.getActive(i.user.id);
    await i.reply(eph({
      embeds: [embed('🔓 تسجيل الدخول', 'اختر الشخصية التي تريد اللعب بها:')],
      components: [row(new StringSelectMenuBuilder().setCustomId('char:login').setPlaceholder('اختر شخصية').addOptions(
        chars.map((c) => ({
          label: fullName(c), value: String(c.id), description: `هوية #${String(c.id).padStart(5, '0')} - العمر ${c.age}`,
          default: active?.id === c.id,
        }))
      ))],
    }));
  },

  'char:logout': async (i) => {
    const c = requireActive(i);
    db.logout(i.user.id);
    await i.reply(eph({ embeds: [okEmbed('تسجيل الخروج', `تم تسجيل الخروج من الشخصية **${fullName(c)}**.`)] }));
  },

  'char:identity': async (i) => {
    const c = requireActive(i);
    await i.reply(eph({ embeds: [identityEmbed(c, i.user)] }));
  },

  // ---------- الحقيبة ----------
  'inv:show': async (i) => {
    const c = requireActive(i);
    await i.reply(eph({ embeds: [storageEmbed('🎒 حقيبتك', 'inventory', c)], components: [invButtons()] }));
  },

  'inv:give': async (i) => {
    const c = requireActive(i);
    const items = db.getItems('inventory', c.id);
    if (!items.length) throw new UserError('حقيبتك فارغة.');
    await i.reply(eph({
      embeds: [embed('🤝 إعطاء عنصر', 'اختر الغرض الذي تريد إعطاءه:')],
      components: [itemSelect('inv:give:item', 'اختر غرضاً', items)],
    }));
  },

  'inv:use': async (i) => {
    const c = requireActive(i);
    const items = db.getItems('inventory', c.id).filter((r) => itemInfo(r.item_key).usable);
    if (!items.length) throw new UserError('لا تملك أي غرض قابل للاستخدام.');
    await i.reply(eph({
      embeds: [embed('✨ استخدام غرض', 'اختر الغرض الذي تريد استخدامه (يُستهلك غرض واحد):')],
      components: [itemSelect('inv:use:item', 'اختر غرضاً', items)],
    }));
  },

  'inv:vault': async (i) => {
    const c = requireActive(i);
    await i.reply(eph({ embeds: [storageEmbed('🔐 الخزنة', 'vault', c)], components: [vaultButtons()] }));
  },

  'inv:rules': async (i) => {
    await i.reply(eph({ embeds: [embed('📜 قوانين الحقيبة', cfg.INVENTORY_RULES.join('\n\n'))] }));
  },

  'vault:deposit': async (i) => {
    const c = requireActive(i);
    const items = db.getItems('inventory', c.id);
    if (!items.length) throw new UserError('حقيبتك فارغة.');
    await i.reply(eph({
      embeds: [embed('📥 إيداع في الخزنة', 'اختر الغرض من حقيبتك:')],
      components: [itemSelect('vault:deposit:item', 'اختر غرضاً', items)],
    }));
  },

  'vault:withdraw': async (i) => {
    const c = requireActive(i);
    const items = db.getItems('vault', c.id);
    if (!items.length) throw new UserError('الخزنة فارغة.');
    await i.reply(eph({
      embeds: [embed('📤 سحب من الخزنة', 'اختر الغرض من الخزنة:')],
      components: [itemSelect('vault:withdraw:item', 'اختر غرضاً', items)],
    }));
  },

  // ---------- البنك ----------
  'bank:balance': async (i) => {
    const c = requireActive(i);
    await i.reply(eph({ embeds: [bankEmbed(c)] }));
  },

  'bank:transfer': async (i) => {
    requireActive(i);
    await i.reply(eph({
      embeds: [embed('💸 تحويل مبلغ', 'اختر اللاعب الذي تريد التحويل إليه (يجب أن يكون مسجّلاً الدخول بشخصية):')],
      components: [userSelect('bank:transfer:user', 'اختر اللاعب')],
    }));
  },

  'bank:deposit': async (i) => {
    requireActive(i);
    await i.showModal(amountModal('bank:deposit', 'إيداع مبلغ'));
  },

  'bank:withdraw': async (i) => {
    requireActive(i);
    await i.showModal(amountModal('bank:withdraw', 'سحب مبلغ'));
  },

  'bank:rules': async (i) => {
    await i.reply(eph({ embeds: [embed('📜 قوانين البنك', cfg.BANK_RULES.join('\n\n'), cfg.COLORS.gold)] }));
  },
};

// ============================================================
// معالجات القوائم المنسدلة
// ============================================================
const selects = {
  'char:login': async (i) => {
    const c = db.setActive(i.user.id, Number(i.values[0]));
    await i.update({
      embeds: [okEmbed('تم تسجيل الدخول', `أنت الآن تلعب بالشخصية **${fullName(c)}**.`)],
      components: [],
    });
  },

  'inv:give:item': async (i) => {
    const key = i.values[0];
    await i.update({
      embeds: [embed('🤝 إعطاء عنصر', `الغرض: ${itemLabel(key)}\nاختر اللاعب المستلم:`)],
      components: [userSelect(`inv:give:user|${key}`, 'اختر اللاعب')],
    });
  },

  'inv:use:item': async (i) => {
    const c = requireActive(i);
    const key = i.values[0];
    if (!itemInfo(key).usable) throw new UserError('هذا الغرض غير قابل للاستخدام.');
    db.removeItem('inventory', c.id, key, 1);
    await i.update({
      embeds: [okEmbed('تم استخدام الغرض', `${itemLabel(key)}\n\n${itemInfo(key).useText ?? 'تم استخدام الغرض.'}`)],
      components: [],
    });
  },

  'vault:deposit:item': async (i) => {
    await i.showModal(qtyModal(`vault:deposit:qty|${i.values[0]}`, 'إيداع في الخزنة'));
  },

  'vault:withdraw:item': async (i) => {
    await i.showModal(qtyModal(`vault:withdraw:qty|${i.values[0]}`, 'سحب من الخزنة'));
  },
};

const userSelects = {
  'inv:give:user': async (i, key) => {
    requireActive(i);
    const target = i.users.first();
    resolveTarget(i, target);
    await i.showModal(qtyModal(`inv:give:qty|${key}|${target.id}`, 'كمية الإعطاء'));
  },

  'bank:transfer:user': async (i) => {
    requireActive(i);
    const target = i.users.first();
    resolveTarget(i, target);
    await i.showModal(amountModal(`bank:transfer:amount|${target.id}`, 'مبلغ التحويل'));
  },
};

// ============================================================
// معالجات النوافذ (Modals)
// ============================================================
const modals = {
  'char:create': async (i) => {
    const first = i.fields.getTextInputValue('first').trim();
    const last = i.fields.getTextInputValue('last').trim();
    const nation = i.fields.getTextInputValue('nation').trim();
    const gender = i.fields.getTextInputValue('gender').trim();
    const nameRe = /^[\p{L}\s'-]{2,20}$/u;
    if (!nameRe.test(first) || !nameRe.test(last)) throw new UserError('الاسم يجب أن يحتوي على حروف فقط (من 2 إلى 20 حرفاً).');
    if (!nameRe.test(nation)) throw new UserError('الجنسية يجب أن تحتوي على حروف فقط.');
    const age = parsePositiveInt(i.fields.getTextInputValue('age'));
    if (age < 18 || age > 80) throw new UserError('العمر يجب أن يكون بين 18 و 80 سنة.');
    if (!['ذكر', 'أنثى'].includes(gender)) throw new UserError('الجنس يجب أن يكون "ذكر" أو "أنثى".');

    const c = db.createCharacter(i.user.id, { firstName: first, lastName: last, age, gender, nationality: nation });
    await i.reply(eph({
      content: '✅ **تم إنشاء شخصيتك وتسجيل الدخول بها تلقائياً.**',
      embeds: [identityEmbed(c, i.user)],
    }));
  },

  'inv:give:qty': async (i, key, targetId) => {
    const from = requireActive(i);
    const target = await client.users.fetch(targetId);
    const to = resolveTarget(i, target);
    if (!cfg.ITEMS[key]) throw new UserError('غرض غير معروف.');
    const qty = parsePositiveInt(i.fields.getTextInputValue('qty'), 999);
    db.giveItem(from.id, to.id, key, qty);

    await i.reply(eph({ embeds: [okEmbed('تم إعطاء الغرض', `أعطيت **${qty}×** ${itemLabel(key)} إلى **${fullName(to)}**.`)] }));
    await notify(i, target.id, embed('🎁 استلمت غرضاً',
      `استلمت **${qty}×** ${itemLabel(key)} من **${fullName(from)}**.`, cfg.COLORS.success));
  },

  'vault:deposit:qty': async (i, key) => {
    const c = requireActive(i);
    const qty = parsePositiveInt(i.fields.getTextInputValue('qty'), 999);
    db.moveItem('inventory', 'vault', c.id, key, qty);
    await i.reply(eph({
      embeds: [okEmbed('تم الإيداع', `تم إيداع **${qty}×** ${itemLabel(key)} في الخزنة.`), storageEmbed('🔐 الخزنة', 'vault', c)],
      components: [vaultButtons()],
    }));
  },

  'vault:withdraw:qty': async (i, key) => {
    const c = requireActive(i);
    const qty = parsePositiveInt(i.fields.getTextInputValue('qty'), 999);
    db.moveItem('vault', 'inventory', c.id, key, qty);
    await i.reply(eph({
      embeds: [okEmbed('تم السحب', `تم سحب **${qty}×** ${itemLabel(key)} إلى الحقيبة.`), storageEmbed('🔐 الخزنة', 'vault', c)],
      components: [vaultButtons()],
    }));
  },

  'bank:deposit': async (i) => {
    const c = requireActive(i);
    const amt = parsePositiveInt(i.fields.getTextInputValue('amount'), cfg.MAX_TRANSFER);
    db.deposit(c.id, amt);
    await i.reply(eph({ embeds: [okEmbed('تم الإيداع', `تم إيداع **${fmt(amt)}** في حسابك البنكي.`), bankEmbed(c)] }));
  },

  'bank:withdraw': async (i) => {
    const c = requireActive(i);
    const amt = parsePositiveInt(i.fields.getTextInputValue('amount'), cfg.MAX_TRANSFER);
    db.withdraw(c.id, amt);
    await i.reply(eph({ embeds: [okEmbed('تم السحب', `تم سحب **${fmt(amt)}** من حسابك البنكي.`), bankEmbed(c)] }));
  },

  'bank:transfer:amount': async (i, targetId) => {
    const from = requireActive(i);
    const target = await client.users.fetch(targetId);
    const to = resolveTarget(i, target);
    const amt = parsePositiveInt(i.fields.getTextInputValue('amount'), cfg.MAX_TRANSFER);
    db.transfer(from.id, to.id, amt);

    await i.reply(eph({ embeds: [okEmbed('تم التحويل', `تم تحويل **${fmt(amt)}** إلى **${fullName(to)}**.`), bankEmbed(from)] }));
    await notify(i, target.id, embed('💸 حوالة واردة',
      `استلمت حوالة بقيمة **${fmt(amt)}** من **${fullName(from)}**.`, cfg.COLORS.gold));
  },
};

// ============================================================
// أوامر السلاش
// ============================================================
const itemChoices = Object.entries(cfg.ITEMS).map(([value, it]) => ({ name: it.name, value }));

const commands = [
  new SlashCommandBuilder().setName('panel').setDescription('نشر لوحة التحكم في هذه القناة')
    .addStringOption((o) => o.setName('type').setDescription('نوع اللوحة').setRequired(true).addChoices(
      { name: 'الشخصيات', value: 'characters' }, { name: 'الحقيبة', value: 'inventory' },
      { name: 'البنك', value: 'bank' }, { name: 'الكل', value: 'all' }))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder().setName('admin-item').setDescription('إعطاء غرض للشخصية النشطة للاعب (للإدارة)')
    .addUserOption((o) => o.setName('user').setDescription('اللاعب').setRequired(true))
    .addStringOption((o) => o.setName('item').setDescription('الغرض').setRequired(true).addChoices(...itemChoices))
    .addIntegerOption((o) => o.setName('quantity').setDescription('الكمية').setMinValue(1).setMaxValue(100).setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder().setName('admin-money').setDescription('إضافة أو خصم كاش من الشخصية النشطة للاعب (للإدارة)')
    .addUserOption((o) => o.setName('user').setDescription('اللاعب').setRequired(true))
    .addIntegerOption((o) => o.setName('amount').setDescription('المبلغ (سالب للخصم)').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
].map((c) => c.toJSON());

async function handleCommand(i) {
  if (i.commandName === 'panel') {
    const panels = { characters: charPanel, inventory: invPanel, bank: bankPanel };
    const type = i.options.getString('type');
    const list = type === 'all' ? Object.values(panels) : [panels[type]];
    for (const p of list) await i.channel.send(p());
    return i.reply(eph({ embeds: [okEmbed('تم', 'تم نشر اللوحة بنجاح.')] }));
  }

  const user = i.options.getUser('user');
  const c = db.getActive(user.id);
  if (!c) throw new UserError('هذا اللاعب غير مسجّل الدخول بأي شخصية.');

  if (i.commandName === 'admin-item') {
    const key = i.options.getString('item');
    const qty = i.options.getInteger('quantity');
    db.addItem('inventory', c.id, key, qty);
    return i.reply(eph({ embeds: [okEmbed('تمت الإضافة', `أُضيف **${qty}×** ${itemLabel(key)} إلى حقيبة **${fullName(c)}**.`)] }));
  }

  if (i.commandName === 'admin-money') {
    const amt = i.options.getInteger('amount');
    if (amt === 0) throw new UserError('المبلغ يجب ألا يكون صفراً.');
    db.addCash(c.id, amt);
    return i.reply(eph({ embeds: [okEmbed('تم التعديل', `تم تعديل كاش **${fullName(c)}** بمقدار **${fmt(amt)}**.`)] }));
  }
}

// ============================================================
// موجّه التفاعلات + معالجة الأخطاء
// ============================================================
async function safeReply(i, payload) {
  try {
    if (i.deferred || i.replied) await i.followUp(eph(payload));
    else await i.reply(eph(payload));
  } catch (e) { console.error('Reply failed:', e); }
}

client.on(Events.InteractionCreate, async (i) => {
  try {
    if (i.isChatInputCommand()) return await handleCommand(i);

    const table = i.isButton() ? buttons
      : i.isStringSelectMenu() ? selects
      : i.isUserSelectMenu() ? userSelects
      : i.isModalSubmit() ? modals : null;
    if (!table) return;

    const [base, ...args] = i.customId.split('|');
    const handler = table[base];
    if (handler) await handler(i, ...args);
  } catch (err) {
    if (err instanceof UserError) return safeReply(i, { embeds: [errEmbed(err.message)] });
    console.error(err);
    return safeReply(i, { embeds: [errEmbed('حدث خطأ غير متوقع. حاول مرة أخرى لاحقاً.')] });
  }
});

client.once(Events.ClientReady, async (c) => {
  console.log(`✅ Logged in as ${c.user.tag}`);
  try {
    if (process.env.GUILD_ID) {
      const guild = await c.guilds.fetch(process.env.GUILD_ID);
      await guild.commands.set(commands);
    } else {
      await c.application.commands.set(commands);
    }
    console.log('✅ Slash commands registered');
  } catch (e) { console.error('Failed to register commands:', e); }
});

if (!process.env.DISCORD_TOKEN) {
  console.error('DISCORD_TOKEN is missing. Create a .env file (see .env.example).');
  process.exit(1);
}
client.login(process.env.DISCORD_TOKEN);
