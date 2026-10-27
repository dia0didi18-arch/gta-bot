import fs from 'node:fs';
import path from 'node:path';
import { db, dbFile } from './db.js';
import { config } from './config.js';

export const backupDir = path.join(path.dirname(dbFile), 'backups');

/** ينسخ قاعدة البيانات (نسخة متسقة حتى لو البوت شغال) ويحذف النسخ الأقدم. يرجع مسار النسخة. */
export async function runBackup() {
  if (dbFile === ':memory:') throw new Error('القاعدة في الذاكرة، ما فيه ملف للنسخ.');
  fs.mkdirSync(backupDir, { recursive: true });
  const name = `bot-${new Date().toISOString().replace(/[:.]/g, '-')}.db`;
  const dest = path.join(backupDir, name);
  await db.backup(dest);

  const files = fs
    .readdirSync(backupDir)
    .filter((f) => f.startsWith('bot-') && f.endsWith('.db'))
    .sort();
  for (const old of files.slice(0, Math.max(0, files.length - config.backup.keep))) {
    fs.rmSync(path.join(backupDir, old), { force: true });
  }
  return dest;
}

export function startBackups() {
  if (!config.backup.enabled || dbFile === ':memory:') return null;
  const timer = setInterval(
    () => runBackup().catch((e) => console.error('فشل النسخ الاحتياطي:', e.message)),
    config.backup.intervalMinutes * 60_000,
  );
  timer.unref();
  return timer;
}
