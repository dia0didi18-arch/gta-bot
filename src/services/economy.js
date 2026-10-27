import { db } from '../db.js';
import { config, jobByKey } from '../config.js';
import { UserError } from '../errors.js';
import { getIdentity } from './identity.js';
import { giveBank, giveCash, takeCash, assertAmount } from './bank.js';
import { addItem, removeItem, assertQty } from './inventory.js';
import { getItem, normalizeItemName } from './items.js';

const now = () => Math.floor(Date.now() / 1000);

/* ----------------------------- الوظائف والرواتب ----------------------------- */

export function setJob(identityId, key) {
  if (!jobByKey(key)) throw new UserError('الوظيفة غير موجودة.');
  db.prepare('UPDATE identities SET job = ? WHERE id = ?').run(key, identityId);
  return getIdentity(identityId);
}

/** استلام الراتب (ينزل في البنك). */
export const claimSalary = db.transaction((identityId) => {
  const identity = getIdentity(identityId);
  const job = jobByKey(identity.job);
  if (!job || job.salary <= 0) throw new UserError('وظيفتك الحالية بدون راتب. اطلب من الإدارة تعيينك بوظيفة.');

  const next = identity.last_salary + config.salaryCooldownHours * 3600;
  if (next > now()) throw new UserError(`ما تقدر تستلم الراتب الحين، تقدر <t:${next}:R> (<t:${next}:t>).`);

  giveBank(identityId, job.salary, 'salary', job.label);
  db.prepare('UPDATE identities SET last_salary = ? WHERE id = ?').run(now(), identityId);
  return { job, amount: job.salary };
});

/* --------------------------------- المتجر --------------------------------- */

export const sellPrice = (def) => Math.floor(def.price * config.sellRatio);

export const buyItem = db.transaction((identityId, rawItem, qty) => {
  const identity = getIdentity(identityId);
  assertQty(qty);
  const def = getItem(identity.guild_id, normalizeItemName(rawItem));
  if (!def || def.price <= 0) throw new UserError('هذا الغرض غير معروض في المتجر.');
  const total = def.price * qty;
  assertAmount(total);
  takeCash(identityId, total);
  addItem(identityId, def.name, qty, 'buy', String(total));
  return { item: def, qty, total };
});

export const sellItem = db.transaction((identityId, rawItem, qty) => {
  const identity = getIdentity(identityId);
  assertQty(qty);
  const def = getItem(identity.guild_id, normalizeItemName(rawItem));
  if (!def || def.price <= 0) throw new UserError('المتجر ما يشتري هذا الغرض.');
  const each = sellPrice(def);
  if (each < 1) throw new UserError('سعر بيع هذا الغرض أقل من 1.');
  const total = each * qty;
  assertAmount(total);
  removeItem(identityId, def.name, qty, 'sell', String(total));
  giveCash(identityId, total);
  return { item: def, qty, total };
});

/* ------------------------------ لوحة الأغنياء ------------------------------ */

export function leaderboard(guildId, limit = 10) {
  return db
    .prepare(
      `SELECT i.first_name, i.surname, i.job, i.cash, b.balance, (i.cash + b.balance) AS total
       FROM identities i JOIN bank_accounts b ON b.identity_id = i.id
       WHERE i.guild_id = ? ORDER BY total DESC, i.id ASC LIMIT ?`,
    )
    .all(guildId, limit);
}
