process.env.DB_PATH = ':memory:';

import test from 'node:test';
import assert from 'node:assert/strict';

const ids = await import('../src/services/identity.js');
const bank = await import('../src/services/bank.js');
const inv = await import('../src/services/inventory.js');
const items = await import('../src/services/items.js');
const { config } = await import('../src/config.js');

const G = 'guild1';
const mk = (userId, slot, first, last, guildId = G) =>
  ids.createIdentity({ guildId, userId, slot, firstName: first, surname: last, gender: 'ذكر', nationality: 'عربي' });

items.defineItem(G, 'مفتاح');
items.defineItem(G, 'هاتف');

test('كل هوية لها حقيبة وبنك مستقلين', () => {
  const a = mk('u1', 1, 'محمد', 'العلي');
  const b = mk('u1', 2, 'خالد', 'الدوسري');

  assert.notEqual(bank.getAccount(a.id).iban, bank.getAccount(b.id).iban);
  assert.match(bank.getAccount(a.id).iban, new RegExp(`^${config.ibanPrefix}\\d{10}$`));

  inv.addItem(a.id, 'مفتاح', 2);
  bank.deposit(a.id, 1000);

  const balA = bank.getBalances(a.id);
  const balB = bank.getBalances(b.id);
  assert.equal(balA.balance, config.identity.startingBank + 1000);
  assert.equal(balA.cash, config.identity.startingCash - 1000);
  assert.equal(balB.balance, config.identity.startingBank);
  assert.equal(balB.cash, config.identity.startingCash);
  assert.deepEqual(inv.listItems(b.id), []);
  assert.deepEqual(inv.listItems(a.id).map((i) => [i.item, i.quantity]), [['مفتاح', 2]]);
});

test('تبديل الهوية يغير الحقيبة والبنك المستخدمين', () => {
  const [a, b] = ids.listIdentities(G, 'u1');
  assert.equal(ids.getActive(G, 'u1').id, a.id); // أول هوية فعالة تلقائياً
  ids.login(G, 'u1', b.id);
  assert.equal(ids.requireActive(G, 'u1').id, b.id);
  assert.deepEqual(inv.listItems(ids.getActive(G, 'u1').id), []);
  ids.logout(G, 'u1');
  assert.equal(ids.getActive(G, 'u1'), undefined);
  assert.throws(() => ids.requireActive(G, 'u1'), /تسجل دخول/);
});

test('ما يسمح بهوية ثالثة أو تكرار الرقم أو تكرار الاسم', () => {
  assert.throws(() => mk('u1', 3, 'سعد', 'القحطاني'), /غير صحيح/);
  assert.throws(() => mk('u1', 1, 'سعد', 'القحطاني'), /هوية مسجلة/);
  assert.throws(() => mk('u2', 1, 'محمد', 'العلي'), /مستخدم/);
});

test('ما تقدر تدخل بهوية لاعب ثاني', () => {
  const other = mk('u2', 1, 'فهد', 'الشمري');
  assert.throws(() => ids.login(G, 'u1', other.id), /مو لك/);
});

test('التحويل بين لاعبين يشتغل والرصيد غير الكافي يفشل بدون تغيير', () => {
  const a = ids.listIdentities(G, 'u1')[0];
  const b = ids.listIdentities(G, 'u2')[0];
  const before = bank.getBalances(a.id).balance;

  bank.transfer(a.id, bank.getAccount(b.id).iban, 500);
  assert.equal(bank.getBalances(a.id).balance, before - 500);
  assert.equal(bank.getBalances(b.id).balance, config.identity.startingBank + 500);

  assert.throws(() => bank.transfer(a.id, bank.getAccount(b.id).iban, 10 ** 9), /غير كافي/);
  assert.equal(bank.getBalances(a.id).balance, before - 500);
  assert.equal(bank.getBalances(b.id).balance, config.identity.startingBank + 500);
});

test('منع التحويل ونقل الأغراض بين هويتين لنفس اللاعب', () => {
  const [a, b] = ids.listIdentities(G, 'u1');
  assert.throws(() => bank.transfer(a.id, bank.getAccount(b.id).iban, 10), /هوياتك/);
  assert.throws(() => inv.giveItem(a.id, b.id, 'مفتاح', 1), /هوياتك/);
  assert.equal(inv.listItems(a.id)[0].quantity, 2);
});

test('منع التحويل ونقل الأغراض بين سيرفرين', () => {
  const a = ids.listIdentities(G, 'u1')[0];
  items.defineItem('guild2', 'مفتاح');
  const x = mk('u9', 1, 'ماجد', 'الحربي', 'guild2');
  assert.throws(() => bank.transfer(a.id, bank.getAccount(x.id).iban, 10), /غير موجود/);
  assert.throws(() => bank.transfer(x.id, bank.getAccount(a.id).iban, 10), /غير موجود/);
  assert.throws(() => inv.giveItem(a.id, x.id, 'مفتاح', 1), /نفس السيرفر/);
  assert.equal(bank.getBalances(x.id).balance, config.identity.startingBank);
});

test('نقل الأغراض بين لاعبين، والكمية غير الكافية ترفض', () => {
  const a = ids.listIdentities(G, 'u1')[0];
  const c = ids.listIdentities(G, 'u2')[0];
  inv.giveItem(a.id, c.id, 'مفتاح', 1);
  assert.equal(inv.listItems(a.id)[0].quantity, 1);
  assert.equal(inv.listItems(c.id)[0].quantity, 1);
  assert.throws(() => inv.giveItem(a.id, c.id, 'مفتاح', 5), /كمية كافية/);
  inv.removeItem(a.id, 'مفتاح', 1);
  assert.deepEqual(inv.listItems(a.id), []);
});

test('حذف هوية يحذف حقيبتها وبنكها فقط', () => {
  const [a, b] = ids.listIdentities(G, 'u1');
  inv.addItem(b.id, 'هاتف', 1);
  ids.deleteIdentity(a.id);
  assert.equal(bank.getAccount(a.id), undefined);
  assert.deepEqual(inv.listItems(a.id), []);
  assert.ok(bank.getAccount(b.id));
  assert.deepEqual(inv.listItems(b.id).map((i) => [i.item, i.quantity]), [['هاتف', 1]]);
  assert.equal(ids.listIdentities(G, 'u1').length, 1);
});

test('تعديل رصيد ونقد الإدارة', () => {
  const b = ids.listIdentities(G, 'u1')[0];
  const start = bank.getBalances(b.id);
  bank.adminAdjustBank(b.id, 300);
  assert.equal(bank.getBalances(b.id).balance, start.balance + 300);
  assert.throws(() => bank.adminAdjustBank(b.id, -(start.balance + 301)), /أقل/);
  bank.adminAdjustCash(b.id, 50);
  assert.equal(bank.getBalances(b.id).cash, start.cash + 50);
  assert.throws(() => bank.adminAdjustCash(b.id, -(start.cash + 51)), /أقل/);
});

test('كشف الحساب يسجل الحركات بالترتيب', () => {
  const b = ids.listIdentities(G, 'u1')[0];
  const rows = bank.getStatement(b.id, 10);
  assert.ok(rows.length >= 2);
  assert.equal(rows[0].type, 'admin_cash_add');
  assert.ok(rows.some((r) => r.type === 'admin_add'));
});
