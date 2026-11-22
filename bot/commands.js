'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');

const commands = [
  new SlashCommandBuilder().setName('clear').setDescription('Xóa tin nhắn gần đây')
    .addIntegerOption(o => o.setName('soluong').setDescription('Số tin nhắn (1–100)').setRequired(true).setMinValue(1).setMaxValue(100))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  new SlashCommandBuilder().setName('avatar').setDescription('Xem ảnh đại diện Discord')
    .addUserOption(o => o.setName('thanhvien').setDescription('Thành viên cần xem')),
  new SlashCommandBuilder().setName('profile').setDescription('Xem hồ sơ Discord trong máy chủ')
    .addUserOption(o => o.setName('thanhvien').setDescription('Thành viên cần xem')),
  new SlashCommandBuilder().setName('kick').setDescription('Mời thành viên ra khỏi máy chủ')
    .addUserOption(o => o.setName('thanhvien').setDescription('Thành viên cần kick').setRequired(true))
    .addStringOption(o => o.setName('lydo').setDescription('Lý do').setMaxLength(400))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
  new SlashCommandBuilder().setName('afk').setDescription('Đặt trạng thái vắng mặt')
    .addStringOption(o => o.setName('lydo').setDescription('Lý do vắng mặt').setMaxLength(200)),
  new SlashCommandBuilder().setName('help').setDescription('Xem danh sách lệnh bot'),
  new SlashCommandBuilder().setName('warn').setDescription('Cảnh báo một thành viên')
    .addUserOption(o => o.setName('thanhvien').setDescription('Thành viên cần cảnh báo').setRequired(true))
    .addStringOption(o => o.setName('lydo').setDescription('Lý do cảnh báo').setRequired(true).setMaxLength(400))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
].map(command => command.setDMPermission(false));

const privateReply = content => ({ content, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
const safeReply = content => ({ content, allowedMentions: { parse: [] } });

async function execute(interaction, store) {
  const { commandName: name, options, guild, member, user } = interaction;
  if (!guild) return interaction.reply(privateReply('Lệnh này chỉ dùng trong máy chủ.'));
  const required = { clear: PermissionFlagsBits.ManageMessages, kick: PermissionFlagsBits.KickMembers, warn: PermissionFlagsBits.ModerateMembers }[name];
  if (required && !interaction.memberPermissions?.has(required)) return interaction.reply(privateReply('Bạn không có quyền sử dụng lệnh này.'));
  if (name === 'help') return interaction.reply(privateReply('**Lệnh bot**\n/clear — xóa 1–100 tin nhắn gần đây\n/avatar — xem ảnh đại diện\n/profile — xem hồ sơ Discord\n/kick — kick thành viên\n/afk — đặt trạng thái vắng mặt\n/warn — cảnh báo thành viên\n/help — xem trợ giúp'));
  if (name === 'afk') {
    store.setAfk(guild.id, user.id, options.getString('lydo') || 'Không có lý do');
    return interaction.reply(safeReply('Bạn đã bật trạng thái AFK. Gửi tin nhắn để trở lại.'));
  }
  if (name === 'clear') {
    if (!interaction.channel?.bulkDelete || !interaction.channel.permissionsFor(guild.members.me)?.has(PermissionFlagsBits.ManageMessages)) return interaction.reply(privateReply('Bot cần quyền Quản lý tin nhắn trong kênh này.'));
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const deleted = await interaction.channel.bulkDelete(options.getInteger('soluong'), true);
    return interaction.editReply(`Đã xóa ${deleted.size} tin nhắn. Discord không cho xóa hàng loạt tin nhắn quá 14 ngày.`);
  }
  const target = options.getUser('thanhvien') || user;
  if (name === 'avatar') {
    const targetMember = await guild.members.fetch(target.id).catch(() => null);
    const url = targetMember?.displayAvatarURL({ size: 1024 }) || target.displayAvatarURL({ size: 1024 });
    return interaction.reply({ embeds: [new EmbedBuilder().setTitle(`Avatar của ${target.username}`).setImage(url)], allowedMentions: { parse: [] } });
  }
  if (name === 'profile') {
    const targetMember = await guild.members.fetch(target.id).catch(() => null);
    const embed = new EmbedBuilder().setTitle(`Hồ sơ Discord: ${target.username}`)
      .setThumbnail(target.displayAvatarURL({ size: 256 }))
      .addFields({ name: 'ID', value: target.id }, { name: 'Tạo tài khoản', value: `<t:${Math.floor(target.createdTimestamp / 1000)}:D>` });
    if (targetMember?.joinedTimestamp) embed.addFields({ name: 'Tham gia máy chủ', value: `<t:${Math.floor(targetMember.joinedTimestamp / 1000)}:D>` });
    return interaction.reply({ embeds: [embed], allowedMentions: { parse: [] } });
  }
  if (name === 'kick' || name === 'warn') {
    const targetMember = await guild.members.fetch(target.id).catch(() => null);
    if (!targetMember) return interaction.reply(privateReply('Không tìm thấy thành viên trong máy chủ.'));
    if (target.id === user.id || target.id === guild.ownerId || target.id === interaction.client.user.id || (user.id !== guild.ownerId && member.roles.highest.comparePositionTo(targetMember.roles.highest) <= 0)) return interaction.reply(privateReply('Bạn không thể xử lý thành viên này do thứ bậc hoặc quyền sở hữu máy chủ.'));
    const reason = options.getString('lydo') || 'Không có lý do';
    if (name === 'kick') {
      if (!targetMember.kickable) return interaction.reply(privateReply('Bot không thể kick thành viên này. Kiểm tra quyền và thứ bậc vai trò của bot.'));
      await targetMember.kick(`${user.tag}: ${reason}`);
      return interaction.reply(safeReply(`Đã kick ${target.username}. Lý do: ${reason}`));
    }
    const count = store.warn(guild.id, target.id, user.id, reason);
    return interaction.reply(safeReply(`Đã cảnh báo ${target.username}. Lý do: ${reason} (tổng ${count} cảnh báo).`));
  }
}

module.exports = { commands, execute };
