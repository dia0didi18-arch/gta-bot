/** خطأ يظهر نصه للمستخدم كما هو (أخطاء متوقعة مثل: رصيد غير كافي). */
export class UserError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UserError';
  }
}
