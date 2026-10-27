import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const commandsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'commands');

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.name.endsWith('.js')) yield full;
  }
}

/** يحمّل كل ملفات الأوامر من src/commands (أي مجلد فرعي). اسم المجلد = تصنيف الأمر. */
export async function loadCommands() {
  const commands = new Map();
  for (const file of walk(commandsDir)) {
    const mod = await import(pathToFileURL(file).href);
    if (!mod.data || !mod.execute) {
      console.warn(`⚠️ تم تجاهل ${file}: لازم يصدّر data و execute`);
      continue;
    }
    if (commands.has(mod.data.name)) throw new Error(`اسم أمر مكرر: ${mod.data.name}`);
    commands.set(mod.data.name, { ...mod, category: path.relative(commandsDir, file).split(path.sep)[0] });
  }
  return commands;
}
