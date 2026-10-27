import 'dotenv/config';

const num = (v, d) => (v === undefined || v === '' || Number.isNaN(Number(v)) ? d : Number(v));
const bool = (v, d) => (v === undefined || v === '' ? d : ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase()));
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

const ibanPrefix = /^[A-Za-z]{2}$/.test(process.env.IBAN_PREFIX ?? '') ? process.env.IBAN_PREFIX.toUpperCase() : 'BK';

export const config = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID || null,
  logChannelId: process.env.LOG_CHANNEL_ID || null,
  // صاحب البوت: الوحيد اللي يقدر ياخذ نسخة احتياطية من قاعدة البيانات
  ownerId: process.env.OWNER_ID || null,

  identity: {
    // عدد الهويات لكل لاعب. لو تبي ثالثة أضف { slot: 3, label: 'الهوية الثالثة' }
    slots: [
      { slot: 1, label: 'الهوية الأولى' },
      { slot: 2, label: 'الهوية الثانية' },
    ],
    startingCash: num(process.env.START_CASH, 5000),
    startingBank: num(process.env.START_BANK, 10000),
    // false = يمنع التحويل/إعطاء الأغراض بين هويتين لنفس الشخص
    allowSelfTransfer: false,
  },

  // نصوص عامة (بدون أي اسم سيرفر أو مدينة) — غيّرها من .env
  currency: process.env.CURRENCY || 'دولار',
  ibanPrefix, // بادئة أرقام الحسابات الجديدة (حرفين)
  placeholders: { firstName: 'مثال: أحمد', surname: 'مثال: الخالد', nationality: 'مثال: عربي', gender: 'ذكر / أنثى' },

  maxAmount: 1_000_000_000,
  maxItemQty: 100_000,
  maxItemTypes: 30, // أقصى عدد أنواع أغراض مختلفة في الحقيبة الواحدة
  vaultMaxTypes: 60, // أقصى عدد أنواع الأغراض في الخزنة
  maxCatalogItems: 200, // أقصى عدد أغراض معرّفة في السيرفر

  // true = لازم الغرض يكون معرّف في قائمة الأغراض (/ادارة-غرض ضبط) قبل ما ينضاف لأي حقيبة
  strictItems: bool(process.env.STRICT_ITEMS, true),

  // رسوم التحويل البنكي بالمئة (تنخصم من المرسل فوق المبلغ)
  transferFeePercent: clamp(num(process.env.TRANSFER_FEE_PERCENT, 0), 0, 50),
  // نسبة سعر البيع للمتجر من سعر الشراء
  sellRatio: clamp(num(process.env.SELL_RATIO, 0.5), 0, 1),

  // الراتب: مرة كل كم ساعة (ينزل في البنك حسب وظيفة الهوية)
  salaryCooldownHours: clamp(num(process.env.SALARY_COOLDOWN_HOURS, 24), 1, 720),
  jobs: [
    { key: 'unemployed', label: 'عاطل', salary: 0 },
    { key: 'worker', label: 'عامل', salary: 1000 },
    { key: 'mechanic', label: 'ميكانيكي', salary: 1800 },
    { key: 'employee', label: 'موظف حكومي', salary: 2200 },
    { key: 'doctor', label: 'طبيب', salary: 3500 },
  ],

  // حماية من السبام: أقل فاصل بين أوامر نفس اللاعب (مللي ثانية)
  defaultCooldownMs: 1000,

  // نسخ احتياطي تلقائي لقاعدة البيانات (مجلد backups جنب ملف القاعدة)
  backup: {
    enabled: bool(process.env.BACKUP_ENABLED, true),
    intervalMinutes: clamp(num(process.env.BACKUP_INTERVAL_MINUTES, 60), 5, 1440),
    keep: clamp(num(process.env.BACKUP_KEEP, 24), 1, 500),
  },

  // تصعيد تلقائي للتحذيرات: لما يوصل العضو لهذا العدد ينكتم تلقائياً
  warnEscalation: [
    { count: 3, minutes: 60 },
    { count: 5, minutes: 1440 },
  ],
};

export const slotLabel = (slot) =>
  config.identity.slots.find((s) => s.slot === slot)?.label ?? `الهوية ${slot}`;

export const slotChoices = () =>
  config.identity.slots.map((s) => ({ name: s.label, value: s.slot }));

export const jobByKey = (key) => config.jobs.find((j) => j.key === key);
export const jobLabel = (key) => jobByKey(key)?.label ?? 'عاطل';
export const jobChoices = () => config.jobs.map((j) => ({ name: j.label, value: j.key }));
