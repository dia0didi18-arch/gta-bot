process.env.DB_PATH = ':memory:';

import test from 'node:test';
import assert from 'node:assert/strict';
import { fakeInteraction } from '../test-support/fake.js';

const { loadCommands } = await import('../src/loader.js');
const ids = await import('../src/services/identity.js');
const items = await import('../src/services/items.js');
const inv = await import('../src/services/inventory.js');
const bank = await import('../src/services/bank.js');
const { handlePanel } = await import('../src/handlers/panel.js');
const { handleInteraction } = await import('../src/events/interactionCreate.js');

const commands = await loadCommands();

test('كل الأوامر تتحمل وتتحول لـ JSON صالح لديسكورد', () => {
  assert.ok(commands.size >= 25, `عدد الأوامر ${commands.size}`);
  for (const [name, mod] of commands) {
    const json = mod.data.toJSON();
    assert.equal(json.name, name);
    assert.ok(json.description.length > 0);
    assert.equal(typeof mod.execute, 'function');
    assert.ok(mod.category, `بدون تصنيف: ${name}`);
  }
});

const G = 'gc';
const run = async (name, opts) => {
  const { interaction, out } = fakeInteraction({ guildId: G, ...opts });
  await commands.get(name).execute(interaction);
  return out.replies;
};

test('تشغيل الأوامر الأساسية بتفاعل مزيف', async () => {
  const me = ids.createIdentity({ guildId: G, userId: 'u1', slot: 1, firstName: 'ريم', surname: 'العتيق', gender: 'أنثى', nationality: 'عربية' });
  items.defineItem(G, 'خبز', { emoji: '🍞', price: 20, effect_type: 'cash', effect_value: 5, effect_message: 'لذيذ' });

  let r = await run('متجر', { sub: 'عرض', userId: 'u1' });
  assert.match(JSON.stringify(r[0].embeds[0].toJSON()), /خبز/);

  r = await run('متجر', { sub: 'شراء', userId: 'u1', strings: { غرض: 'خبز' }, ints: { كمية: 2 } });
  assert.match(JSON.stringify(r[0].embeds[0].toJSON()), /اشتريت/);

  r = await run('حقيبة', { sub: 'عرض', userId: 'u1' });
  assert.match(JSON.stringify(r[0].embeds[0].toJSON()), /خبز/);

  r = await run('حقيبة', { sub: 'استخدام', userId: 'u1', strings: { غرض: 'خبز' } });
  assert.match(JSON.stringify(r[0].embeds[0].toJSON()), /لذيذ/);

  r = await run('خزنة', { sub: 'ايداع', userId: 'u1', strings: { غرض: 'خبز' }, ints: { كمية: 1 } });
  assert.match(r[0].content, /الخزنة/);
  r = await run('خزنة', { sub: 'عرض', userId: 'u1' });
  assert.match(JSON.stringify(r[0].embeds[0].toJSON()), /خبز/);

  r = await run('بنك', { sub: 'رصيد', userId: 'u1' });
  assert.ok(r[0].embeds[0]);
  r = await run('بنك', { sub: 'ايداع', userId: 'u1', ints: { مبلغ: 100 } });
  assert.match(JSON.stringify(r[0].embeds[0].toJSON()), /تم الإيداع/);
  r = await run('بنك', { sub: 'كشف', userId: 'u1' });
  assert.match(JSON.stringify(r[0].embeds[0].toJSON()), /إيداع/);
  await assert.rejects(run('بنك', { sub: 'تحويل', userId: 'u1', strings: { رقم_الحساب: 'xx' }, ints: { مبلغ: 5 } }), /صيغة رقم الحساب/);

  r = await run('الاغنى', { userId: 'u1' });
  assert.match(JSON.stringify(r[0].embeds[0].toJSON()), /ريم/);
  r = await run('هويتي', { userId: 'u1' });
  assert.ok(r[0].embeds[0]);
  r = await run('حالة', { userId: 'u1' });
  assert.ok(r[0].embeds[0]);
  assert.ok(me.id);
});

