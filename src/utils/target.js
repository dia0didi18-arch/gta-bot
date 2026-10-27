import { slotChoices } from '../config.js';
import { UserError } from '../errors.js';
import { getIdentityBySlot, requireActive } from '../services/identity.js';

/** يضيف خيارين (عضو + الهوية) لأوامر الإدارة اللي تتعامل مع هوية لاعب. */
export function addTargetOptions(sub) {
  return sub
    .addUserOption((o) => o.setName('عضو').setDescription('اللاعب').setRequired(true))
    .addIntegerOption((o) =>
      o.setName('الهوية').setDescription('أي هوية').setRequired(true).addChoices(...slotChoices()),
    );
}

/** يرجع هوية اللاعب المحددة في الأمر. */
export function resolveTargetIdentity(interaction) {
  const user = interaction.options.getUser('عضو', true);
  const slot = interaction.options.getInteger('الهوية', true);
  const identity = getIdentityBySlot(interaction.guildId, user.id, slot);
  if (!identity) throw new UserError('اللاعب ما عنده هوية بهذا الرقم.');
  return { user, identity };
}

export { requireActive };
