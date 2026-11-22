/**
 * src/routes/home.js
 * ---------------------------------------------------------------------------
 * Trang chủ.
 *
 * Giai đoạn 1: hiển thị bảng "sức khoẻ nền tảng" để chứng minh toàn bộ stack
 * (Express + EJS + SQLite + session) đã chạy đúng.
 * Giai đoạn 3: thay bằng trang chủ cộng đồng thật (feed bài viết, thống kê...).
 */
'use strict';

const express = require('express');
const db = require('../db');
const env = require('../config/env');

const router = express.Router();

router.get('/', (req, res) => {
  // Thống kê nhẹ cho dashboard
  let counts = { users: 0, posts: 0, chatMessages: 0, conductRecords: 0 };
  try {
    counts = {
      users: db.get('SELECT COUNT(*) AS c FROM users').c,
      posts: db.get('SELECT COUNT(*) AS c FROM posts').c,
      chatMessages: db.get('SELECT COUNT(*) AS c FROM chat_messages').c,
      conductRecords: db.get('SELECT COUNT(*) AS c FROM conduct_records').c,
    };
  } catch {
    /* DB chưa init → giữ số 0, trang vẫn render được */
  }

  res.render('pages/home', {
    title: 'Nền tảng đã sẵn sàng',
    counts,
    dbStats: db.stats(),
    env,
  });
});

module.exports = router;