test('أوامر الإدارة: ضبط الأغراض والوظائف والنقد', async () => {
  const target = ids.createIdentity({ guildId: G, userId: 'u2', slot: 1, firstName: 'هند', surname: 'البدر', gender: 'أنثى', nationality: 'عربية' });
  const user2 = { id: 'u2', bot: false };

  let r = await run('ادارة-غرض', {
    sub: 'ضبط', userId: 'admin',
    strings: { اسم: 'تفاح', ايموجي: '🍎' }, ints: { سعر: 10 },
  });
  assert.match(r[0].content, /تم إنشاء/);
  r = await run('ادارة-غرض', { sub: 'قائمة', userId: 'admin' });
  assert.match(JSON.stringify(r[0].embeds[0].toJSON()), /تفاح/);

  r = await run('ادارة-حقيبة', { sub: 'اضافة', userId: 'admin', users: { عضو: user2 }, ints: { الهوية: 1, كمية: 3 }, strings: { غرض: 'تفاح' } });
  assert.match(r[0], /تفاح/);
  assert.equal(inv.listItems(target.id)[0].quantity, 3);

  r = await run('ادارة-هوية', { sub: 'وظيفة', userId: 'admin', users: { عضو: user2 }, ints: { الهوية: 1 }, strings: { المهنة: 'worker' } });
  assert.match(r[0], /عامل/);
  r = await run('راتب', { userId: 'u2' });
  assert.match(JSON.stringify(r[0].embeds[0].toJSON()), /الراتب/);

  const cash0 = bank.getBalances(target.id).cash;
  await run('ادارة-بنك', { sub: 'اضافة-نقد', userId: 'admin', users: { عضو: user2 }, ints: { الهوية: 1, مبلغ: 40 } });
  assert.equal(bank.getBalances(target.id).cash, cash0 + 40);
  r = await run('ادارة-بنك', { sub: 'كشف', userId: 'admin', users: { عضو: user2 }, ints: { الهوية: 1 } });
  assert.match(JSON.stringify(r[0].embeds[0].toJSON()), /راتب/);

  r = await run('ادارة-سجل', { userId: 'admin' });
  assert.match(JSON.stringify(r[0].embeds[0].toJSON()), /إضافة غرض/);
});

test('أزرار اللوحة تعمل', async () => {
  const mkBtn = (action, userId) => {
    const { interaction, out } = fakeInteraction({ guildId: G, userId });
    Object.assign(interaction, {
      customId: `idp:btn:${action}`,
      isButton: () => true,
      isStringSelectMenu: () => false,
      isModalSubmit: () => false,
    });
    return { interaction, out };
  };
  for (const action of ['show', 'bag', 'bank', 'vault']) {
    const { interaction, out } = mkBtn(action, 'u1');
    await handlePanel(interaction);
    assert.ok(out.replies[0].embeds[0], action);
  }
  const { interaction } = mkBtn('bag', 'nobody');
  await assert.rejects(handlePanel(interaction), /تسجل دخول/);
});

test('معالج التفاعلات يرد برسالة خطأ للمستخدم ولا يرمي', async () => {
  const { interaction, out } = fakeInteraction({ guildId: G, userId: 'ghost', sub: 'رصيد' });
  Object.assign(interaction, {
    commandName: 'بنك',
    client: { commands },
    isChatInputCommand: () => true,
    isAutocomplete: () => false,
  });
  await handleInteraction(interaction);
  assert.match(JSON.stringify(out.replies[0].embeds[0].toJSON()), /تسجل دخول/);
  // نفس اللاعب مباشرة بعدها = تبريد
  const second = fakeInteraction({ guildId: G, userId: 'ghost', sub: 'رصيد' });
  Object.assign(second.interaction, { commandName: 'بنك', client: { commands }, isChatInputCommand: () => true, isAutocomplete: () => false });
  await handleInteraction(second.interaction);
  assert.match(JSON.stringify(second.out.replies[0].embeds[0].toJSON()), /تمهّل/);
});
