// أدوات مشتركة للاختبارات: تفاعل ديسكورد مزيف.
export function fakeInteraction({ guildId = 'g1', userId = 'u1', sub = null, strings = {}, ints = {}, users = {}, bools = {} } = {}) {
  const out = { replies: [] };
  const pick = (map, name, required) => {
    const v = map[name];
    if (v === undefined && required) throw new Error(`missing option ${name}`);
    return v ?? null;
  };
  const interaction = {
    guildId,
    client: { ws: { ping: 42 }, guilds: { cache: { size: 1 } } },
    inGuild: () => true,
    user: { id: userId, bot: false, displayAvatarURL: () => 'https://example.com/a.png' },
    options: {
      getSubcommand: () => sub,
      getString: (n, r) => pick(strings, n, r),
      getInteger: (n, r) => pick(ints, n, r),
      getBoolean: (n) => pick(bools, n, false),
      getUser: (n, r) => pick(users, n, r),
    },
    replied: false,
    deferred: false,
    reply: async (p) => {
      interaction.replied = true;
      out.replies.push(p);
    },
  };
  return { interaction, out };
}
