'use strict';
const { REST, Routes } = require('discord.js');
const env = require('../src/config/env');
const { commands } = require('./commands');
async function deploy() {
  if (!env.DISCORD_TOKEN || !env.DISCORD_CLIENT_ID) throw new Error('Cần DISCORD_TOKEN và DISCORD_CLIENT_ID trong .env.');
  const route = env.DISCORD_GUILD_ID
    ? Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, env.DISCORD_GUILD_ID)
    : Routes.applicationCommands(env.DISCORD_CLIENT_ID);
  await new REST({ version: '10' }).setToken(env.DISCORD_TOKEN).put(route, { body: commands.map(c => c.toJSON()) });
  console.log(`Đã đăng ký ${commands.length} lệnh ${env.DISCORD_GUILD_ID ? 'cho máy chủ' : 'toàn cục'}.`);
}
if (require.main === module) deploy().catch(error => { console.error('Đăng ký lệnh thất bại:', error.message); process.exitCode = 1; });
module.exports = { deploy };
