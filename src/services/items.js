import { db } from '../db.js';
import { config } from '../config.js';
import { UserError } from '../errors.js';

export const EFFECTS = ['none', 'cash', 'bank'];

export function normalizeItemName(raw) {
  const item = String(raw ?? '').trim().replace(/\s+/g, ' ');
  if (!/^[\p{L}\p{N} _-]{1,32}$/u.test(item)) {
    throw new UserError('اسم الغرض غير صالح (حروف وأرقام فقط، حتى 32 حرف).');
  }
  return item;
}

export function getItem(guildId, name) {
  return db.prepare('SELECT * FROM items WHERE guild_id = ? AND name = ?').get(guildId, name);
}

export function listCatalog(guildId) {
  return db.prepare('SELECT * FROM items WHERE guild_id = ? ORDER BY name').all(guildId);
}

export function listShop(guildId) {
  return db.prepare('SELECT * FROM items WHERE guild_id = ? AND price > 0 ORDER BY price, name').all(guildId);
}

const isInt = (n, lo, hi) => Number.isSafeInteger(n) && n >= lo && n <= hi;

/**
 * إنشاء أو تعديل غرض في قائمة الأغراض. الحقول غير المذكورة في patch تبقى كما هي.
 * patch: { emoji, description, price, usable, consumable, effect_type, effect_value, effect_message }
 */
export const defineItem = db.transaction((guildId, rawName, patch = {}) => {
  const name = normalizeItemName(rawName);
  const old = getItem(guildId, name);

  const clean = {};
  for (const [k, v] of Object.entries(patch)) if (v !== undefined && v !== null) clean[k] = v;
  for (const k of ['usable', 'consumable']) if (k in clean) clean[k] = clean[k] ? 1 : 0;

  const next = {
    emoji: null,
    description: null,
    price: 0,
    usable: 0,
    consumable: 1,
    effect_type: 'none',
    effect_value: 0,
    effect_message: null,
    ...(old ?? {}),
    ...clean,
  };

  if (!isInt(next.price, 0, config.maxAmount)) throw new UserError('السعر غير صحيح.');
  if (!EFFECTS.includes(next.effect_type)) throw new UserError('نوع الأثر غير صحيح.');
  if (!isInt(next.effect_value, 0, config.maxAmount)) throw new UserError('قيمة الأثر غير صحيحة.');
  if (next.effect_type !== 'none') {
    if (next.effect_value <= 0) throw new UserError('حدد قيمة الأثر (أكبر من صفر).');
    // أي غرض يعطي فلوس لازم يُستهلك، وإلا يصير تكرار فلوس لا نهائي
    next.usable = 1;
    next.consumable = 1;
  }

  if (!old) {
    const { n } = db.prepare('SELECT COUNT(*) AS n FROM items WHERE guild_id = ?').get(guildId);
    if (n >= config.maxCatalogItems) throw new UserError('وصلت الحد الأقصى لعدد الأغراض في السيرفر.');
  }

  db.prepare(
    `INSERT INTO items (guild_id, name, emoji, description, price, usable, consumable, effect_type, effect_value, effect_message)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(guild_id, name) DO UPDATE SET
       emoji = excluded.emoji, description = excluded.description, price = excluded.price,
       usable = excluded.usable, consumable = excluded.consumable, effect_type = excluded.effect_type,
       effect_value = excluded.effect_value, effect_message = excluded.effect_message`,
  ).run(
    guildId,
    old?.name ?? name,
    next.emoji,
    next.description,
    next.price,
    next.usable,
    next.consumable,
    next.effect_type,
    next.effect_value,
    next.effect_message,
  );
  return { item: getItem(guildId, name), created: !old };
});

/** حذف تعريف غرض + إزالته من كل حقائب وخزائن السيرفر. */
export const removeDefinition = db.transaction((guildId, rawName) => {
  const def = getItem(guildId, normalizeItemName(rawName));
  if (!def) throw new UserError('الغرض غير موجود في القائمة.');
  const scope = 'identity_id IN (SELECT id FROM identities WHERE guild_id = ?)';
  db.prepare(`DELETE FROM inventory WHERE item = ? AND ${scope}`).run(def.name, guildId);
  db.prepare(`DELETE FROM vault_items WHERE item = ? AND ${scope}`).run(def.name, guildId);
  db.prepare('DELETE FROM items WHERE guild_id = ? AND name = ?').run(guildId, def.name);
  return def;
});
