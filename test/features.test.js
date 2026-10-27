process.env.DB_PATH = ':memory:';

import test from 'node:test';
import assert from 'node:assert/strict';

const ids = await import('../src/services/identity.js');
const bank = await import('../src/services/bank.js');
const inv = await import('../src/services/inventory.js');
const items = await import('../src/services/items.js');
const eco = await import('../src/services/economy.js');
const { config } = await import('../src/config.js');
const { checkCooldown } = await import('../src/utils/cooldown.js');

const G = 'guildF';
const mk = (userId, slot, first, last) =>
  ids.createIdentity({ guildId: G, userId, slot, firstName: first, surname: last, gender: 'أنثى', nationality: 'عربية' });

const a = mk('a', 1, 'سارة', 'الأحمد');
const b = mk('b', 1, 'ليلى', 'الناصر');

test('الأغراض غير المعرّفة ترفض عند strictItems', () => {
  assert.equal(config.strictItems, true);
  assert.throws(() => inv.addItem(a.id, 'سيف', 1), /غير موجود في قائمة/);
  items.defineItem(G, 'سيف', { emoji: '🗡️', price: 100 });
  assert.equal(inv.addItem(a.id, 'سيف', 1), 'سيف');
  // الحروف الكبيرة/الصغيرة ما تفرق وتتوحد على الاسم المعرّف
  assert.equal(inv.addItem(a.id, ' سيف ', 1), 'سيف');
  assert.equal(inv.listItems(a.id)[0].quantity, 2);
  assert.equal(inv.listItems(a.id)[0].emoji, '🗡️');
});

test('تعديل غرض يبقي الحقول غير المذكورة', () => {
  items.defineItem(G, 'سيف', { description: 'حاد' });
  const def = items.getItem(G, 'سيف');
  assert.equal(def.price, 100);
  assert.equal(def.emoji, '🗡️');
  assert.equal(def.description, 'حاد');
});

test('غرض بأثر نقد لازم قيمة ويُستهلك دائماً (منع تكرار الفلوس)', () => {
  assert.throws(() => items.defineItem(G, 'كيس', { effect_type: 'cash' }), /قيمة الأثر/);
  const { item } = items.defineItem(G, 'كيس', { effect_type: 'cash', effect_value: 700, consumable: false });
  assert.equal(item.consumable, 1);
  assert.equal(item.usable, 1);
});

test('استخدام غرض: يستهلك ويعطي النقد، وغير القابل يرفض', () => {
  inv.addItem(a.id, 'كيس', 1, 'admin_add');
  const cash = bank.getBalances(a.id).cash;
  inv.useItem(a.id, 'كيس');
  assert.equal(bank.getBalances(a.id).cash, cash + 700);
  assert.throws(() => inv.useItem(a.id, 'كيس'), /ما عندك/);
  assert.throws(() => inv.useItem(a.id, 'سيف'), /غير قابل/);
});

test('غرض بأثر بنك + غرض قابل للاستخدام بدون استهلاك', () => {
  items.defineItem(G, 'شيك', { effect_type: 'bank', effect_value: 250 });
  items.defineItem(G, 'جوال', { usable: true, consumable: false, effect_message: 'ألو؟' });
  inv.addItem(a.id, 'شيك', 1);
  inv.addItem(a.id, 'جوال', 1);
  const before = bank.getBalances(a.id).balance;
  inv.useItem(a.id, 'شيك');
  assert.equal(bank.getBalances(a.id).balance, before + 250);
  inv.useItem(a.id, 'جوال');
  assert.equal(inv.listItems(a.id).find((i) => i.item === 'جوال').quantity, 1);
});

test('الخزنة: إيداع وسحب وعزل عن الحقيبة', () => {
  inv.vaultDeposit(a.id, 'جوال', 1);
  assert.equal(inv.listItems(a.id).find((i) => i.item === 'جوال'), undefined);
  assert.equal(inv.listVault(a.id)[0].item, 'جوال');
  assert.deepEqual(inv.listVault(b.id), []);
  assert.throws(() => inv.vaultDeposit(a.id, 'جوال', 1), /كمية كافية/);
  inv.vaultWithdraw(a.id, 'جوال', 1);
  assert.equal(inv.listVault(a.id).length, 0);
  assert.equal(inv.listItems(a.id).find((i) => i.item === 'جوال').quantity, 1);
});

