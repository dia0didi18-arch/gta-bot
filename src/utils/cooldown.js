import { UserError } from '../errors.js';

const until = new Map();

/** يرمي UserError لو اللاعب استخدم نفس الشي قبل ما تخلص مدة التبريد. */
export function checkCooldown(userId, key, ms) {
  const k = `${userId}:${key}`;
  const t = Date.now();
  const wait = (until.get(k) ?? 0) - t;
  if (wait > 0) throw new UserError(`⏳ تمهّل شوي، حاول بعد ${Math.ceil(wait / 1000)} ثانية.`);
  until.set(k, t + ms);
  if (until.size > 5000) for (const [key2, v] of until) if (v <= t) until.delete(key2);
}
