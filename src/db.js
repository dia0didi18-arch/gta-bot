import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

export const dbFile = process.env.DB_PATH || './data/bot.db';
if (dbFile !== ':memory:') fs.mkdirSync(path.dirname(dbFile), { recursive: true });

export const db = new Database(dbFile);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

/*
 * فكرة العزل:
 *  - كل هوية (identities) لها صف خاص.
 *  - الحساب البنكي والحقيبة والخزنة مرتبطين بـ identity_id وليس بالمستخدم،
 *    فمستحيل تختلط حقيبة/بنك هوية بهوية ثانية.
 *  - sessions تحدد أي هوية فعالة حاليا لكل لاعب.
 */
db.exec(`
CREATE TABLE IF NOT EXISTS identities (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id    TEXT    NOT NULL,
  user_id     TEXT    NOT NULL,
  slot        INTEGER NOT NULL,
  first_name  TEXT    NOT NULL,
  surname     TEXT    NOT NULL,
  gender      TEXT    NOT NULL,
  nationality TEXT    NOT NULL,
  cash        INTEGER NOT NULL DEFAULT 0 CHECK (cash >= 0),
  job         TEXT    NOT NULL DEFAULT 'unemployed',
  last_salary INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  UNIQUE (guild_id, user_id, slot)
);

CREATE TABLE IF NOT EXISTS bank_accounts (
  identity_id INTEGER PRIMARY KEY REFERENCES identities(id) ON DELETE CASCADE,
  iban        TEXT    NOT NULL UNIQUE,
  balance     INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0)
);

CREATE TABLE IF NOT EXISTS bank_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  identity_id INTEGER NOT NULL REFERENCES identities(id) ON DELETE CASCADE,
  type        TEXT    NOT NULL,
  amount      INTEGER NOT NULL,
  note        TEXT,
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS items (
  guild_id       TEXT    NOT NULL,
  name           TEXT    NOT NULL COLLATE NOCASE,
  emoji          TEXT,
  description    TEXT,
  price          INTEGER NOT NULL DEFAULT 0 CHECK (price >= 0),
  usable         INTEGER NOT NULL DEFAULT 0,
  consumable     INTEGER NOT NULL DEFAULT 1,
  effect_type    TEXT    NOT NULL DEFAULT 'none',
  effect_value   INTEGER NOT NULL DEFAULT 0,
  effect_message TEXT,
  PRIMARY KEY (guild_id, name)
);

CREATE TABLE IF NOT EXISTS inventory (
  identity_id INTEGER NOT NULL REFERENCES identities(id) ON DELETE CASCADE,
  item        TEXT    NOT NULL COLLATE NOCASE,
  quantity    INTEGER NOT NULL CHECK (quantity > 0),
  PRIMARY KEY (identity_id, item)
);

CREATE TABLE IF NOT EXISTS vault_items (
  identity_id INTEGER NOT NULL REFERENCES identities(id) ON DELETE CASCADE,
  item        TEXT    NOT NULL COLLATE NOCASE,
  quantity    INTEGER NOT NULL CHECK (quantity > 0),
  PRIMARY KEY (identity_id, item)
);

CREATE TABLE IF NOT EXISTS item_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  identity_id INTEGER NOT NULL REFERENCES identities(id) ON DELETE CASCADE,
  type        TEXT    NOT NULL,
  item        TEXT    NOT NULL,
  quantity    INTEGER NOT NULL,
  note        TEXT,
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  guild_id    TEXT    NOT NULL,
  user_id     TEXT    NOT NULL,
  identity_id INTEGER NOT NULL REFERENCES identities(id) ON DELETE CASCADE,
  PRIMARY KEY (guild_id, user_id)
);

CREATE TABLE IF NOT EXISTS warnings (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id     TEXT    NOT NULL,
  user_id      TEXT    NOT NULL,
  moderator_id TEXT    NOT NULL,
  reason       TEXT    NOT NULL,
  created_at   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id   TEXT    NOT NULL,
  actor_id   TEXT    NOT NULL,
  action     TEXT    NOT NULL,
  details    TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_identities_guild ON identities (guild_id);
CREATE INDEX IF NOT EXISTS idx_bank_log_identity ON bank_log (identity_id, id);
CREATE INDEX IF NOT EXISTS idx_item_log_identity ON item_log (identity_id, id);
CREATE INDEX IF NOT EXISTS idx_audit_guild ON audit_log (guild_id, id);
CREATE INDEX IF NOT EXISTS idx_warnings_user ON warnings (guild_id, user_id);
`);

/* ترقية قواعد بيانات قديمة (قبل إضافة الوظائف والأغراض) */
function ensureColumn(table, column, ddl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
}
ensureColumn('identities', 'job', "TEXT NOT NULL DEFAULT 'unemployed'");
ensureColumn('identities', 'last_salary', 'INTEGER NOT NULL DEFAULT 0');

// أي غرض موجود في حقائب قديمة يتسجل تلقائياً في قائمة الأغراض
db.exec(`
INSERT OR IGNORE INTO items (guild_id, name)
SELECT DISTINCT i.guild_id, n.item FROM inventory n JOIN identities i ON i.id = n.identity_id;
`);
