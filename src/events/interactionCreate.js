import { handlePanel, replyError } from '../handlers/panel.js';
import { checkCooldown } from '../utils/cooldown.js';
import { config } from '../config.js';

export async function handleInteraction(interaction) {
  if (!interaction.inGuild()) return;

  try {
    if (interaction.isChatInputCommand()) {
      const cmd = interaction.client.commands.get(interaction.commandName);
      if (!cmd) return;
      checkCooldown(interaction.user.id, 'global', config.defaultCooldownMs);
      if (cmd.cooldown) checkCooldown(interaction.user.id, interaction.commandName, cmd.cooldown);
      await cmd.execute(interaction);
    } else if (interaction.isAutocomplete()) {
      const cmd = interaction.client.commands.get(interaction.commandName);
      await cmd?.autocomplete?.(interaction);
    } else if (interaction.customId?.startsWith('idp:')) {
      checkCooldown(interaction.user.id, 'panel', 700);
      await handlePanel(interaction);
    }
  } catch (err) {
    if (interaction.isAutocomplete()) return;
    await replyError(interaction, err);
  }
}
