/** يبني دالة autocomplete: getChoices ترجع [{name, value}] حسب الأمر الفرعي. */
export function makeAutocomplete(getChoices) {
  return async (interaction) => {
    const focused = interaction.options.getFocused(true);
    const q = String(focused.value ?? '').toLowerCase();
    let list = [];
    try {
      list = getChoices(interaction, focused.name) ?? [];
    } catch {
      list = [];
    }
    const out = list
      .filter((c) => c.name.toLowerCase().includes(q))
      .slice(0, 25)
      .map((c) => ({ name: c.name.slice(0, 100), value: String(c.value).slice(0, 100) }));
    await interaction.respond(out);
  };
}
