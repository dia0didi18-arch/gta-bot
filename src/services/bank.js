import { db } from '../db.js';
import { config } from '../config.js';
import { UserError } from '../errors.js';
import { getIdentity } from './identity.js';

const now = () => Math.floor(Date.now() / 1000);

export function assertAmount(amount) {
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > config.maxAmount) {
    throw new UserError('المبلغ غير صحيح.');
  }
}

export function logBank(identityId, type, amount, note = null) {
  db.prepare('INSERT INTO bank_log (identity_id, type, amount, note, created_at) VALUES (?, ?, ?, ?, ?)').run(
    identityId,
    type,
    amount,
    note,
    now(),
  );
}

export function getAccount(identityId) {
  return db.prepare('SELECT * FROM bank_accounts WHERE identity_id = ?').get(identityId);
}

/** نقد + رصيد البنك للهوية. */
export function getBalances(identityId) {
  const row = db
    .prepare(
      `SELECT i.cash, b.balance, b.iban FROM identities i
       JOIN bank_accounts b ON b.identity_id = i.id WHERE i.id = ?`,
    )
    .get(identityId);
  if (!row) throw new UserError('الهوية غير موجودة.');
  return row;
}

/** آخر حركات الحساب (الأحدث أولاً). */
export function getStatement(identityId, limit = 10) {
  return db
    .prepare('SELECT type, amount, note, created_at FROM bank_log WHERE identity_id = ? ORDER BY id DESC LIMIT ?')
    .all(identityId, limit);
}

/* ---- عمليات نقد/بنك صغيرة تُستخدم من المتجر والرواتب والأغراض (داخل transactions) ---- */
export function takeCash(identityId, amount) {
  const r = db.prepare('UPDATE identities SET cash = cash - ? WHERE id = ? AND cash >= ?').run(amount, identityId, amount);
  if (r.changes === 0) throw new UserError('ما عندك نقد كافي.');
}

export function giveCash(identityId, amount) {
  db.prepare('UPDATE identities SET cash = cash + ? WHERE id = ?').run(amount, identityId);
}

export function giveBank(identityId, amount, type, note = null) {
  db.prepare('UPDATE bank_accounts SET balance = balance + ? WHERE identity_id = ?').run(amount, identityId);
  logBank(identityId, type, amount, note);
}

export const deposit = db.transaction((identityId, amount) => {
  assertAmount(amount);
  takeCash(identityId, amount);
  db.prepare('UPDATE bank_accounts SET balance = balance + ? WHERE identity_id = ?').run(amount, identityId);
  logBank(identityId, 'deposit', amount);
  return getBalances(identityId);
});

export const withdraw = db.transaction((identityId, amount) => {
  assertAmount(amount);
  const r = db
    .prepare('UPDATE bank_accounts SET balance = balance - ? WHERE identity_id = ? AND balance >= ?')
    .run(amount, identityId, amount);
  if (r.changes === 0) throw new UserError('رصيدك في البنك غير كافي.');
  giveCash(identityId, amount);
  logBank(identityId, 'withdraw', amount);
  return getBalances(identityId);
});

/** رسوم التحويل بالمئة (تُقرّب للأسفل). */
export const transferFee = (amount) => Math.floor((amount * config.transferFeePercent) / 100);

/** تحويل من بنك هوية إلى بنك هوية ثانية (في نفس السيرفر) عن طريق رقم الحساب (IBAN). */
export const transfer = db.transaction((fromIdentityId, toIban, amount) => {
  assertAmount(amount);
  const target = db.prepare('SELECT * FROM bank_accounts WHERE iban = ?').get(String(toIban).trim().toUpperCase());
  const from = getIdentity(fromIdentityId);
  const to = target ? getIdentity(target.identity_id) : null;
  // حساب من سيرفر ثاني يُعامل كأنه غير موجود
  if (!target || !to || to.guild_id !== from.guild_id) throw new UserError('رقم الحساب (IBAN) غير موجود.');
  if (target.identity_id === fromIdentityId) throw new UserError('ما تقدر تحول لنفس حسابك.');
  if (!config.identity.allowSelfTransfer && from.user_id === to.user_id) {
    throw new UserError('ما تقدر تحول بين هوياتك أنت.');
  }

  const fee = transferFee(amount);
  const total = amount + fee;
  const r = db
    .prepare('UPDATE bank_accounts SET balance = balance - ? WHERE identity_id = ? AND balance >= ?')
    .run(total, fromIdentityId, total);
  if (r.changes === 0) throw new UserError('رصيدك في البنك غير كافي' + (fee ? ` (المبلغ + رسوم ${fee})` : '') + '.');
  db.prepare('UPDATE bank_accounts SET balance = balance + ? WHERE identity_id = ?').run(amount, target.identity_id);

  logBank(fromIdentityId, 'transfer_out', amount, target.iban);
  if (fee) logBank(fromIdentityId, 'fee', fee, 'رسوم تحويل');
  logBank(target.identity_id, 'transfer_in', amount, getAccount(fromIdentityId).iban);
  return { balances: getBalances(fromIdentityId), target: to, fee };
});

/** تعديل رصيد البنك من الإدارة (delta موجب = إضافة، سالب = خصم). */
export const adminAdjustBank = db.transaction((identityId, delta) => {
  if (!Number.isSafeInteger(delta) || delta === 0 || Math.abs(delta) > config.maxAmount) {
    throw new UserError('المبلغ غير صحيح.');
  }
  const r = db
    .prepare('UPDATE bank_accounts SET balance = balance + ? WHERE identity_id = ? AND balance + ? >= 0')
    .run(delta, identityId, delta);
  if (r.changes === 0) throw new UserError('رصيد الهوية أقل من المبلغ المراد خصمه.');
  logBank(identityId, delta > 0 ? 'admin_add' : 'admin_remove', Math.abs(delta));
  return getBalances(identityId);
});

/** تعديل النقد من الإدارة. */
export const adminAdjustCash = db.transaction((identityId, delta) => {
  if (!Number.isSafeInteger(delta) || delta === 0 || Math.abs(delta) > config.maxAmount) {
    throw new UserError('المبلغ غير صحيح.');
  }
  const r = db
    .prepare('UPDATE identities SET cash = cash + ? WHERE id = ? AND cash + ? >= 0')
    .run(delta, identityId, delta);
  if (r.changes === 0) throw new UserError('نقد الهوية أقل من المبلغ المراد خصمه.');
  logBank(identityId, delta > 0 ? 'admin_cash_add' : 'admin_cash_remove', Math.abs(delta));
  return getBalances(identityId);
});
