import { db } from '../db.js';
import { config } from '../config.js';
import { UserError } from '../errors.js';
import { getIdentity } from './identity.js';
import { getItem, normalizeItemName } from './items.js';
import { giveBank, giveCash } from './bank.js';

const now = () => Math.floor(Date.now() / 1000);

export const normalizeItem = normalizeItemName;

const KINDS = {
  bag: { table: 'inventory', limit: () => config.maxItemTypes, full: 'الحقيبة ممتلئة (حد أنواع الأغراض).' },
  vault: { table: 'vault_items', limit: () => config.vaultMaxTypes, full: 'الخزنة ممتلئة (حد أنواع الأغراض).' },
};

export function assertQty(qty) {
  if (!Number.isSafeInteger(qty) || qty < 1 || qty > config.maxItemQty) {
    throw new UserError('الكمية غير صحيحة.');
  }
}

function logItem(identityId, type, item, qty, note = null) {
  db.prepare('INSERT INTO item_log (identity_id, type, item, quantity, note, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
    identityId,
    type,
    item,
    qty,
    note,
    now(),
  );
}

function mustIdentity(identityId) {
  const identity = getIdentity(identityId);
  if (!identity) throw new UserError('الهوية غير موجودة.');
  return identity;
}

/** اسم الغرض بالشكل المسجل في القائمة (ولو strictItems شغال يرفض الأغراض غير المعرّفة). */
function canonicalName(guildId, raw) {
  const name = normalizeItemName(raw);
  const def = getItem(guildId, name);
  if (def) return def.name;
  if (config.strictItems) throw new UserError(`الغرض «${name}» غير موجود في قائمة الأغراض.`);
  return name;
}

function listKind(kind, identityId) {
  const { table } = KINDS[kind];
  return db
    .prepare(
      `SELECT n.item, n.quantity, it.emoji, it.description, it.price
       FROM ${table} n
       JOIN identities i ON i.id = n.identity_id
       LEFT JOIN items it ON it.guild_id = i.guild_id AND it.name = n.item
       WHERE n.identity_id = ? ORDER BY n.item`,
    )
    .all(identityId);
}

function put(kind, identityId, item, qty) {
  const { table, limit, full } = KINDS[kind];
  assertQty(qty);
  const row = db.prepare(`SELECT quantity FROM ${table} WHERE identity_id = ? AND item = ?`).get(identityId, item);
  if (!row) {
    const { n } = db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE identity_id = ?`).get(identityId);
    if (n >= limit()) throw new UserError(full);
  }
  if ((row?.quantity ?? 0) + qty > config.maxItemQty) throw new UserError('الكمية تتجاوز الحد المسموح.');
  db.prepare(
    `INSERT INTO ${table} (identity_id, item, quantity) VALUES (?, ?, ?)
     ON CONFLICT(identity_id, item) DO UPDATE SET quantity = quantity + excluded.quantity`,
  ).run(identityId, item, qty);
}

function take(kind, identityId, rawItem, qty) {
  const { table } = KINDS[kind];
  const item = normalizeItemName(rawItem);
  assertQty(qty);
  const row = db.prepare(`SELECT item, quantity FROM ${table} WHERE identity_id = ? AND item = ?`).get(identityId, item);
  if (!row || row.quantity < qty) throw new UserError(`ما عندك كمية كافية من «${item}».`);
  if (row.quantity === qty) {
    db.prepare(`DELETE FROM ${table} WHERE identity_id = ? AND item = ?`).run(identityId, item);
  } else {
    db.prepare(`UPDATE ${table} SET quantity = quantity - ? WHERE identity_id = ? AND item = ?`).run(qty, identityId, item);
  }
  return row.item;
}

export const listItems = (identityId) => listKind('bag', identityId);
export const listVault = (identityId) => listKind('vault', identityId);

export function itemHistory(identityId, limit = 10) {
  return db
    .prepare('SELECT type, item, quantity, note, created_at FROM item_log WHERE identity_id = ? ORDER BY id DESC LIMIT ?')
    .all(identityId, limit);
}

export const addItem = db.transaction((identityId, rawItem, qty, type = 'add', note = null) => {
  const identity = mustIdentity(identityId);
  const name = canonicalName(identity.guild_id, rawItem);
  put('bag', identityId, name, qty);
  logItem(identityId, type, name, qty, note);
  return name;
});

export const removeItem = db.transaction((identityId, rawItem, qty, type = 'remove', note = null) => {
  const name = take('bag', identityId, rawItem, qty);
  logItem(identityId, type, name, qty, note);
  return name;
});

/** إعطاء غرض من حقيبة هوية إلى حقيبة هوية ثانية (نفس السيرفر). */
export const giveItem = db.transaction((fromIdentityId, toIdentityId, rawItem, qty) => {
  if (fromIdentityId === toIdentityId) throw new UserError('ما تقدر تعطي نفسك.');
  const from = mustIdentity(fromIdentityId);
  const to = mustIdentity(toIdentityId);
  if (from.guild_id !== to.guild_id) throw new UserError('اللاعب مو في نفس السيرفر.');
  if (!config.identity.allowSelfTransfer && from.user_id === to.user_id) {
    throw new UserError('ما تقدر تنقل أغراض بين هوياتك أنت.');
  }
  const item = take('bag', fromIdentityId, rawItem, qty);
  put('bag', toIdentityId, item, qty);
  logItem(fromIdentityId, 'give_out', item, qty, `${to.first_name} ${to.surname}`);
  logItem(toIdentityId, 'give_in', item, qty, `${from.first_name} ${from.surname}`);
  return item;
});

/** استخدام غرض قابل للاستخدام (حسب تعريفه في القائمة). */
export const useItem = db.transaction((identityId, rawItem) => {
  const identity = mustIdentity(identityId);
  const def = getItem(identity.guild_id, normalizeItemName(rawItem));
  if (!def) throw new UserError('هذا الغرض غير موجود في قائمة الأغراض.');
  if (!def.usable) throw new UserError(`«${def.name}» غير قابل للاستخدام.`);

  const have = db.prepare('SELECT quantity FROM inventory WHERE identity_id = ? AND item = ?').get(identityId, def.name);
  if (!have) throw new UserError(`ما عندك «${def.name}» في حقيبتك.`);

  if (def.consumable) take('bag', identityId, def.name, 1);
  if (def.effect_type === 'cash') giveCash(identityId, def.effect_value);
  else if (def.effect_type === 'bank') giveBank(identityId, def.effect_value, 'item_effect', def.name);
  logItem(identityId, 'use', def.name, 1);
  return { item: def };
});

export const vaultDeposit = db.transaction((identityId, rawItem, qty) => {
  const name = take('bag', identityId, rawItem, qty);
  put('vault', identityId, name, qty);
  logItem(identityId, 'vault_in', name, qty);
  return name;
});

export const vaultWithdraw = db.transaction((identityId, rawItem, qty) => {
  const name = take('vault', identityId, rawItem, qty);
  put('bag', identityId, name, qty);
  logItem(identityId, 'vault_out', name, qty);
  return name;
});