test('حد أنواع الحقيبة يمنع الإضافة ولا يخسر اللاعب شي', () => {
  const c = mk('c', 1, 'نورة', 'السالم');
  for (let i = 0; i < config.maxItemTypes; i++) {
    items.defineItem(G, `غرض${i}`);
    inv.addItem(c.id, `غرض${i}`, 1);
  }
  items.defineItem(G, 'زيادة');
  assert.throws(() => inv.addItem(c.id, 'زيادة', 1), /ممتلئة/);
  // سحب من الخزنة لحقيبة ممتلئة يفشل ويرجع الغرض للخزنة
  inv.vaultDeposit(c.id, 'غرض0', 1);
  inv.addItem(c.id, 'زيادة', 1);
  assert.throws(() => inv.vaultWithdraw(c.id, 'غرض0', 1), /ممتلئة/);
  assert.equal(inv.listVault(c.id)[0].quantity, 1);
});

test('المتجر: شراء من النقد وبيع بنسبة', () => {
  const cash = bank.getBalances(b.id).cash;
  const r = eco.buyItem(b.id, 'سيف', 3);
  assert.equal(r.total, 300);
  assert.equal(bank.getBalances(b.id).cash, cash - 300);
  assert.equal(inv.listItems(b.id).find((i) => i.item === 'سيف').quantity, 3);

  const s = eco.sellItem(b.id, 'سيف', 2);
  assert.equal(s.total, Math.floor(100 * config.sellRatio) * 2);
  assert.equal(inv.listItems(b.id).find((i) => i.item === 'سيف').quantity, 1);

  assert.throws(() => eco.buyItem(b.id, 'جوال', 1), /غير معروض/);
  assert.throws(() => eco.buyItem(b.id, 'سيف', 100000), /نقد كافي|المبلغ غير صحيح/);
  assert.throws(() => eco.sellItem(b.id, 'سيف', 5), /كمية كافية/);
  assert.equal(bank.getBalances(b.id).cash, cash - 300 + s.total); // فشل الشراء ما غيّر شي
});

test('الراتب: بدون وظيفة يرفض، وبوظيفة ينزل في البنك ثم يتبرد', () => {
  assert.throws(() => eco.claimSalary(a.id), /بدون راتب/);
  eco.setJob(a.id, 'doctor');
  const before = bank.getBalances(a.id).balance;
  const { amount } = eco.claimSalary(a.id);
  assert.equal(amount, 3500);
  assert.equal(bank.getBalances(a.id).balance, before + 3500);
  assert.throws(() => eco.claimSalary(a.id), /ما تقدر تستلم الراتب/);
  assert.throws(() => eco.setJob(a.id, 'nope'), /غير موجودة/);
});

test('رسوم التحويل تنخصم من المرسل فوق المبلغ', () => {
  const old = config.transferFeePercent;
  config.transferFeePercent = 10;
  try {
    const from = bank.getBalances(a.id).balance;
    const to = bank.getBalances(b.id).balance;
    const r = bank.transfer(a.id, bank.getAccount(b.id).iban, 1000);
    assert.equal(r.fee, 100);
    assert.equal(bank.getBalances(a.id).balance, from - 1100);
    assert.equal(bank.getBalances(b.id).balance, to + 1000);
    assert.ok(bank.getStatement(a.id, 5).some((x) => x.type === 'fee' && x.amount === 100));
    // المبلغ يكفي لكن مع الرسوم لا
    const left = bank.getBalances(a.id).balance;
    assert.throws(() => bank.transfer(a.id, bank.getAccount(b.id).iban, left), /رسوم/);
    assert.equal(bank.getBalances(a.id).balance, left);
  } finally {
    config.transferFeePercent = old;
  }
});

test('لوحة الأغنياء مرتبة بمجموع النقد والبنك', () => {
  const rows = eco.leaderboard(G, 10);
  assert.ok(rows.length >= 3);
  for (let i = 1; i < rows.length; i++) assert.ok(rows[i - 1].total >= rows[i].total);
});

test('حذف تعريف غرض يحذفه من الحقائب والخزائن', () => {
  items.defineItem(G, 'مؤقت');
  inv.addItem(a.id, 'مؤقت', 2);
  inv.vaultDeposit(a.id, 'مؤقت', 1);
  items.removeDefinition(G, 'مؤقت');
  assert.equal(inv.listItems(a.id).find((i) => i.item === 'مؤقت'), undefined);
  assert.equal(inv.listVault(a.id).find((i) => i.item === 'مؤقت'), undefined);
  assert.throws(() => items.removeDefinition(G, 'مؤقت'), /غير موجود/);
});

test('سجل الأغراض يحفظ الحركات', () => {
  const log = inv.itemHistory(b.id, 10);
  assert.ok(log.some((r) => r.type === 'buy'));
  assert.ok(log.some((r) => r.type === 'sell'));
});

test('التبريد يمنع التكرار السريع', () => {
  checkCooldown('x', 'k', 10_000);
  assert.throws(() => checkCooldown('x', 'k', 10_000), /تمهّل/);
  checkCooldown('y', 'k', 10_000); // لاعب ثاني غير متأثر
});
