'use strict';
const db = require('../src/db');

function init() {
  db.exec(`CREATE TABLE IF NOT EXISTS bot_afk (
    guild_id TEXT NOT NULL, user_id TEXT NOT NULL, reason TEXT NOT NULL,
    created_at INTEGER NOT NULL, PRIMARY KEY (guild_id, user_id)
  );
  CREATE TABLE IF NOT EXISTS guild_warnings (
    id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT NOT NULL,
    discord_user_id TEXT NOT NULL, moderator_discord_id TEXT NOT NULL,
    reason TEXT, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX IF NOT EXISTS idx_warnings_target ON guild_warnings(guild_id, discord_user_id);`);
}
function setAfk(guild, user, reason) {
  db.run('INSERT INTO bot_afk VALUES (?, ?, ?, ?) ON CONFLICT(guild_id, user_id) DO UPDATE SET reason=excluded.reason, created_at=excluded.created_at', [guild, user, reason, Date.now()]);
}
function takeAfk(guild, user) {
  return db.tx(() => {
    const record = db.get('SELECT * FROM bot_afk WHERE guild_id = ? AND user_id = ?', [guild, user]);
    if (record) db.run('DELETE FROM bot_afk WHERE guild_id = ? AND user_id = ?', [guild, user]);
    return record;
  });
}
function getAfk(guild, user) { return db.get('SELECT * FROM bot_afk WHERE guild_id = ? AND user_id = ?', [guild, user]); }
function warn(guild, target, moderator, reason) {
  return db.tx(() => {
    db.run('INSERT INTO guild_warnings (guild_id, discord_user_id, moderator_discord_id, reason) VALUES (?, ?, ?, ?)', [guild, target, moderator, reason]);
    return db.get('SELECT COUNT(*) AS count FROM guild_warnings WHERE guild_id = ? AND discord_user_id = ?', [guild, target]).count;
  });
}
module.exports = { init, setAfk, takeAfk, getAfk, warn };
