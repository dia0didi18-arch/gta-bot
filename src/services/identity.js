import crypto from 'node:crypto';
import { db } from '../db.js';
import { config } from '../config.js';
import { UserError } from '../errors.js';

const now = () => Math.floor(Date.now() / 1000);

function newIban() {
  for (let i = 0; i < 20; i++) {
    const iban = config.ibanPrefix + String(crypto.randomInt(0, 1e10)).padStart(10, '0');
    if (!db.prepare('SELECT 1 FROM bank_accounts WHERE iban = ?').get(iban)) return iban;
  }
  throw new Error('تعذر توليد رقم حساب فريد');
}

export function getIdentity(id) {
  return db.prepare('SELECT * FROM identities WHERE id = ?').get(id);
}

export function listIdentities(guildId, userId) {
  return db
    .prepare('SELECT * FROM identities WHERE guild_id = ? AND user_id = ? ORDER BY slot')
    .all(guildId, userId);
}

export function getIdentityBySlot(guildId, userId, slot) {
  return db
    .prepare('SELECT * FROM identities WHERE guild_id = ? AND user_id = ? AND slot = ?')
    .get(guildId, userId, slot);
}

/** الهوية الفعالة حاليا للاعب (أو undefined). */
export function getActive(guildId, userId) {
  return db
    .prepare(
      `SELECT i.* FROM sessions s
       JOIN identities i ON i.id = s.identity_id
       WHERE s.guild_id = ? AND s.user_id = ?`,
    )
    .get(guildId, userId);
}

export function requireActive(guildId, userId) {
  const active = getActive(guildId, userId);
  if (!active) {
    throw new UserError('لازم تسجل دخول بهوية أولاً من لوحة الهوية (إنشاء/تسجيل دخول).');
  }
  return active;
}

export const createIdentity = db.transaction(
  ({ guildId, userId, slot, firstName, surname, gender, nationality }) => {
    if (!config.identity.slots.some((s) => s.slot === slot)) {
      throw new UserError('رقم الهوية غير صحيح.');
    }
    if (getIdentityBySlot(guildId, userId, slot)) {
      throw new UserError('عندك هوية مسجلة في هذا الرقم مسبقاً.');
    }
    const dup = db
      .prepare(
        `SELECT 1 FROM identities
         WHERE guild_id = ? AND first_name = ? COLLATE NOCASE AND surname = ? COLLATE NOCASE`,
      )
      .get(guildId, firstName, surname);
    if (dup) throw new UserError('هذا الاسم مستخدم من هوية ثانية، اختر اسماً مختلفاً.');

    const info = db
      .prepare(
        `INSERT INTO identities
         (guild_id, user_id, slot, first_name, surname, gender, nationality, cash, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(guildId, userId, slot, firstName, surname, gender, nationality, config.identity.startingCash, now());
    const id = Number(info.lastInsertRowid);

    // حساب بنكي خاص بهذه الهوية فقط
    db.prepare('INSERT INTO bank_accounts (identity_id, iban, balance) VALUES (?, ?, ?)').run(
      id,
      newIban(),
      config.identity.startingBank,
    );

    // أول هوية تنشئها تصير فعالة تلقائياً
    if (!getActive(guildId, userId)) {
      db.prepare('INSERT INTO sessions (guild_id, user_id, identity_id) VALUES (?, ?, ?)').run(guildId, userId, id);
    }
    return getIdentity(id);
  },
);

export const login = db.transaction((guildId, userId, identityId) => {
  const identity = getIdentity(identityId);
  if (!identity || identity.guild_id !== guildId || identity.user_id !== userId) {
    throw new UserError('هذي الهوية مو لك.');
  }
  db.prepare(
    `INSERT INTO sessions (guild_id, user_id, identity_id) VALUES (?, ?, ?)
     ON CONFLICT(guild_id, user_id) DO UPDATE SET identity_id = excluded.identity_id`,
  ).run(guildId, userId, identityId);
  return identity;
});

export function logout(guildId, userId) {
  const active = getActive(guildId, userId);
  if (!active) throw new UserError('ما أنت مسجل دخول بأي هوية.');
  db.prepare('DELETE FROM sessions WHERE guild_id = ? AND user_id = ?').run(guildId, userId);
  return active;
}

/** حذف هوية (إدارة): يحذف معها الحقيبة والبنك تلقائياً (ON DELETE CASCADE). */
export function deleteIdentity(identityId) {
  const identity = getIdentity(identityId);
  if (!identity) throw new UserError('الهوية غير موجودة.');
  db.prepare('DELETE FROM identities WHERE id = ?').run(identityId);
  return identity;
}
