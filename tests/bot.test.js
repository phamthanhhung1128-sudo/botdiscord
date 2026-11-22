'use strict';
const { PermissionFlagsBits, Collection } = require('discord.js');
const { commands, execute } = require('../bot/commands');
const store = require('../bot/store');
const { handleMessage } = require('../bot');
const db = require('../src/db');

beforeEach(() => { store.init(); db.exec('DELETE FROM bot_afk; DELETE FROM guild_warnings;'); });
afterAll(() => db.closeDb());

test('đăng ký đủ bảy lệnh và các quyền quản trị', () => {
  const data = commands.map(c => c.toJSON());
  expect(data.map(c => c.name)).toEqual(['clear', 'avatar', 'profile', 'kick', 'afk', 'help', 'warn']);
  expect(data.find(c => c.name === 'clear').default_member_permissions).toBe(String(PermissionFlagsBits.ManageMessages));
  expect(data.find(c => c.name === 'kick').default_member_permissions).toBe(String(PermissionFlagsBits.KickMembers));
  expect(data.find(c => c.name === 'warn').default_member_permissions).toBe(String(PermissionFlagsBits.ModerateMembers));
});
test('AFK và cảnh báo được lưu riêng theo máy chủ', () => {
  store.setAfk('a', 'u', 'nghỉ'); store.setAfk('a', 'u', 'bận');
  expect(store.getAfk('a', 'u').reason).toBe('bận');
  expect(store.getAfk('b', 'u')).toBeUndefined();
  expect(store.takeAfk('a', 'u').reason).toBe('bận');
  expect(store.takeAfk('a', 'u')).toBeUndefined();
  expect(store.warn('a', 'u', 'm', 'lần 1')).toBe(1);
  expect(store.warn('a', 'u', 'm', 'lần 2')).toBe(2);
  expect(store.warn('b', 'u', 'm', 'khác')).toBe(1);
});
test('tin nhắn xóa AFK và thông báo người được nhắc mà không ping', async () => {
  store.setAfk('a', 'u', 'bận'); store.setAfk('a', 'v', '@everyone');
  const message = { guild: { id: 'a' }, author: { id: 'u', bot: false }, mentions: { users: new Collection([['v', { id: 'v', username: 'V' }]]) }, reply: vi.fn() };
  await handleMessage(message);
  expect(store.getAfk('a', 'u')).toBeUndefined();
  expect(message.reply.mock.calls[0][0].content).toContain('V đang AFK: @everyone');
  expect(message.reply.mock.calls[0][0].allowedMentions.parse).toEqual([]);
});
test('không cho thực hiện lệnh quản trị khi thiếu quyền', async () => {
  const interaction = { commandName: 'warn', guild: {}, memberPermissions: { has: () => false }, reply: vi.fn() };
  await execute(interaction, store);
  expect(interaction.reply.mock.calls[0][0].content).toContain('không có quyền');
});
test('clear bỏ qua tin nhắn quá cũ', async () => {
  const interaction = { commandName: 'clear', guild: { members: { me: {} } }, memberPermissions: { has: () => true }, options: { getInteger: () => 12 }, channel: { permissionsFor: () => ({ has: () => true }), bulkDelete: vi.fn(async () => new Collection([['1', {}]])) }, deferReply: vi.fn(), editReply: vi.fn() };
  await execute(interaction, store);
  expect(interaction.channel.bulkDelete).toHaveBeenCalledWith(12, true);
  expect(interaction.editReply.mock.calls[0][0]).toContain('1 tin nhắn');
});
test('không cảnh báo chủ máy chủ dù người dùng có quyền', async () => {
  const interaction = { commandName: 'warn', guild: { id: 'g', ownerId: 'owner', members: { fetch: async () => ({ roles: {} }) } }, user: { id: 'mod' }, member: {}, memberPermissions: { has: () => true }, options: { getUser: () => ({ id: 'owner' }) }, client: { user: { id: 'bot' } }, reply: vi.fn() };
  await execute(interaction, store);
  expect(interaction.reply.mock.calls[0][0].content).toContain('không thể');
  expect(db.all('SELECT * FROM guild_warnings')).toHaveLength(0);
});
