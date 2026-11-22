'use strict';
const { Client, GatewayIntentBits, Events, MessageFlags } = require('discord.js');
const env = require('../src/config/env');
const store = require('./store');
const { execute } = require('./commands');

async function handleMessage(message, storage = store) {
  if (!message.guild || message.author.bot) return;
  const guild = message.guild.id;
  const wasAfk = storage.takeAfk(guild, message.author.id);
  const notices = [];
  if (wasAfk) notices.push('Chào mừng bạn trở lại! Trạng thái AFK đã được xóa.');
  for (const mentioned of message.mentions.users.values()) {
    if (mentioned.id === message.author.id) continue;
    const afk = storage.getAfk(guild, mentioned.id);
    if (afk) notices.push(`${mentioned.username} đang AFK: ${afk.reason}`);
    if (notices.length >= 5) break;
  }
  if (notices.length) await message.reply({ content: notices.join('\n').slice(0, 1900), allowedMentions: { parse: [], repliedUser: false } });
}

async function start({ token = env.DISCORD_TOKEN } = {}) {
  if (!token) throw new Error('Thiếu DISCORD_TOKEN.');
  store.init();
  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
  client.once(Events.ClientReady, ready => {
    console.log(`Bot Discord đã đăng nhập: ${ready.user.tag}`);
    if (env.BOT_ACTIVITY) ready.user.setActivity(env.BOT_ACTIVITY);
  });
  client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;
    try { await execute(interaction, store); }
    catch (error) {
      console.error('Lỗi lệnh Discord:', error);
      const response = { content: 'Không thể thực hiện lệnh. Vui lòng kiểm tra quyền bot và thử lại.', flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } };
      try { if (interaction.deferred || interaction.replied) await interaction.editReply({ content: response.content, allowedMentions: response.allowedMentions }); else await interaction.reply(response); } catch (replyError) { console.error('Không thể trả lời interaction:', replyError.message); }
    }
  });
  client.on(Events.MessageCreate, message => { handleMessage(message).catch(error => console.error('Lỗi xử lý AFK:', error)); });
  client.on(Events.Error, error => console.error('Lỗi Discord:', error));
  try { await client.login(token); } catch (error) { client.destroy(); throw error; }
  return client;
}
if (require.main === module) start().catch(error => { console.error('Không khởi động được bot:', error.message); process.exitCode = 1; });
module.exports = { start, handleMessage };
