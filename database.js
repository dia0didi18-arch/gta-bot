// ============================================================
// طبقة قاعدة البيانات (SQLite عبر better-sqlite3)
// كل جدول مرتبط بـ character_id، لذلك بيانات كل شخصية مستقلة تماماً.
// ============================================================
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const cfg = require('./config');

/** خطأ يُعرض للمستخدم برسالة عربية */
class UserError extends Error {}

// مسار قاعدة البيانات: على Render اضبط DB_PATH على مسار داخل القرص الدائم (Persistent Disk)
const DB_FILE = process.env.DB_PATH || path.join(__dirname, 'data.sqlite');
fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS characters (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT    NOT NULL,
  first_name  TEXT    NOT NULL,
  last_name   TEXT    NOT NULL,
  age         INTEGER NOT NULL,
  gender      TEXT    NOT NULL,
  nationality TEXT    NOT NULL,
  created_at  INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
CREATE INDEX IF NOT EXISTS idx_characters_user ON characters(user_id);

-- الشخصية النشطة لكل مستخدم ديسكورد
CREATE TABLE IF NOT EXISTS sessions (
  user_id      TEXT PRIMARY KEY,
  character_id INTEGER REFERENCES characters(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS inventory (
  character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  item_key     TEXT    NOT NULL,
  quantity     INTEGER NOT NULL CHECK (quantity > 0),
  PRIMARY KEY (character_id, item_key)
);

CREATE TABLE IF NOT EXISTS vault (
  character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  item_key     TEXT    NOT NULL,
  quantity     INTEGER NOT NULL CHECK (quantity > 0),
  PRIMARY KEY (character_id, item_key)
);

CREATE TABLE IF NOT EXISTS bank (
  character_id INTEGER PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,
  cash         INTEGER NOT NULL DEFAULT 0 CHECK (cash >= 0),
  balance      INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0)
);
`);

// ---------------------------------------------------------------- الشخصيات
const getCharacters = (userId) =>
  db.prepare('SELECT * FROM characters WHERE user_id = ? ORDER BY id').all(userId);

const getCharacter = (id) => db.prepare('SELECT * FROM characters WHERE id = ?').get(id);

const getActive = (userId) =>
  db.prepare(`SELECT c.* FROM sessions s JOIN characters c ON c.id = s.character_id WHERE s.user_id = ?`).get(userId);

const setActive = (userId, characterId) => {
  const c = getCharacter(characterId);
  if (!c || c.user_id !== userId) throw new UserError('هذه الشخصية غير موجودة أو لا تخصّك.');
  db.prepare(`INSERT INTO sessions (user_id, character_id) VALUES (?, ?)
              ON CONFLICT(user_id) DO UPDATE SET character_id = excluded.character_id`).run(userId, characterId);
  return c;
};

const logout = (userId) => db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId).changes > 0;

const createCharacter = db.transaction((userId, d) => {
  if (getCharacters(userId).length >= cfg.MAX_CHARACTERS)
    throw new UserError(`وصلت للحد الأقصى من الشخصيات (${cfg.MAX_CHARACTERS}).`);
  const id = db.prepare(
    'INSERT INTO characters (user_id, first_name, last_name, age, gender, nationality) VALUES (?,?,?,?,?,?)'
  ).run(userId, d.firstName, d.lastName, d.age, d.gender, d.nationality).lastInsertRowid;
  db.prepare('INSERT INTO bank (character_id, cash, balance) VALUES (?,?,?)').run(id, cfg.START_CASH, cfg.START_BANK);
  setActive(userId, Number(id)); // تسجيل دخول تلقائي بالشخصية الجديدة
  return getCharacter(id);
});

// ---------------------------------------------------------------- الحقيبة والخزنة
const TABLES = { inventory: cfg.INVENTORY_CAPACITY, vault: cfg.VAULT_CAPACITY };
const tbl = (name) => {
  if (!(name in TABLES)) throw new Error('Invalid table');
  return name;
};

const getItems = (table, cid) =>
  db.prepare(`SELECT item_key, quantity FROM ${tbl(table)} WHERE character_id = ? ORDER BY item_key`).all(cid);

const getQty = (table, cid, key) =>
  db.prepare(`SELECT quantity FROM ${tbl(table)} WHERE character_id = ? AND item_key = ?`).get(cid, key)?.quantity ?? 0;

const totalQty = (table, cid) =>
  db.prepare(`SELECT COALESCE(SUM(quantity),0) AS n FROM ${tbl(table)} WHERE character_id = ?`).get(cid).n;

const capacity = (table) => TABLES[tbl(table)];

function addItem(table, cid, key, qty) {
  if (totalQty(table, cid) + qty > TABLES[tbl(table)])
    throw new UserError('لا توجد مساحة كافية للاحتفاظ بهذه الكمية.');
  db.prepare(`INSERT INTO ${tbl(table)} (character_id, item_key, quantity) VALUES (?,?,?)
              ON CONFLICT(character_id, item_key) DO UPDATE SET quantity = quantity + excluded.quantity`).run(cid, key, qty);
}

function removeItem(table, cid, key, qty) {
  const have = getQty(table, cid, key);
  if (have < qty) throw new UserError('الكمية المتوفرة غير كافية.');
  if (have === qty) db.prepare(`DELETE FROM ${tbl(table)} WHERE character_id = ? AND item_key = ?`).run(cid, key);
  else db.prepare(`UPDATE ${tbl(table)} SET quantity = quantity - ? WHERE character_id = ? AND item_key = ?`).run(qty, cid, key);
}

/** نقل بين الحقيبة والخزنة لنفس الشخصية */
const moveItem = db.transaction((from, to, cid, key, qty) => {
  removeItem(from, cid, key, qty);
  addItem(to, cid, key, qty);
});

/** إعطاء غرض من شخصية إلى شخصية أخرى (ذرّي: إما ينجح كله أو يُلغى كله) */
const giveItem = db.transaction((fromCid, toCid, key, qty) => {
  removeItem('inventory', fromCid, key, qty);
  addItem('inventory', toCid, key, qty);
});

// ---------------------------------------------------------------- البنك
const getBank = (cid) => db.prepare('SELECT cash, balance FROM bank WHERE character_id = ?').get(cid);

const deposit = db.transaction((cid, amt) => {
  if (getBank(cid).cash < amt) throw new UserError('ليس لديك كاش كافٍ للإيداع.');
  db.prepare('UPDATE bank SET cash = cash - ?, balance = balance + ? WHERE character_id = ?').run(amt, amt, cid);
});

const withdraw = db.transaction((cid, amt) => {
  if (getBank(cid).balance < amt) throw new UserError('رصيدك البنكي غير كافٍ للسحب.');
  db.prepare('UPDATE bank SET cash = cash + ?, balance = balance - ? WHERE character_id = ?').run(amt, amt, cid);
});

const transfer = db.transaction((fromCid, toCid, amt) => {
  if (getBank(fromCid).balance < amt) throw new UserError('رصيدك البنكي غير كافٍ لإتمام التحويل.');
  db.prepare('UPDATE bank SET balance = balance - ? WHERE character_id = ?').run(amt, fromCid);
  db.prepare('UPDATE bank SET balance = balance + ? WHERE character_id = ?').run(amt, toCid);
});

/** للإدارة: إضافة (أو خصم بقيمة سالبة) كاش */
const addCash = db.transaction((cid, amt) => {
  if (getBank(cid).cash + amt < 0) throw new UserError('لا يمكن أن يصبح الكاش أقل من صفر.');
  db.prepare('UPDATE bank SET cash = cash + ? WHERE character_id = ?').run(amt, cid);
});

module.exports = {
  UserError,
  getCharacters, getCharacter, getActive, setActive, logout, createCharacter,
  getItems, getQty, totalQty, capacity, addItem, removeItem, moveItem, giveItem,
  getBank, deposit, withdraw, transfer, addCash,
};
